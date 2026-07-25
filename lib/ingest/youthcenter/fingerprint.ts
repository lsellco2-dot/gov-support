import { createHash } from "node:crypto";

export interface YouthCenterFingerprintInput {
  title: string | null;
  organization: string | null;
  regions: string[] | null;
  applyStart: string | null;
  applyEnd: string | null;
  summary: string | null;
  target: string | null;
}

export function createYouthCenterSourceFingerprint(
  input: YouthCenterFingerprintInput,
) {
  const regions = [...new Set(
    (input.regions ?? []).map(normalizeFingerprintText).filter(Boolean),
  )].sort();
  const normalized = [
    normalizeFingerprintText(input.title),
    normalizeFingerprintText(input.organization),
    regions.join(","),
    normalizeFingerprintText(input.applyStart),
    normalizeFingerprintText(input.applyEnd),
    normalizeFingerprintText(input.summary),
    normalizeFingerprintText(input.target),
  ];
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export function normalizeFingerprintText(
  value: string | null | undefined,
) {
  if (!value) return "";
  return decodeHtmlEntities(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(?:p|div|li|tr|h[1-6])>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^0-9a-z가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;|&#38;/gi, "&")
    .replace(/&lt;|&#60;/gi, "<")
    .replace(/&gt;|&#62;/gi, ">")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}
