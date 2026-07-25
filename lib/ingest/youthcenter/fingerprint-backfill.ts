import { supabaseAdmin } from "@/lib/supabase/server";
import { mapYouthCenterPolicy } from "./mapper";
import { toYouthCenterAnnouncementRow } from "./store";
import type { YouthCenterRawRecord } from "./types";

const SOURCE_CODE = "youthcenter";
const DB_PAGE_SIZE = 1_000;
const UPDATE_CONCURRENCY = 8;
const EXPECTED_SOURCE_ROWS = 749;
const EXPECTED_PUBLIC_ROWS = 729;

const ACTUAL_DUPLICATE_PAIRS = [
  ["20260413005400212694", "20260410005400212668"],
  ["20260413005400212696", "20260410005400212671"],
  ["20260413005400212697", "20260410005400212672"],
  ["20260413005400212698", "20260410005400212673"],
  ["20260413005400212701", "20260410005400212675"],
  ["20260421005400212815", "20260414005400212737"],
  ["20260422005400212834", "20260415005400212744"],
  ["20260422005400212845", "20260414005400212733"],
  ["20260422005400212858", "20260416005400212754"],
  ["20260422005400212860", "20260416005400212752"],
  ["20260422005400212867", "20260413005400212723"],
  ["20260722005400213273", "20260710005400213254"],
  ["20260722005400213276", "20260708005400213251"],
  ["20260722005400213282", "20260702005400213247"],
  ["20260722005400213285", "20260618005400213240"],
  ["20260722005400213286", "20260616005400213236"],
  ["20260722005400213295", "20260408005400212595"],
  ["20260722005400213296", "20260408005400212626"],
  ["20260722005400213297", "20260408005400212632"],
  ["20260722005400213299", "20260408005400212638"],
] as const;

const SEPARATE_POLICY_PAIRS = [
  ["20260422005400212852", "20260421005400212796"],
  ["20260422005400212859", "20260414005400212729"],
] as const;

interface StoredYouthCenterRow {
  id: number;
  sourceKey: string;
  title: string;
  organization: string | null;
  region: string | null;
  regions: string[] | null;
  target: string | null;
  summary: string | null;
  applyStart: string | null;
  applyEnd: string | null;
  rawJson: Record<string, unknown>;
  sourceFingerprint: string | null;
}

interface PlannedUpdate {
  id: number;
  sourceKey: string;
  sourceFingerprint: string;
  region: string | null;
  regions: string[] | null;
  fingerprintChanged: boolean;
  regionChanged: boolean;
}

export interface YouthCenterFingerprintBackfillReport {
  mode: "dry-run" | "apply";
  schemaReady: boolean;
  sourceId: number;
  sourceRowCount: number;
  currentPublicCount: number;
  expectedPublicCount: number;
  expectedHiddenByFingerprint: number;
  fingerprintChangeCount: number;
  regionChangeCount: number;
  integratedRegionCount: number;
  totalChangeCount: number;
  updatedCount: number;
  unchangedCount: number;
  actualDuplicatePairsMatched: number;
  separatePolicyPairsDifferent: number;
}

