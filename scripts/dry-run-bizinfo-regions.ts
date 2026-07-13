import { loadEnvConfig } from "@next/env";
import { supabaseAdmin } from "../lib/supabase/server";
import {
  BIZINFO_REGIONS,
  inferBizinfoRegion,
  type BizinfoRegionResult,
} from "../lib/ingest/adapters/bizinfo-region";

loadEnvConfig(process.cwd());

const PAGE_SIZE = 500;
const SAMPLE_SIZE = 5;

interface BizinfoRow {
  id: number;
  title: string;
  region: string | null;
  target: string | null;
  summary: string | null;
  detail_content: string | null;
}

async function main() {
  const rows: BizinfoRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("announcements")
      .select("id,title,region,target,summary,detail_content")
      .eq("source_id", 1)
      .order("id", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`기업마당 조회 실패: ${error.message}`);
    rows.push(...((data ?? []) as BizinfoRow[]));
    if (!data || data.length < PAGE_SIZE) break;
  }

  const analyzed = rows.map((row) => ({
    row,
    result: inferBizinfoRegion({
      title: row.title,
      target: row.target,
      summary: row.summary,
      detailContent: row.detail_content,
    }),
  }));

  const singleRegion = analyzed.filter(({ result }) =>
    BIZINFO_REGIONS.includes(result.region as (typeof BIZINFO_REGIONS)[number])
  );
  const nationwide = analyzed.filter(({ result }) => result.region === "전국");
  const unknown = analyzed.filter(({ result }) => result.region === "미확인");
  const conflicts = analyzed.filter(
    ({ result }) => result.reason === "conflict_or_multiple"
  );
  const changed = analyzed.filter(({ row, result }) => row.region !== result.region);

  console.log("[기업마당 지역 추론 dry-run: DB 쓰기 없음]");
  console.log(
    JSON.stringify(
      {
        total: analyzed.length,
        singleRegion: singleRegion.length,
        nationwide: nationwide.length,
        unknown: unknown.length,
        changedFromCurrent: changed.length,
        conflictOrMultiple: conflicts.length,
        byRegion: Object.fromEntries(
          BIZINFO_REGIONS.map((region) => [
            region,
            analyzed.filter(({ result }) => result.region === region).length,
          ])
        ),
      },
      null,
      2
    )
  );

  printSamples("단일 지역", singleRegion);
  printSamples("전국", nationwide);
  printSamples("미확인", unknown);
  printSamples("충돌/복수 범위", conflicts);
}

function printSamples(
  label: string,
  values: Array<{ row: BizinfoRow; result: BizinfoRegionResult }>
) {
  console.log(`\n[${label} 샘플: 최대 ${SAMPLE_SIZE}건]`);
  console.log(
    JSON.stringify(
      values.slice(0, SAMPLE_SIZE).map(({ row, result }) => ({
        id: row.id,
        title: row.title,
        region: result.region,
        reason: result.reason,
        evidenceField: result.evidenceField,
        evidenceSnippet: result.evidenceSnippet,
        candidates: result.candidates,
        hasNationwideEvidence: result.hasNationwideEvidence,
      })),
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "지역 dry-run 실패");
  process.exitCode = 1;
});
