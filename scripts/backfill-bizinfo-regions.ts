import { createHash } from "crypto";
import { loadEnvConfig } from "@next/env";
import { supabaseAdmin } from "../lib/supabase/server";
import {
  BIZINFO_REGIONS,
  inferBizinfoRegion,
  type BizinfoRegionResult,
} from "../lib/ingest/adapters/bizinfo-region";

loadEnvConfig(process.cwd());

const SOURCE_ID = 1;
const PAGE_SIZE = 500;
const MAX_LIMIT = 30;

interface CandidateRow {
  id: number;
  title: string;
  region: string | null;
  target: string | null;
  summary: string | null;
  detail_content: string | null;
}

type CandidateKind = "single_region" | "nationwide" | "unknown" | "conflict";

interface Candidate {
  row: CandidateRow;
  result: BizinfoRegionResult;
  kind: CandidateKind;
  isOpen: boolean;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const [rows, publicStatuses] = await Promise.all([
    loadCandidateRows(),
    loadPublicStatuses(),
  ]);
  const allCandidates = rows.map((row) => {
      const result = inferBizinfoRegion({
        title: row.title,
        target: row.target,
        summary: row.summary,
        detailContent: row.detail_content,
      });
      return {
        row,
        result,
        kind: candidateKind(result),
        isOpen: publicStatuses.get(row.id) === "open",
      } satisfies Candidate;
    });
  const selected = options.all
    ? allCandidates
    : selectMixedCandidates(
        allCandidates.filter(({ row }) => publicStatuses.has(row.id)),
        options.limit
      );
  const expected = options.all ? rows.length : options.limit;
  if (selected.length !== expected) {
    throw new Error(`요청한 ${expected}건 중 ${selected.length}건만 선택되었습니다.`);
  }

  const ids = selected.map(({ row }) => row.id);
  const beforeRows = await loadFullRows(ids);
  const beforeFingerprints = new Map(
    beforeRows.map((row) => [Number(row.id), fingerprintWithoutRegion(row)])
  );

  console.log(
    options.apply
      ? `[기업마당 region ${selected.length}건 적용]`
      : `[기업마당 region ${selected.length}건 dry-run]`
  );
  console.log(
    JSON.stringify(
      {
        mode: options.apply ? "apply" : "dry-run",
        selected: selected.length,
        changedFromCurrent: selected.filter(
          ({ row, result }) => row.region !== result.region
        ).length,
        byType: countByType(selected),
        rows: reportRows(selected, options.all).map(({ row, result, kind }) => ({
          id: row.id,
          type: kind,
          previousRegion: row.region,
          inferredRegion: result.region,
          evidenceField: result.evidenceField,
          reason: result.reason,
        })),
      },
      null,
      2
    )
  );

  if (!options.apply) {
    console.log("DB 업데이트 없음: 실제 적용은 --apply가 필요합니다.");
    return;
  }

  const failures: Array<{ ids: number[]; error: string }> = [];
  let updated = 0;
  const byRegion = new Map<string, Candidate[]>();
  for (const candidate of selected) {
    const regionCandidates = byRegion.get(candidate.result.region) ?? [];
    regionCandidates.push(candidate);
    byRegion.set(candidate.result.region, regionCandidates);
  }
  for (const [region, regionCandidates] of byRegion) {
    const regionIds = regionCandidates.map(({ row }) => row.id);
    for (const idsChunk of chunks(regionIds, 100)) {
      const { data, error } = await supabaseAdmin
        .from("announcements")
        .update({ region })
        .eq("source_id", SOURCE_ID)
        .in("id", idsChunk)
        .select("id,region");
      const valid = (data ?? []).filter((row) => row.region === region);
      if (error || valid.length !== idsChunk.length) {
        failures.push({
          ids: idsChunk,
          error: error?.message ?? "업데이트 결과 건수 불일치",
        });
      } else {
        updated += valid.length;
      }
    }
  }

  const afterRows = await loadFullRows(ids);
  const afterById = new Map(afterRows.map((row) => [Number(row.id), row]));
  const otherFieldsChanged = ids.filter((id) => {
    const after = afterById.get(id);
    return !after || beforeFingerprints.get(id) !== fingerprintWithoutRegion(after);
  });
  const regionMismatches = selected
    .filter(({ row, result }) => afterById.get(row.id)?.region !== result.region)
    .map(({ row }) => row.id);
  const publicRows = await loadSelectedPublicRows(ids);
  const publicById = new Map(publicRows.map((row) => [Number(row.id), row.region]));
  const publicMismatches = selected
    .filter(({ row }) => publicStatuses.has(row.id))
    .filter(({ row, result }) => publicById.get(row.id) !== result.region)
    .map(({ row }) => row.id);

