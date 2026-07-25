import { createHash } from "crypto";
import { sanitizeDisplayText } from "@/lib/text/sanitize";
import { buildYouthCenterPolicyDetailUrl } from "@/lib/youthcenter/url";

const BASE_URL = "https://www.youthcenter.go.kr";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_DETAIL_CHARS = 200_000;
const MAX_ATTACHMENTS = 50;
const PARSER_VERSION = "youthcenter-detail-v1";
const USER_AGENT = "gov-support-youthcenter-detail-collector/1.0";

export interface YouthCenterDetailLink {
  label: string;
  url: string;
}

export interface YouthCenterFetchedDetail {
  detailContent: string;
  applyMethod: string | null;
  documents: string | null;
  contact: string | null;
  attachments: YouthCenterDetailLink[];
  contentHash: string;
}

export class YouthCenterDetailFetchError extends Error {
  constructor(
    message: string,
    readonly publicReason: string,
  ) {
    super(message);
    this.name = "YouthCenterDetailFetchError";
  }
}

let sessionCookiePromise: Promise<string> | null = null;

export async function fetchYouthCenterDetail(
  sourceKey: string,
): Promise<YouthCenterFetchedDetail> {
  const detailUrl = buildYouthCenterPolicyDetailUrl(sourceKey);
  if (!detailUrl) {
    throw new YouthCenterDetailFetchError(
      "Invalid YouthCenter policy identifier.",
      "잘못된 온통청년 정책번호",
    );
  }

  const apiUrl = new URL(
    `/wrk/yrm/plcyInfo/plcy/${encodeURIComponent(sourceKey)}`,
    BASE_URL,
  );
  apiUrl.searchParams.set("user", "true");
  const payload = await requestOfficialJson(apiUrl.toString(), detailUrl);
  const policy = officialPolicy(payload, sourceKey);

  let attachmentPayload: unknown = null;
  const attachmentManager = safeIdentifier(policy.atchFileMngSn);
  if (attachmentManager && attachmentManager !== "0") {
    const attachmentUrl = new URL("/sur/com/atchFile/atchFileDet", BASE_URL);
    attachmentUrl.searchParams.set("atchFileMngSn", attachmentManager);
    attachmentPayload = await requestOfficialJson(
      attachmentUrl.toString(),
      detailUrl,
    );
  }

  return parseYouthCenterDetailPayload(
    sourceKey,
    payload,
    attachmentPayload,
  );
}

export function parseYouthCenterDetailPayload(
  sourceKey: string,
  payload: unknown,
  attachmentPayload: unknown = null,
): YouthCenterFetchedDetail {
  const policy = officialPolicy(payload, sourceKey);
  const applyMethod = cleanText(policy.plcyAplyMthdCn);
  const documents = cleanText(policy.sbmsnDcmntCn);
  const contact = joinLines([
    labeled("주관기관", cleanText(policy.sprvsnInstCdNm)),
    labeled("주관기관 담당자", cleanText(policy.sprvsnInstPicNm)),
    labeled("주관기관 연락처", cleanText(policy.sprvsnInstPicTelno)),
    labeled("운영기관", cleanText(policy.operInstCdNm)),
    labeled("운영기관 담당자", cleanText(policy.operInstPicNm)),
    labeled("운영기관 연락처", cleanText(policy.operInstPicTelno)),
  ]);

  const qualifications = joinLines([
    labeled("연령", ageCondition(policy)),
    labeled("혼인 여부", marriageCondition(policy.mrgSttsCd)),
    labeled("거주 지역", residenceCondition(policy.habRgnList)),
    labeled("소득", incomeCondition(policy)),
    labeled("학력", listNames(policy.qlfcAcbgList, "qlfcAcbgCdNm")),
    labeled("전공", listNames(policy.mjrCndList, "mjrCndCdNm")),
    labeled("취업 상태", listNames(policy.empmSttsList, "empmSttsCdNm")),
    labeled("특화 분야", listNames(policy.spclFldList, "spclFldCdNm")),
    labeled("추가 사항", cleanText(policy.addAplyQlfcCndCn)),
    labeled("참여 제한 대상", cleanText(policy.ptcpPrpTrgtCn)),
  ]);
  const institution = contact;
  const references = joinLines([
    cleanText(policy.refUrlAddr1),
    cleanText(policy.refUrlAddr2),
  ]);
  const registration = joinLines([
    labeled("최초 등록일", formatTimestamp(policy.frstRegDt)),
    labeled("최종 수정일", formatTimestamp(policy.lastMdfcnDt)),
  ]);

  const detailContent = buildSections([
    ["정책 설명", cleanText(policy.plcyExplnCn)],
    ["지원 내용", cleanText(policy.plcySprtCn)],
    ["사업 운영 기간", businessPeriod(policy)],
    ["사업 신청 기간", applicationPeriod(policy)],
    ["지원 규모", supportScale(policy)],
    ["신청 자격", qualifications],
    ["신청 방법", applyMethod],
    ["심사 방법", cleanText(policy.srngMthdCn)],
    ["제출 서류", documents],
    ["기타 사항", cleanText(policy.etcMttrCn)],
    ["기관 정보", institution],
    ["참고 사이트", references],
    ["정보 등록·수정일", registration],
  ]);
  if (!detailContent || detailContent.length < 20) {
    throw new YouthCenterDetailFetchError(
      "YouthCenter detail payload did not contain visible policy content.",
      "온통청년 원문 내용 없음",
    );
  }

  const boundedContent = detailContent.slice(0, MAX_DETAIL_CHARS);
  const attachments = parseAttachmentLinks(attachmentPayload);
  const contentHash = createHash("sha256")
    .update(
      JSON.stringify({
        detailContent: boundedContent,
        applyMethod,
        documents,
        contact,
        attachments,
      }),
    )
    .digest("hex");

  return {
    detailContent: boundedContent,
    applyMethod,
    documents,
    contact,
    attachments,
    contentHash,
  };
}