export async function runYouthCenterFingerprintBackfill(
  apply: boolean,
): Promise<YouthCenterFingerprintBackfillReport> {
  const sourceId = await loadYouthCenterSourceId();
  const schemaReady = await hasSourceFingerprintColumn();
  if (apply && !schemaReady) {
    throw new Error(
      "source_fingerprint migration이 적용되지 않아 backfill을 실행할 수 없습니다.",
    );
  }

  const rows = await loadYouthCenterRows(sourceId, schemaReady);
  if (rows.length !== EXPECTED_SOURCE_ROWS) {
    throw new Error(
      `온통청년 원본 행 수가 예상과 다릅니다: expected=${EXPECTED_SOURCE_ROWS}, actual=${rows.length}`,
    );
  }

  const planned = rows.map((row) => planRow(row, sourceId));
  const audit = validateAuditPairs(planned);
  const uniqueFingerprints = new Set(
    planned.map((row) => row.sourceFingerprint),
  ).size;
  if (uniqueFingerprints !== EXPECTED_PUBLIC_ROWS) {
    throw new Error(
      `fingerprint 적용 예상 공개 건수가 다릅니다: expected=${EXPECTED_PUBLIC_ROWS}, actual=${uniqueFingerprints}`,
    );
  }

  const changes = planned.filter(
    (row) => row.fingerprintChanged || row.regionChanged,
  );
  let updatedCount = 0;
  if (apply) {
    updatedCount = await applyUpdates(sourceId, changes);
  }

  return {
    mode: apply ? "apply" : "dry-run",
    schemaReady,
    sourceId,
    sourceRowCount: rows.length,
    currentPublicCount: await countCurrentPublicRows(sourceId),
    expectedPublicCount: uniqueFingerprints,
    expectedHiddenByFingerprint: rows.length - uniqueFingerprints,
    fingerprintChangeCount: planned.filter((row) => row.fingerprintChanged)
      .length,
    regionChangeCount: planned.filter((row) => row.regionChanged).length,
    integratedRegionCount: planned.filter(
      (row) => row.region === "전남광주통합특별시",
    ).length,
    totalChangeCount: changes.length,
    updatedCount,
    unchangedCount: rows.length - changes.length,
    actualDuplicatePairsMatched: audit.actualDuplicatePairsMatched,
    separatePolicyPairsDifferent: audit.separatePolicyPairsDifferent,
  };
}

function planRow(
  row: StoredYouthCenterRow,
  sourceId: number,
): PlannedUpdate {
  const original = rawOriginal(row.rawJson);
  const mapped = mapYouthCenterPolicy(original);
  if (!mapped.policy) {
    throw new Error(
      `온통청년 원본 재매핑 실패 (${row.sourceKey}): ${mapped.error ?? "알 수 없는 오류"}`,
    );
  }
  if (mapped.policy.sourceExternalId !== row.sourceKey) {
    throw new Error(
      `온통청년 source_key 불일치: stored=${row.sourceKey}, raw=${mapped.policy.sourceExternalId}`,
    );
  }

  const normalized = toYouthCenterAnnouncementRow(
    mapped.policy,
    sourceId,
    new Date(0),
  );
  return {
    id: row.id,
    sourceKey: row.sourceKey,
    sourceFingerprint: normalized.source_fingerprint,
    region: normalized.region,
    regions: normalized.regions,
    fingerprintChanged:
      row.sourceFingerprint !== normalized.source_fingerprint,
    regionChanged:
      row.region !== normalized.region ||
      !sameStringArray(row.regions, normalized.regions),
  };
}

function validateAuditPairs(rows: PlannedUpdate[]) {
  const byKey = new Map(rows.map((row) => [row.sourceKey, row]));
  let actualDuplicatePairsMatched = 0;
  for (const [hidden, representative] of ACTUAL_DUPLICATE_PAIRS) {
    const left = requireAuditRow(byKey, hidden);
    const right = requireAuditRow(byKey, representative);
    if (left.sourceFingerprint !== right.sourceFingerprint) {
      throw new Error(
        `실제 동일 정책 fingerprint 불일치: ${hidden} / ${representative}`,
      );
    }
    actualDuplicatePairsMatched += 1;
  }

  let separatePolicyPairsDifferent = 0;
  for (const [hidden, representative] of SEPARATE_POLICY_PAIRS) {
    const left = requireAuditRow(byKey, hidden);
    const right = requireAuditRow(byKey, representative);
    if (left.sourceFingerprint === right.sourceFingerprint) {
      throw new Error(
        `별도 정책 fingerprint가 동일합니다: ${hidden} / ${representative}`,
      );
    }
    separatePolicyPairsDifferent += 1;
  }

  return { actualDuplicatePairsMatched, separatePolicyPairsDifferent };
}

