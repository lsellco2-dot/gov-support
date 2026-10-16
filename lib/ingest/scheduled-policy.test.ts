import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { sourcePayloadHash } from "./detail";
import { BOKJI_DAILY_LIMITS, parseScheduledOptions, runClaimedJob, selectBokjiDetails, type BokjiDetailRow } from "./scheduled-policy";

const now = Date.parse("2026-10-16T01:00:00Z");
const day = 86_400_000;
const date = (days: number) => new Date(now - days * day).toISOString();
function row(id: number, fields: Partial<BokjiDetailRow> = {}): BokjiDetailRow {
  return { id, source_key: String(id), raw_json: { servId: String(id) }, detail_source_hash: null,
    detail_fetched_at: null, detail_fetch_attempted_at: null, ...fields };
}

test("정기 수집은 기본 dry-run이며 허용 출처/명시 apply만 지원한다", () => {
  assert.deepEqual(parseScheduledOptions(["--source=enara"]), { source: "enara", apply: false });
  assert.equal(parseScheduledOptions(["--source=bokji-local", "--apply"]).apply, true);
  for (const args of [[], ["--source=mois"], ["--source=enara", "--limit=9999"], ["--source=enara", "--source=enara"]]) {
    assert.throws(() => parseScheduledOptions(args));
  }
});

test("복지로 호출 예산은 중앙 60 / 지방 400을 넘지 않는다", () => {
  const rows = Array.from({ length: 1001 }, (_, id) => row(id));
  for (const source of ["bokji-central", "bokji-local"] as const) {
    const result = selectBokjiDetails(rows, source, now);
    assert.equal(result.pending, 1001);
    assert.equal(result.selected.length, BOKJI_DAILY_LIMITS[source]);
  }
});

test("미시도 우선, 실패 쿨다운, 성공 갱신 30일 및 payload 변경을 구분한다", () => {
  const unchanged = row(1);
  unchanged.detail_source_hash = sourcePayloadHash(unchanged.raw_json, "bokji-central");
  unchanged.detail_fetched_at = date(2);
  const expired = row(2, { detail_fetched_at: date(31), detail_fetch_attempted_at: date(31) });
  expired.detail_source_hash = sourcePayloadHash(expired.raw_json, "bokji-central");
  const changed = row(3, { detail_fetched_at: date(5), detail_fetch_attempted_at: date(5), detail_source_hash: "old" });
  const recentFailure = row(4, { detail_fetch_attempted_at: date(0.5) });
  const oldFailure = row(5, { detail_fetch_attempted_at: date(2) });
  const fresh = row(6);
  assert.deepEqual(selectBokjiDetails([unchanged, expired, changed, recentFailure, oldFailure, fresh], "bokji-central", now).selected.map(r => r.id), [6, 5, 2, 3]);
});

test("실행권이 없거나 DB 조회가 실패하면 API/저장을 실행하지 않는다", async () => {
  let calls = 0;
  const work = async () => { calls++; return 1; };
  const finish = async () => { calls++; };
  assert.deepEqual(await runClaimedJob(async () => null, work, finish), { skipped: true });
  await assert.rejects(runClaimedJob(async () => { throw Error("DB"); }, work, finish));
  assert.equal(calls, 0);
});

test("실행 실패는 기록하고 자동 재시도하지 않는다", async () => {
  let calls = 0;
  const states: string[] = [];
  await assert.rejects(runClaimedJob(async () => "run", async () => { calls++; throw Error("API"); }, async (_, state) => { states.push(state); }));
  assert.equal(calls, 1);
  assert.deepEqual(states, ["failed"]);
});

test("성공 결과 집계만 저장하며 같은 실행을 다시 호출하지 않는다", async () => {
  const result = { fetched: 3 };
  const stored: unknown[] = [];
  const outcome = await runClaimedJob(async () => "run", async () => result, async (...args) => { stored.push(args); });
  assert.deepEqual(outcome, { skipped: false, result });
  assert.deepEqual(stored, [["run", "success", result]]);
});

test("워크플로는 master 및 보호 환경에서만 실행하고 PR/무제한 재시도를 허용하지 않는다", () => {
  const workflow = readFileSync(".github/workflows/expanded-sources.yml", "utf8");
  assert.match(workflow, /refs\/heads\/master/);
  assert.match(workflow, /environment: production-ingestion/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.doesNotMatch(workflow, /pull_request|retry|--force/);
  assert.equal((workflow.match(/uses: .+@[a-f0-9]{40}/g) ?? []).length, 2);
});

test("실행권 테이블은 RLS 및 service_role 전용이고 날짜 UNIQUE로 원자적 중복 차단", () => {
  const sql = readFileSync("supabase/migrations/20261016011445_scheduled_source_jobs.sql", "utf8");
  assert.match(sql, /enable row level security/);
  assert.match(sql, /unique \(job_key, run_date\)/);
  assert.match(sql, /security invoker set search_path = ''/);
  assert.match(sql, /revoke all on function .* from public, anon, authenticated/);
  assert.doesNotMatch(sql, /security definer|grant .* to authenticated/);
});
