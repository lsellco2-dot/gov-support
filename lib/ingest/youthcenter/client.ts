import { load } from "cheerio";
import type {
  YouthCenterFetchResult,
  YouthCenterRawRecord,
} from "./types";

const LEGACY_ENDPOINT = "https://www.youthcenter.go.kr/opi/youthPlcyList.do";
const CURRENT_ENDPOINT = "https://www.youthcenter.go.kr/go/ythip/getPlcy";

// 구형 공식 문서의 display 최대값은 100이다. 현재 API에도 보수적으로 같은 크기를 사용한다.
export const YOUTHCENTER_PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;
const MAX_PAGES = 500;

type ApiVariant = "legacy" | "current";

interface ParsedXmlPage {
  records: YouthCenterRawRecord[];
  total: number | null;
}

class LegacyEndpointUnavailableError extends Error {}

export async function fetchAllYouthCenterPolicies(
  apiKey = process.env.YOUTHCENTER_API_KEY,
): Promise<YouthCenterFetchResult> {
  const key = requireYouthCenterApiKey(apiKey);

  try {
    return await fetchVariant("legacy", key);
  } catch (error) {
    // 2026년 현재 공식 문서에는 새 엔드포인트도 안내된다. 구형 주소가 8080으로
    // 리디렉션되어 사용할 수 없을 때만 같은 키로 새 XML API를 시도한다.
    if (!(error instanceof LegacyEndpointUnavailableError)) throw error;
    return fetchVariant("current", key);
  }
}

export function requireYouthCenterApiKey(value: string | undefined) {
  const key = value?.trim();
  if (!key) {
    throw new Error(
      "YOUTHCENTER_API_KEY 환경변수가 없습니다. .env.local에 온통청년 API 인증키를 설정하세요.",
    );
  }
  return key;
}

async function fetchVariant(
  variant: ApiVariant,
  apiKey: string,
): Promise<YouthCenterFetchResult> {
  const records: YouthCenterRawRecord[] = [];
  const fingerprints = new Set<string>();
  let reportedTotal: number | null = null;
  let pagesFetched = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const parsed = await fetchXmlPage(variant, apiKey, page);
    pagesFetched++;
    if (parsed.total !== null) reportedTotal = parsed.total;
    if (parsed.records.length === 0) break;

    const fingerprint = pageFingerprint(parsed.records);
    if (fingerprints.has(fingerprint)) {
      throw new Error(
        "온통청년 API가 같은 페이지를 반복 반환해 전체 조회를 중단했습니다.",
      );
    }
    fingerprints.add(fingerprint);
    records.push(...parsed.records);

    if (reportedTotal !== null && records.length >= reportedTotal) break;
    if (parsed.records.length < YOUTHCENTER_PAGE_SIZE) break;
  }

  if (pagesFetched >= MAX_PAGES && (reportedTotal === null || records.length < reportedTotal)) {
    throw new Error("온통청년 API 페이지 안전 한도에 도달했습니다.");
  }

  return { apiVariant: variant, records, pagesFetched, reportedTotal };
}