async function applyUpdates(sourceId: number, rows: PlannedUpdate[]) {
  let updatedCount = 0;
  for (let index = 0; index < rows.length; index += UPDATE_CONCURRENCY) {
    const chunk = rows.slice(index, index + UPDATE_CONCURRENCY);
    const counts = await Promise.all(
      chunk.map(async (row) => {
        const values: Record<string, unknown> = {
          source_fingerprint: row.sourceFingerprint,
        };
        if (row.regionChanged) {
          values.region = row.region;
          values.regions = row.regions;
        }
        const { data, error } = await supabaseAdmin
          .from("announcements")
          .update(values)
          .eq("id", row.id)
          .eq("source_id", sourceId)
          .eq("source_key", row.sourceKey)
          .select("id");
        if (error) {
          throw new Error(
            `온통청년 fingerprint backfill 실패 (${row.sourceKey}): ${error.message}`,
          );
        }
        return data?.length ?? 0;
      }),
    );
    updatedCount += counts.reduce((sum, count) => sum + count, 0);
  }
  return updatedCount;
}

async function loadYouthCenterSourceId() {
  const { data, error } = await supabaseAdmin
    .from("sources")
    .select("id")
    .eq("code", SOURCE_CODE)
    .single();
  if (error) {
    throw new Error(`온통청년 source 조회 실패: ${error.message}`);
  }
  return Number(data.id);
}

async function hasSourceFingerprintColumn() {
  const { error } = await supabaseAdmin
    .from("announcements")
    .select("source_fingerprint", { head: true })
    .limit(1);
  return !error;
}

async function loadYouthCenterRows(
  sourceId: number,
  schemaReady: boolean,
) {
  const rows: StoredYouthCenterRow[] = [];
  const columns = [
    "id",
    "source_key",
    "title",
    "organization",
    "region",
    "regions",
    "target",
    "summary",
    "apply_start",
    "apply_end",
    "raw_json",
    ...(schemaReady ? ["source_fingerprint"] : []),
  ].join(",");

  for (let from = 0; ; from += DB_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("announcements")
      .select(columns)
      .eq("source_id", sourceId)
      .order("id", { ascending: true })
      .range(from, from + DB_PAGE_SIZE - 1);
    if (error) {
      throw new Error(`온통청년 backfill 대상 조회 실패: ${error.message}`);
    }
    const page = (data ?? []).map((value) => {
      const row = value as unknown as Record<string, unknown>;
      return {
        id: Number(row.id),
        sourceKey: String(row.source_key),
        title: String(row.title),
        organization: nullableString(row.organization),
        region: nullableString(row.region),
        regions: nullableStringArray(row.regions),
        target: nullableString(row.target),
        summary: nullableString(row.summary),
        applyStart: nullableString(row.apply_start),
        applyEnd: nullableString(row.apply_end),
        rawJson: objectValue(row.raw_json),
        sourceFingerprint: nullableString(row.source_fingerprint),
      };
    });
    rows.push(...page);
    if (page.length < DB_PAGE_SIZE) break;
  }
  return rows;
}

async function countCurrentPublicRows(sourceId: number) {
  const { count, error } = await supabaseAdmin
    .from("announcements_public")
    .select("id", { count: "exact", head: true })
    .eq("source_id", sourceId);
  if (error) {
    throw new Error(`온통청년 공개 건수 조회 실패: ${error.message}`);
  }
  return count ?? 0;
}

function rawOriginal(rawJson: Record<string, unknown>) {
  const original = rawJson.original;
  if (!original || typeof original !== "object" || Array.isArray(original)) {
    throw new Error("raw_json.original이 없어 안전하게 backfill할 수 없습니다.");
  }
  return original as YouthCenterRawRecord;
}

function requireAuditRow(rows: Map<string, PlannedUpdate>, key: string) {
  const row = rows.get(key);
  if (!row) throw new Error(`감사 대상 source_key가 없습니다: ${key}`);
  return row;
}

function sameStringArray(left: string[] | null, right: string[] | null) {
  if (left === null || right === null) return left === right;
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function nullableStringArray(value: unknown) {
  if (!Array.isArray(value)) return null;
  return value.map(String);
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