export function youthCenterDetailSourceHash(rawJson: unknown) {
  return createHash("sha256")
    .update(stableStringify(rawJson))
    .update(`\n${PARSER_VERSION}`)
    .digest("hex");
}

function officialPolicy(payload: unknown, expectedSourceKey: string) {
  const result = record(record(payload)?.result);
  const policy = record(result?.plcy);
  const sourceKey = cleanText(policy?.plcyNo);
  if (!policy || sourceKey !== expectedSourceKey) {
    throw new YouthCenterDetailFetchError(
      "YouthCenter detail response did not match the requested policy.",
      "온통청년 원문 응답 불일치",
    );
  }
  if (
    cleanText(policy.plcyAprvSttsCd) &&
    cleanText(policy.plcyAprvSttsCd) !== "0044002"
  ) {
    throw new YouthCenterDetailFetchError(
      "YouthCenter policy is not publicly approved.",
      "비공개 또는 승인되지 않은 온통청년 정책",
    );
  }
  return policy;
}

async function requestOfficialJson(
  url: string,
  referer: string,
  allowSessionRefresh = true,
): Promise<unknown> {
  const cookie = await getSessionCookie(referer);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Cookie: cookie,
      Referer: referer,
      "User-Agent": USER_AGENT,
      "X-Requested-With": "XMLHttpRequest",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (response.status === 401 && allowSessionRefresh) {
    sessionCookiePromise = null;
    return requestOfficialJson(url, referer, false);
  }
  if (!response.ok) {
    throw new YouthCenterDetailFetchError(
      `YouthCenter detail request failed with HTTP ${response.status}.`,
      `온통청년 원문 HTTP ${response.status}`,
    );
  }

  const body = await boundedResponseText(response);
  try {
    return JSON.parse(body);
  } catch {
    throw new YouthCenterDetailFetchError(
      "YouthCenter detail response was not JSON.",
      "온통청년 원문 응답 형식 오류",
    );
  }
}

async function getSessionCookie(referer: string) {
  if (!sessionCookiePromise) {
    sessionCookiePromise = bootstrapSession(referer).catch((error) => {
      sessionCookiePromise = null;
      throw error;
    });
  }
  return sessionCookiePromise;
}

async function bootstrapSession(referer: string) {
  const response = await fetch(referer, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": USER_AGENT,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new YouthCenterDetailFetchError(
      `YouthCenter session bootstrap failed with HTTP ${response.status}.`,
      `온통청년 원문 페이지 HTTP ${response.status}`,
    );
  }
  await response.body?.cancel();

  const cookieHeaders =
    (
      response.headers as Headers & {
        getSetCookie?: () => string[];
      }
    ).getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
  const cookies = cookieHeaders
    .flatMap((header) => header.split(/,(?=[^;,]+=)/))
    .map((header) => header.split(";", 1)[0]?.trim())
    .filter(Boolean);
  if (cookies.length === 0) {
    throw new YouthCenterDetailFetchError(
      "YouthCenter did not issue a detail session cookie.",
      "온통청년 원문 세션 생성 실패",
    );
  }
  return cookies.join("; ");
}

async function boundedResponseText(response: Response) {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_RESPONSE_BYTES) {
    throw new YouthCenterDetailFetchError(
      "YouthCenter detail response was too large.",
      "온통청년 원문 응답 크기 초과",
    );
  }
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) {
    throw new YouthCenterDetailFetchError(
      "YouthCenter detail response was too large.",
      "온통청년 원문 응답 크기 초과",
    );
  }
  return text;
}

function parseAttachmentLinks(payload: unknown): YouthCenterDetailLink[] {
  const result = record(record(payload)?.result);
  const list = Array.isArray(result?.atchFileDetList)
    ? result.atchFileDetList
    : [];
  const links: YouthCenterDetailLink[] = [];

  for (const item of list.slice(0, MAX_ATTACHMENTS)) {
    const row = record(item);
    const manager = safeIdentifier(row?.atchFileMngSn);
    const file = safeIdentifier(row?.atchFileSn);
    if (!manager || !file) continue;
    const label =
      cleanText(row?.exsFileNm) ??
      cleanText(row?.atchFileNm) ??
      `첨부파일 ${links.length + 1}`;
    links.push({
      label,
      url: `${BASE_URL}/sur/com/atchFile/atchFileDetInfo/${manager}/${file}`,
    });
  }
  return uniqueLinks(links);
}

