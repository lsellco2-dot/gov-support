import { supabaseAdmin } from "@/lib/supabase/server";
import { adapters } from "./adapters";
import { mapCategories } from "./category";
import { contentHash } from "./hash";
import { SOURCE_ID, type NormalizedAnnouncement } from "./types";

const CHUNK = 500;

export interface IngestResult {
  source: string;
  upserted: number;
  skipped: number;
  failed: number;
  error?: string;
}

export async function runIngest(only?: string[]): Promise<IngestResult[]> {
  const serviceKey = process.env.DATA_GO_KR_KEY;
  if (!serviceKey) throw new Error("DATA_GO_KR_KEY 환경변수가 없습니다.");

  const targets = adapters.filter(
    (a) => !only || only.length === 0 || only.includes(a.sourceCode)
  );

  const results: IngestResult[] = [];

  for (const adapter of targets) {
    const r: IngestResult = { source: adapter.sourceCode, upserted: 0, skipped: 0, failed: 0 };
    try {
      for await (const page of adapter.fetchPages({ serviceKey })) {
        const rows = [];
        for (const raw of page) {
          const n = adapter.normalize(raw);
          if (!n) { r.skipped++; continue; }
          rows.push(toRow(n));
        }
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK);
          const { error } = await supabaseAdmin
            .from("announcements")
            .upsert(chunk, { onConflict: "source_id,source_key" });
          if (error) {
            r.failed += chunk.length;
            console.error(`[${adapter.sourceCode}] upsert 실패:`, error.message);
          } else {
            r.upserted += chunk.length;
          }
        }
      }
    } catch (e: any) {
      // 어댑터 하나가 실패해도 나머지는 계속
      r.error = e?.message ?? String(e);
      console.error(`[${adapter.sourceCode}] 수집 중단:`, r.error);
    }

    await supabaseAdmin
      .from("sources")
      .update({ last_fetched_at: new Date().toISOString() })
      .eq("code", adapter.sourceCode);

    results.push(r);
  }

  return results;
}

function toRow(n: NormalizedAnnouncement) {
  return {
    source_id: SOURCE_ID[n.sourceCode],
    source_key: n.sourceKey,
    title: n.title,
    organization: n.organization,
    category_ids: mapCategories(n),
    region: n.region ?? "전국",
    target: n.target,
    support_type: n.supportType,
    summary: n.summary,
    apply_start: n.applyStart,
    apply_end: n.applyEnd,
    detail_url: n.detailUrl,
    content_hash: contentHash(n),
    raw_json: n.raw,
    updated_at: new Date().toISOString(),
  };
}
