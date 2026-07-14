import type { CheerioAPI } from "cheerio";

const PROXY_PATH = "/api/attachments/msit";
const MSIT_HOST = "www.msit.go.kr";
const MAX_ATTACHMENTS = 50;
const NUMBER_RE = /^\d{1,20}$/;
const SESSION_ID_RE = /^[A-Za-z0-9._-]{8,200}$/;

export interface MsitAttachmentParams {
  nttSeqNo: string;
  atchFileNo: string;
  fileOrd: string;
}

export interface MsitAttachmentLink {
  label: string;
  url: string;
}

export function extractMsitAttachments(
  $: CheerioAPI,
  detailUrl: URL
): MsitAttachmentLink[] {
  const nttSeqNo = detailUrl.searchParams.get("nttSeqNo")?.trim() ?? "";
  if (!NUMBER_RE.test(nttSeqNo)) return [];

  const links: MsitAttachmentLink[] = [];
  const seen = new Set<string>();

  $(".down_file > li").each((_, element) => {
    if (links.length >= MAX_ATTACHMENTS) return;
    const item = $(element);
    const invocation = parseMsitDownloadInvocation(
      item.find(".down_btn a[onclick*='fn_download']").first().attr("onclick") ?? ""
    );
    if (!invocation) return;

    const key = `${invocation.atchFileNo}:${invocation.fileOrd}`;
    if (seen.has(key)) return;
    seen.add(key);

    const label = normalizeLabel(
      item.find("a[class*='ico_file_']").first().text()
    );
    links.push({
      label: label || `첨부파일 ${links.length + 1}`,
      url: buildMsitAttachmentProxyUrl({ nttSeqNo, ...invocation }),
    });
  });

  return links;
}

export function parseMsitDownloadInvocation(value: string) {
  const match = value.match(
    /fn_download\(\s*['"](\d{1,20})['"]\s*,\s*['"](\d{1,20})['"]\s*,\s*['"][A-Za-z0-9]{1,12}['"]\s*\)/i
  );
  if (!match) return null;
  return { atchFileNo: match[1], fileOrd: match[2] };
}

export function parseMsitAttachmentParams(
  searchParams: URLSearchParams
): MsitAttachmentParams | null {
  const params = {
    nttSeqNo: searchParams.get("nttSeqNo")?.trim() ?? "",
    atchFileNo: searchParams.get("atchFileNo")?.trim() ?? "",
    fileOrd: searchParams.get("fileOrd")?.trim() ?? "",
  };
  if (
    !NUMBER_RE.test(params.nttSeqNo) ||
    !NUMBER_RE.test(params.atchFileNo) ||
    !NUMBER_RE.test(params.fileOrd)
  ) {
    return null;
  }
  return params;
}

export function buildMsitAttachmentProxyUrl(params: MsitAttachmentParams) {
  const searchParams = new URLSearchParams({
    nttSeqNo: params.nttSeqNo,
    atchFileNo: params.atchFileNo,
    fileOrd: params.fileOrd,
  });
  return `${PROXY_PATH}?${searchParams.toString()}`;
}

export function normalizeMsitAttachmentProxyUrl(value: string) {
  if (!value.startsWith(`${PROXY_PATH}?`)) return null;
  try {
    const url = new URL(value, "https://gov-support.invalid");
    if (url.origin !== "https://gov-support.invalid" || url.pathname !== PROXY_PATH) {
      return null;
    }
    const params = parseMsitAttachmentParams(url.searchParams);
    return params ? buildMsitAttachmentProxyUrl(params) : null;
  } catch {
    return null;
  }
}

export function buildMsitDetailUrl(nttSeqNo: string) {
  if (!NUMBER_RE.test(nttSeqNo)) throw new Error("invalid nttSeqNo");
  const url = new URL(`https://${MSIT_HOST}/bbs/view.do`);
  url.search = new URLSearchParams({
    sCode: "user",
    mId: "311",
    mPid: "121",
    bbsSeqNo: "100",
    nttSeqNo,
  }).toString();
  return url;
}

export function pageContainsMsitAttachment(
  html: string,
  atchFileNo: string,
  fileOrd: string
) {
  if (!NUMBER_RE.test(atchFileNo) || !NUMBER_RE.test(fileOrd)) return false;
  const escapedFileNo = escapeRegExp(atchFileNo);
  const escapedOrder = escapeRegExp(fileOrd);
  return new RegExp(
    `fn_download\\(\\s*['"]${escapedFileNo}['"]\\s*,\\s*['"]${escapedOrder}['"]\\s*,`,
    "i"
  ).test(html);
}

export function extractMsitSessionId(setCookie: string | null, html: string) {
  const fromCookie = setCookie?.match(/(?:^|[,;]\s*)JSESSIONID=([^;,\s]+)/i)?.[1];
  const fromHtml = html.match(/;jsessionid=([^?'"\s;]+)/i)?.[1];
  const value = fromCookie ?? fromHtml ?? "";
  return SESSION_ID_RE.test(value) ? value : null;
}

export function buildMsitSessionDownloadUrl(
  sessionId: string,
  atchFileNo: string,
  fileOrd: string
) {
  if (
    !SESSION_ID_RE.test(sessionId) ||
    !NUMBER_RE.test(atchFileNo) ||
    !NUMBER_RE.test(fileOrd)
  ) {
    throw new Error("invalid MSIT download parameters");
  }
  const url = new URL(
    `https://${MSIT_HOST}/ssm/file/fileDown.do;jsessionid=${sessionId}`
  );
  url.search = new URLSearchParams({
    atchFileNo,
    fileOrd,
    fileBtn: "A",
  }).toString();
  return url;
}

function normalizeLabel(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 300);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
