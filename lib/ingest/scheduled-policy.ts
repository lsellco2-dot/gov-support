import { sourcePayloadHash } from "./detail";

export const BOKJI_DAILY_LIMITS = { "bokji-central": 60, "bokji-local": 400 } as const;
export type ScheduledSource = "enara" | keyof typeof BOKJI_DAILY_LIMITS;
const DAY_MS = 86_400_000;

export interface BokjiDetailRow {
  id: number;
  source_key: string;
  raw_json: unknown;
  detail_source_hash: string | null;
  detail_fetched_at: string | null;
  detail_fetch_attempted_at: string | null;
}

export function parseScheduledOptions(args: string[]) {
  if (args.some(arg => !/^--source=(enara|bokji-central|bokji-local)$|^--apply$|^--recover-enara$/.test(arg)) ||
      args.filter(arg => arg.startsWith("--source=")).length !== 1 ||
      args.filter(arg => arg === "--apply").length > 1) {
    throw new Error("SCHEDULED_OPTIONS_INVALID");
  }
  const source = args.find(arg => arg.startsWith("--source="))!.slice(9) as ScheduledSource;
  const recover = args.includes("--recover-enara");
  if (recover && (source !== "enara" || !args.includes("--apply") || args.filter(arg => arg === "--recover-enara").length > 1)) throw new Error("SCHEDULED_OPTIONS_INVALID");
  return { source, apply: args.includes("--apply"), recover };
}

export function canRecoverEnara(status: string, summary: Record<string, unknown>) {
  return status === "failed" && summary.manualRecovery !== true;
}

export function selectBokjiDetails(rows: BokjiDetailRow[], source: keyof typeof BOKJI_DAILY_LIMITS, now = Date.now()) {
  const eligible = rows.filter(row => {
    const attempted = Date.parse(row.detail_fetch_attempted_at ?? "");
    if (Number.isFinite(attempted) && now - attempted < DAY_MS) return false;
    return !row.detail_fetched_at ||
      row.detail_source_hash !== sourcePayloadHash(row.raw_json, source) ||
      now - Date.parse(row.detail_fetched_at) >= 30 * DAY_MS;
  }).sort((a, b) => {
    const missing = Number(Boolean(a.detail_fetched_at)) - Number(Boolean(b.detail_fetched_at));
    if (missing) return missing;
    const oldest = (Date.parse(a.detail_fetch_attempted_at ?? "") || 0) - (Date.parse(b.detail_fetch_attempted_at ?? "") || 0);
    return oldest || a.id - b.id;
  });
  return { pending: eligible.length, selected: eligible.slice(0, BOKJI_DAILY_LIMITS[source]) };
}

export async function runClaimedJob<T>(
  claim: () => Promise<string | null>,
  work: () => Promise<T>,
  finish: (id: string, status: "success" | "failed", result?: T) => Promise<void>,
) {
  const id = await claim();
  if (!id) return { skipped: true as const };
  let result: T;
  try { result = await work(); }
  catch (error) { await finish(id, "failed"); throw error; }
  await finish(id, "success", result);
  return { skipped: false as const, result };
}