async function fetchXmlPage(
  variant: ApiVariant,
  apiKey: string,
  page: number,
): Promise<ParsedXmlPage> {
  const url = buildPageUrl(variant, apiKey, page);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        cache: "no-store",
        redirect: "manual",
        headers: { Accept: "application/xml,text/xml;q=0.9,*/*;q=0.1" },
        signal: controller.signal,
      });

      if (
        variant === "legacy" &&
        response.status >= 300 &&
        response.status < 400
      ) {
        throw new LegacyEndpointUnavailableError(
          "구형 온통청년 API 주소를 사용할 수 없습니다.",
        );
      }

      if (response.status === 429 || response.status >= 500) {
        if (attempt < MAX_ATTEMPTS) {
          await retryDelay(attempt);
          continue;
        }
      }

      const body = await response.text();
      if (!response.ok) {
        throw new Error(safeApiError(response.status, body, apiKey));
      }
      if (looksLikeJson(body, response.headers.get("content-type"))) {
        throw new Error(safeApiError(response.status, body, apiKey));
      }
      return parseYouthCenterXmlPage(body);
    } catch (error) {
      if (error instanceof LegacyEndpointUnavailableError) throw error;
      if (error instanceof Error && error.message.startsWith("온통청년 API HTTP")) {
        throw error;
      }
      if (attempt >= MAX_ATTEMPTS) {
        throw new Error(
          error instanceof DOMException && error.name === "AbortError"
            ? "온통청년 API 요청 시간이 초과되었습니다."
            : "온통청년 API 네트워크 요청에 실패했습니다.",
        );
      }
      await retryDelay(attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("온통청년 API 요청에 실패했습니다.");
}

function buildPageUrl(variant: ApiVariant, apiKey: string, page: number) {
  const url = new URL(variant === "legacy" ? LEGACY_ENDPOINT : CURRENT_ENDPOINT);
  if (variant === "legacy") {
    url.searchParams.set("openApiVlak", apiKey);
    url.searchParams.set("pageIndex", String(page));
    url.searchParams.set("display", String(YOUTHCENTER_PAGE_SIZE));
  } else {
    url.searchParams.set("apiKeyNm", apiKey);
    url.searchParams.set("pageNum", String(page));
    url.searchParams.set("pageSize", String(YOUTHCENTER_PAGE_SIZE));
    url.searchParams.set("pageType", "1");
    url.searchParams.set("rtnType", "xml");
  }
  return url;
}

export function parseYouthCenterXmlPage(xml: string): ParsedXmlPage {
  if (!xml.trim().startsWith("<")) {
    throw new Error("온통청년 API가 XML이 아닌 응답을 반환했습니다.");
  }

  const $ = load(xml, { xmlMode: true });
  const errorCode = firstText($, [
    "errorCode",
    "resultCode",
    "returnCode",
    "errCode",
  ]);
  const errorMessage = firstText($, [
    "errorMsg",
    "resultMessage",
    "returnMessage",
    "errMsg",
  ]);
  if (errorCode && !/^(0|00|200|success)$/i.test(errorCode)) {
    throw new Error(
      `온통청년 API 응답 오류(${safeCode(errorCode)}): ${
        errorMessage ? redactUrl(errorMessage) : "상세 메시지 없음"
      }`,
    );
  }

  const records: YouthCenterRawRecord[] = [];
  const seenNodes = new Set<unknown>();
  const likelyRecordNames = ["youthPolicy", "item", "policy", "plcy"];
  for (const selector of likelyRecordNames) {
    $(selector).each((_index, element) => {
      if (seenNodes.has(element)) return;
      const record = elementToRecord($, element);
      if (!looksLikePolicyRecord(record)) return;
      seenNodes.add(element);
      records.push(record);
    });
  }

  if (records.length === 0) {
    $("*").each((_index, element) => {
      if (seenNodes.has(element)) return;
      const record = elementToRecord($, element);
      if (!looksLikePolicyRecord(record)) return;
      seenNodes.add(element);
      records.push(record);
    });
  }

  const totalText = firstText($, [
    "totalCount",
    "totalCnt",
    "total",
    "resultCnt",
    "totCnt",
  ]);
  const total = totalText && /^\d+$/.test(totalText)
    ? Number(totalText)
    : null;
  return { records, total };
}

function elementToRecord(
  $: ReturnType<typeof load>,
  element: any,
) {
  const record: YouthCenterRawRecord = {};
  $(element)
    .children()
    .each((_index, child) => {
      const tag = child.type === "tag" ? child.name : "";
      if (!tag) return;
      const value = $(child).text().trim();
      const existing = record[tag];
      if (existing === undefined) record[tag] = value;
      else if (Array.isArray(existing)) existing.push(value);
      else record[tag] = [existing, value];
    });
  return record;
}

function looksLikePolicyRecord(record: YouthCenterRawRecord) {
  const keys = new Set(Object.keys(record).map((key) => key.toLowerCase()));
  const hasId = ["plcyno", "bizid", "polybizid", "srchpolicyid"].some((key) =>
    keys.has(key)
  );
  const hasTitle = ["plcynm", "polybizsjnm", "title"].some((key) =>
    keys.has(key)
  );
  return hasId && hasTitle;
}

function firstText(
  $: ReturnType<typeof load>,
  selectors: string[],
) {
  for (const selector of selectors) {
    const text = $(selector).first().text().trim();
    if (text) return text;
  }
  return null;
}

function pageFingerprint(records: YouthCenterRawRecord[]) {
  const ids = records.map((record) =>
    scalar(record.plcyNo) ??
    scalar(record.bizId) ??
    scalar(record.polyBizId) ??
    scalar(record.plcyNm) ??
    scalar(record.polyBizSjnm) ??
    "",
  );
  return `${records.length}:${ids[0] ?? ""}:${ids.at(-1) ?? ""}`;
}

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function safeApiError(status: number, body: string, apiKey: string) {
  let code = "";
  let message = "";
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    code = String(parsed.errorCode ?? parsed.resultCode ?? "");
    message = String(parsed.errorMsg ?? parsed.resultMessage ?? "");
  } catch {
    // XML 또는 HTML 오류 본문은 로그에 싣지 않는다.
  }
  const suffix = [safeCode(code), redactUrl(message.replaceAll(apiKey, "[REDACTED]"))]
    .filter(Boolean)
    .join(": ");
  return `온통청년 API HTTP ${status}${suffix ? ` (${suffix})` : ""}`;
}

function safeCode(value: string) {
  return value.replace(/[^a-z0-9_-]/gi, "").slice(0, 40);
}

function redactUrl(value: string) {
  return value
    .replace(/https?:\/\/\S+/gi, "[URL]")
    .replace(/(openApiVlak|apiKeyNm)=[^&\s]+/gi, "$1=[REDACTED]")
    .slice(0, 200);
}

function looksLikeJson(body: string, contentType: string | null) {
  return contentType?.includes("application/json") || /^[\s\n]*[{[]/.test(body);
}

async function retryDelay(attempt: number) {
  await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** (attempt - 1)));
}
