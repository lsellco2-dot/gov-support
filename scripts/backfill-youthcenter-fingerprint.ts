import { loadEnvConfig } from "@next/env";
import { runYouthCenterFingerprintBackfill } from "../lib/ingest/youthcenter/fingerprint-backfill";

loadEnvConfig(process.cwd());

const apply = process.argv.includes("--apply");

runYouthCenterFingerprintBackfill(apply)
  .then((report) => {
    console.log(
      apply
        ? "[온통청년 fingerprint·지역 backfill 완료]"
        : "[온통청년 fingerprint·지역 backfill dry-run: DB 쓰기 없음]",
    );
    console.log(JSON.stringify(report, null, 2));
  })
  .catch((error) => {
    const message =
      error instanceof Error
        ? error.message
        : "온통청년 fingerprint backfill 실패";
    console.error(redactSecrets(message));
    process.exitCode = 1;
  });

function redactSecrets(value: string) {
  const secrets = [
    process.env.YOUTHCENTER_API_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ].filter((secret): secret is string => Boolean(secret));
  return secrets.reduce(
    (message, secret) => message.replaceAll(secret, "[REDACTED]"),
    value,
  );
}