  console.log(
    JSON.stringify(
      {
        updateResult: {
          requested: selected.length,
          succeeded: updated,
          failed: failures.length,
          failures,
        },
        verification: {
          regionMismatches,
          otherFieldsChanged,
          publicViewMismatches: publicMismatches,
          nationwideCount: selected.filter(({ result }) => result.region === "전국").length,
          nationwideIdsSample: selected
            .filter(({ result }) => result.region === "전국")
            .slice(0, 5)
            .map(({ row }) => row.id),
          unknownCount: selected.filter(({ result }) => result.region === "미확인").length,
          unknownIdsSample: selected
            .filter(({ result }) => result.region === "미확인")
            .slice(0, 5)
            .map(({ row }) => row.id),
          localCountsByRegion: Object.fromEntries(
            BIZINFO_REGIONS.map((region) => [
              region,
              selected
                .filter(({ result }) => result.region === region).length,
            ]).filter(([, count]) => Number(count) > 0)
          ),
        },
      },
      null,
      2
    )
  );

  if (
    failures.length > 0 ||
    regionMismatches.length > 0 ||
    otherFieldsChanged.length > 0 ||
    publicMismatches.length > 0
  ) {
    process.exitCode = 1;
  }
}

function parseOptions(args: string[]) {
  const apply = args.includes("--apply");
  const all = args.includes("--all");
  const limitArg = args.find((arg) => arg.startsWith("--limit="));
  const parsed = Number(limitArg?.slice("--limit=".length) ?? MAX_LIMIT);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("--limit은 1 이상의 정수여야 합니다.");
  }
  return { apply, all, limit: Math.min(parsed, MAX_LIMIT) };
}

function reportRows(selected: Candidate[], all: boolean) {
  if (!all) return selected;
  const samples: Candidate[] = [];
  for (const kind of ["single_region", "nationwide", "unknown", "conflict"] as const) {
    samples.push(...selected.filter((candidate) => candidate.kind === kind).slice(0, 5));
  }
  return samples;
}

async function loadCandidateRows() {
  const rows: CandidateRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("announcements")
      .select("id,title,region,target,summary,detail_content")
      .eq("source_id", SOURCE_ID)
      .order("id", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`기업마당 조회 실패: ${error.message}`);
    rows.push(...((data ?? []) as CandidateRow[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function loadPublicStatuses() {
  const statuses = new Map<number, string>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("announcements_public")
      .select("id,status")
      .eq("source_id", SOURCE_ID)
      .order("id", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`공개 공고 조회 실패: ${error.message}`);
    for (const row of data ?? []) statuses.set(Number(row.id), String(row.status));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return statuses;
}

function selectMixedCandidates(candidates: Candidate[], limit: number) {
  const quotas: Record<CandidateKind, number> = {
    single_region: Math.max(0, limit - 15),
    nationwide: Math.min(5, limit),
    unknown: Math.min(5, Math.max(0, limit - 5)),
    conflict: Math.min(5, Math.max(0, limit - 10)),
  };
  const selected: Candidate[] = [];
  const selectedIds = new Set<number>();
  const add = (candidate: Candidate) => {
    if (selectedIds.has(candidate.row.id) || selected.length >= limit) return;
    selected.push(candidate);
    selectedIds.add(candidate.row.id);
  };

  for (const kind of ["single_region", "nationwide", "unknown", "conflict"] as const) {
    const pool = candidates.filter((candidate) => candidate.kind === kind);
    const preferred = [...pool.filter((candidate) => candidate.isOpen), ...pool.filter((candidate) => !candidate.isOpen)];
    preferred.slice(0, quotas[kind]).forEach(add);
  }
  candidates.forEach(add);
  return selected.slice(0, limit);
}

function candidateKind(result: BizinfoRegionResult): CandidateKind {
  if (result.reason === "conflict_or_multiple") return "conflict";
  if (result.region === "전국") return "nationwide";
  if (result.region === "미확인") return "unknown";
  return "single_region";
}

function countByType(selected: Candidate[]) {
  return selected.reduce<Record<CandidateKind, number>>(
    (counts, candidate) => {
      counts[candidate.kind]++;
      return counts;
    },
    { single_region: 0, nationwide: 0, unknown: 0, conflict: 0 }
  );
}

async function loadFullRows(ids: number[]) {
  const rows: Array<Record<string, unknown>> = [];
  for (const idsChunk of chunks(ids, 100)) {
    const { data, error } = await supabaseAdmin
      .from("announcements")
      .select("*")
      .eq("source_id", SOURCE_ID)
      .in("id", idsChunk);
    if (error) throw new Error(`검증용 원본 조회 실패: ${error.message}`);
    rows.push(...((data ?? []) as Array<Record<string, unknown>>));
  }
  return rows;
}

async function loadSelectedPublicRows(ids: number[]) {
  const rows: Array<{ id: number; region: string | null }> = [];
  for (const idsChunk of chunks(ids, 100)) {
    const { data, error } = await supabaseAdmin
      .from("announcements_public")
      .select("id,region")
      .eq("source_id", SOURCE_ID)
      .in("id", idsChunk);
    if (error) throw new Error(`공개 뷰 검증 실패: ${error.message}`);
    rows.push(...((data ?? []) as Array<{ id: number; region: string | null }>));
  }
  return rows;
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function fingerprintWithoutRegion(row: Record<string, unknown>) {
  const comparable = { ...row };
  delete comparable.region;
  return createHash("sha256").update(stableStringify(comparable)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "기업마당 지역 백필 실패");
  process.exitCode = 1;
});
