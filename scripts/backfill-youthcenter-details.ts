import { loadEnvConfig } from "@next/env";
import {
  fetchAndStoreYouthCenterDetails,
  loadYouthCenterDetailCandidates,
} from "../lib/ingest/youthcenter/detail-store";
import { ensureYouthCenterSource } from "../lib/ingest/youthcenter/store";

loadEnvConfig(process.cwd());

async function main() {
  const apply = process.argv.includes("--apply");
  const all = process.argv.includes("--all");
  const limit = all ? null : readLimit(process.argv) ?? 20;
  const source = await ensureYouthCenterSource();
  const selection = await loadYouthCenterDetailCandidates(source.sourceId, {
    limit,
  });

  console.log(
    JSON.stringify({
      mode: apply ? "apply" : "dry-run",
      selected: selection.candidates.length,
      totalEligible: selection.totalEligible,
      skippedCooldown: selection.skippedCooldown,
    }),
  );
  if (!apply || selection.candidates.length === 0) return;

  let lastReported = 0;
  const result = await fetchAndStoreYouthCenterDetails(
    selection.candidates,
    source.sourceId,
    (progress) => {
      if (
        progress.processed === progress.total ||
        progress.processed - lastReported >= 10
      ) {
        lastReported = progress.processed;
        console.log(JSON.stringify({ progress }));
      }
    },
  );
  const remaining = await loadYouthCenterDetailCandidates(source.sourceId, {
    limit: null,
  });
  console.log(
    JSON.stringify({
      result,
      remainingEligible: remaining.totalEligible,
      remainingCooldown: remaining.skippedCooldown,
    }),
  );
}

function readLimit(args: string[]) {
  const value = args.find((arg) => arg.startsWith("--limit="));
  if (!value) return null;
  const parsed = Number(value.slice("--limit=".length));
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 2_000) {
    throw new Error("--limit must be an integer between 1 and 2000.");
  }
  return parsed;
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      error:
        error instanceof Error
          ? error.message.slice(0, 300)
          : "온통청년 원문 백필 실패",
    }),
  );
  process.exitCode = 1;
});
