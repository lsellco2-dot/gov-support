import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.env.AISUP_ENV_DIR ?? process.cwd());
  const args = process.argv.slice(2);
  if (args.some(arg => !/^--source=[a-z,-]+$|^--limit=\d+$|^--all$|^--apply$/.test(arg))) {
    throw new Error("사용법: --source=mois,culture --limit=20 또는 --all [--apply]");
  }
  const { expandedAdapters } = await import("../lib/ingest/adapters/expanded");
  const { moisBenefit } = await import("../lib/ingest/adapters/mois-benefit");
  const { toRow } = await import("../lib/ingest/run");
  const available = [moisBenefit, ...expandedAdapters];
  const requested = args.find(arg => arg.startsWith("--source="))?.slice(9).split(",");
  if (!requested?.length || requested.some(code => !available.some(adapter => adapter.sourceCode === code))) {
    throw new Error(`--source 필요: ${available.map(a => a.sourceCode).join(",")}`);
  }
  const all = args.includes("--all");
  const limit = Number(args.find(arg => arg.startsWith("--limit="))?.slice(8) ?? 20);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50000) throw new Error("limit은 1~50000");
  if (args.includes("--apply")) {
    if (!all || args.some(arg => arg.startsWith("--limit="))) throw new Error("실제 수집은 --all --apply로 명시해야 합니다. --limit 적용은 지원하지 않습니다.");
    const { runIngest } = await import("../lib/ingest/run");
    const results = await runIngest(requested);
    console.log(JSON.stringify({ mode: "apply", results }, null, 2));
    if (results.some(r => r.error || r.failed || r.detailsFailed)) process.exitCode = 1;
    return;
  }
  for (const adapter of available.filter(a => requested.includes(a.sourceCode))) {
    const key = (adapter.keyEnv && process.env[adapter.keyEnv]) || process.env.DATA_GO_KR_KEY || "";
    const start = performance.now();
    let pages = 0, received = 0, normalized = 0, storageRowsValidated = 0, withInlineDetails = 0, truncated = false;
    const ids = new Set<string>();
    let duplicates = 0;
    const samples: { id: string; title: string; region: string | null }[] = [];
    const fields: Record<string, number> = {};
    try {
      if (!key && adapter.sourceCode !== "culture") throw new Error("API_KEY_MISSING");
      for await (const page of adapter.fetchPages({ serviceKey: key })) {
        pages++;
        for (const raw of page) {
          if (!all && received >= limit) { truncated = true; break; }
          received++;
          const item = adapter.normalize(raw);
          if (!item) continue;
          normalized++;
          // 변환만 확인한다. 이 가상 ID로 DB 등록/저장 요청을 보내지 않는다.
          const row = toRow(item, 99);
          if (!row.source_key || !row.title || !row.content_hash || !JSON.stringify(row.raw_json)) throw new Error("STORAGE_ROW_INVALID");
          storageRowsValidated++;
          if (ids.has(item.sourceKey)) duplicates++;
          ids.add(item.sourceKey);
          if (item.detail) withInlineDetails++;
          const field = adapter.sourceCode === "mois" ? String((raw as Record<string, unknown>).서비스분야 ?? "미분류") : (item.supportType ?? "미분류");
          fields[field] = (fields[field] ?? 0) + 1;
          if (samples.length < 3) samples.push({ id: item.sourceKey, title: item.title, region: item.region });
        }
        if (!all && received >= limit) { truncated = true; break; }
      }
      if (received > 0 && normalized === 0) throw new Error("SOURCE_MAPPING_EMPTY");
      console.log(JSON.stringify({ mode: "dry-run", source: adapter.sourceCode, pages, received, normalized, storageRowsValidated, withInlineDetails, duplicates, truncated, fields, samples, durationMs: Math.round(performance.now() - start) }, null, 2));
    } catch (error) {
      // Allowlisted diagnostic identifiers only; provider responses and keys are never printed.
      const message = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "SOURCE_FAILED";
      console.log(JSON.stringify({ mode: "dry-run", source: adapter.sourceCode, pages, received, error: message }));
      process.exitCode = 1;
    }
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "수집 검증 실패"); process.exitCode = 1; });