function buildSections(
  entries: Array<[label: string, value: string | null]>,
) {
  const sections = entries
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([label, value]) => `[${label}]\n${value}`);
  return sections.length > 0 ? sections.join("\n\n") : null;
}

function businessPeriod(policy: Record<string, unknown>) {
  if (cleanText(policy.bizPrdSeCd) === "0056002") {
    return cleanText(policy.bizPrdEtcCn);
  }
  return dateRange(policy.bizPrdBgngYmd, policy.bizPrdEndYmd);
}

function applicationPeriod(policy: Record<string, unknown>) {
  if (cleanText(policy.aplyPrdSeCd) === "0057002") return "상시";
  return dateRange(policy.aplyPrdBgngYmd, policy.aplyPrdEndYmd);
}

function supportScale(policy: Record<string, unknown>) {
  if (cleanText(policy.sprtSclLmtYn) === "Y") return "제한없음";
  const count = Number(policy.sprtSclCnt);
  if (!Number.isFinite(count) || count <= 0) return null;
  return `${Math.floor(count)}명${
    cleanText(policy.sprtArvlSeqYn) === "Y" ? " (선착순)" : ""
  }`;
}

function ageCondition(policy: Record<string, unknown>) {
  if (cleanText(policy.sprtTrgtAgeLmtYn) === "Y") return "제한없음";
  const min = Number(policy.sprtTrgtMinAge);
  const max = Number(policy.sprtTrgtMaxAge);
  if (Number.isFinite(min) && min > 0 && Number.isFinite(max) && max > 0) {
    return `만 ${Math.floor(min)}세 ~ 만 ${Math.floor(max)}세`;
  }
  if (Number.isFinite(min) && min > 0) return `만 ${Math.floor(min)}세 이상`;
  if (Number.isFinite(max) && max > 0) return `만 ${Math.floor(max)}세 이하`;
  return null;
}

function marriageCondition(value: unknown) {
  const code = cleanText(value);
  if (code === "0055001") return "기혼";
  if (code === "0055002") return "미혼";
  if (code === "0055003") return "제한없음";
  return null;
}

function residenceCondition(value: unknown) {
  if (!Array.isArray(value)) return null;
  const regions = value
    .map((item) => {
      const row = record(item);
      return joinWords([
        cleanText(row?.stdgCtpvCdNm),
        cleanText(row?.stdgSggCdNm),
      ]);
    })
    .filter((item): item is string => Boolean(item));
  const unique = Array.from(new Set(regions));
  if (unique.length >= 200) return "전국";
  return unique.length > 0 ? unique.join(", ") : null;
}

function incomeCondition(policy: Record<string, unknown>) {
  const code = cleanText(policy.earnCndSeCd);
  if (code === "0043001") return "무관";
  if (code === "0043002") {
    const min = Number(policy.earnMinAmt);
    const max = Number(policy.earnMaxAmt);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      return `연소득 ${Math.floor(min)}만원 이상 ~ ${Math.floor(max)}만원 이하`;
    }
  }
  return cleanText(policy.earnEtcCn);
}

function listNames(value: unknown, key: string) {
  if (!Array.isArray(value)) return null;
  const names = value
    .map((item) => cleanText(record(item)?.[key]))
    .filter((item): item is string => Boolean(item));
  const unique = Array.from(new Set(names));
  return unique.length > 0 ? unique.join(", ") : null;
}

function dateRange(start: unknown, end: unknown) {
  const startDate = formatDate(start);
  const endDate = formatDate(end);
  if (!startDate && !endDate) return null;
  return `${startDate ?? "시작일 미정"} ~ ${endDate ?? "종료일 미정"}`;
}

function formatDate(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function formatTimestamp(value: unknown) {
  const text = cleanText(value);
  if (!text) return null;
  const match = text.match(
    /^(\d{4})[-.]?(\d{2})[-.]?(\d{2})(?:[T\s](\d{2}):?(\d{2}))?/,
  );
  if (!match) return text;
  return `${match[1]}-${match[2]}-${match[3]}${
    match[4] && match[5] ? ` ${match[4]}:${match[5]}` : ""
  }`;
}

function cleanText(value: unknown) {
  if (value === null || value === undefined) return null;
  const cleaned = sanitizeDisplayText(String(value))
    ?.replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned || null;
}

function labeled(label: string, value: string | null) {
  return value ? `${label}: ${value}` : null;
}

function joinLines(values: Array<string | null>) {
  const lines = values.filter((value): value is string => Boolean(value));
  return lines.length > 0 ? lines.join("\n") : null;
}

function joinWords(values: Array<string | null>) {
  const words = values.filter((value): value is string => Boolean(value));
  return words.length > 0 ? words.join(" ") : null;
}

function safeIdentifier(value: unknown) {
  const candidate = String(value ?? "").trim();
  return /^\d{1,30}$/.test(candidate) ? candidate : null;
}

function uniqueLinks(links: YouthCenterDetailLink[]) {
  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  });
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
    .join(",")}}`;
}
