import { createHash } from "crypto";
import { load, type Cheerio, type CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import { B_CLOSE, B_OPEN, EM_CLOSE, EM_OPEN } from "@/lib/text/emphasis";
import type { NormalizedAnnouncement, SourceCode } from "./types";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_DETAIL_CHARS = 200_000;
const MAX_ATTACHMENTS = 50;

const SOURCE_HOSTS: Record<SourceCode, string[]> = {
  bizinfo: ["bizinfo.go.kr"],
  kstartup: ["k-startup.go.kr"],
  mss: ["mss.go.kr", "bizinfo.go.kr", "smba.go.kr", "smes.go.kr", "smtech.go.kr"],
  mois: ["gov.kr", "gov24.go.kr"],
  msit: ["msit.go.kr"],
};

const SOURCE_SELECTORS: Record<SourceCode, string[]> = {
  bizinfo: [".board_view", ".view_cont", ".view-content", "#contents", "main"],
  kstartup: ["#content", "#contents", ".contents", "main"],
  mss: [".board_view", ".view_cont", "#contents", "main"],
  // 정부24 혜택 상세는 .tab-content 패널들이 실제 본문(주요내용/지원대상/지원내용/신청방법)이다.
  mois: [".tab-content", "#contents", ".content", "main", "article"],
  msit: [".board_view", ".view_cont", "#contents", "main"],
};

const KSTARTUP_ALTERNATE_SELECTORS = [
  ".content",
  ".sub",
  ".sub_cont",
  ".sub-content",
  ".board_view",
  ".view_cont",
  ".view-content",
  ".view_content",
  "article",
];

export interface StoredDetailLink {
  label: string;
  url: string;
}

export interface FetchedAnnouncementDetail {
  detailContent: string;
  applyMethod: string | null;
  documents: string | null;
  contact: string | null;
  attachments: StoredDetailLink[];
  contentHash: string;
}

export class DetailFetchError extends Error {
  constructor(
    message: string,
    readonly publicReason: string
  ) {
    super(message);
  }
}

export async function fetchAnnouncementDetail(
  announcement: NormalizedAnnouncement
): Promise<FetchedAnnouncementDetail> {
  const initialUrl = validateDetailUrl(announcement.sourceCode, announcement.detailUrl);
  const { html, finalUrl, status } = await fetchHtml(initialUrl, announcement.sourceCode);
  const $ = load(html);
  const pageSignals = {
    hasIframe: $("iframe").length > 0,
    isLoginPage:
      $("input[type='password']").length > 0 ||
      $("form[action*='login'],form[action*='lgin']").length > 0,
    isJavascriptApp: $("#root,#__next,#app,[data-reactroot]").length > 0,
  };
  removeNonContent($);

  const sectionDetails =
    announcement.sourceCode === "kstartup" ? extractKstartupSections($) : emptySections();
  const detailContent =
    sectionDetails.fullText || extractMainText($, SOURCE_SELECTORS[announcement.sourceCode]);
  const attachments = extractAttachments($, finalUrl);

  if (!detailContent || detailContent.length < 20) {
    if (
      announcement.sourceCode === "kstartup" &&
      status === 200 &&
      isKstartupEmptyShell($, attachments, pageSignals)
    ) {
      throw new DetailFetchError(
        "K-Startup 원문이 본문 없는 빈 셸 응답입니다.",
        "empty_shell_200"
      );
    }
    throw new DetailFetchError("상세 본문을 찾지 못했습니다.", "본문 없음");
  }

  const boundedContent = detailContent.slice(0, MAX_DETAIL_CHARS);
  const contentHash = createHash("sha256")
    .update(
      JSON.stringify({
        detailContent: boundedContent,
        applyMethod: sectionDetails.applyMethod,
        documents: sectionDetails.documents,
        contact: sectionDetails.contact,
        attachments,
      })
    )
    .digest("hex");

  return {
    detailContent: boundedContent,
    applyMethod: sectionDetails.applyMethod,
    documents: sectionDetails.documents,
    contact: sectionDetails.contact,
    attachments,
    contentHash,
  };
}

export function sourcePayloadHash(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function validateDetailUrl(source: SourceCode, value: string | null) {
  if (!value) throw new DetailFetchError("원문 URL이 없습니다.", "원문 URL 없음");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new DetailFetchError("원문 URL 형식이 잘못됐습니다.", "잘못된 원문 URL");
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    !isAllowedSourceHost(source, url.hostname)
  ) {
    throw new DetailFetchError("허용되지 않은 원문 URL입니다.", "허용되지 않은 원문 도메인");
  }
  return url;
}

function isAllowedSourceHost(source: SourceCode, hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return SOURCE_HOSTS[source].some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  );
}

async function fetchHtml(initialUrl: URL, source: SourceCode) {
  let currentUrl = initialUrl;

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const response = await fetch(currentUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "gov-support-detail-collector/1.0",
      },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirect === MAX_REDIRECTS) {
        throw new DetailFetchError("원문 리다이렉트를 처리하지 못했습니다.", "리다이렉트 실패");
      }
      currentUrl = validateDetailUrl(source, new URL(location, currentUrl).toString());
      continue;
    }

    if (!response.ok) {
      throw new DetailFetchError(`원문 HTTP ${response.status}`, `HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType && !contentType.includes("html")) {
      throw new DetailFetchError("원문 응답이 HTML이 아닙니다.", "HTML 아님");
    }

    const body = await readBoundedBody(response);
    return {
      html: decodeHtmlBuffer(body, contentType),
      finalUrl: currentUrl,
      status: response.status,
    };
  }

  throw new DetailFetchError("원문 호출에 실패했습니다.", "원문 호출 실패");
}

// 응답 헤더 → 문서 meta charset → utf-8 순으로 문자셋을 결정해 디코딩한다.
// (meta charset이 문서 뒷부분에 있는 사이트에서 자동 스니핑이 windows-1252로
//  잘못 판정해 한글 본문 전체가 깨지는 문제가 있었다.)
function decodeHtmlBuffer(buffer: Buffer, contentType: string | null) {
  const headerCharset = contentType?.match(/charset=["']?([\w-]+)/i)?.[1] ?? null;
  const metaCharset = buffer
    .subarray(0, 8192)
    .toString("latin1")
    .match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i)?.[1] ?? null;
  const charset = normalizeCharset(headerCharset || metaCharset || "utf-8");

  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

function normalizeCharset(value: string) {
  const charset = value.toLowerCase();
  if (charset === "ks_c_5601-1987" || charset === "ksc5601" || charset === "cp949") {
    return "euc-kr";
  }
  return charset;
}

async function readBoundedBody(response: Response) {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_HTML_BYTES) {
    throw new DetailFetchError("원문 응답 크기가 제한을 초과했습니다.", "원문 크기 초과");
  }
  if (!response.body) return Buffer.from(await response.arrayBuffer());

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_HTML_BYTES) {
      await reader.cancel();
      throw new DetailFetchError("원문 응답 크기가 제한을 초과했습니다.", "원문 크기 초과");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
}

function removeNonContent($: CheerioAPI) {
  $("script,style,noscript,template,svg,canvas,iframe,nav,header,footer").remove();
  $("[aria-hidden='true'],.blind,.sr-only,.skip,.breadcrumb,.location").remove();
  // 확인/취소 팝업, 안내 모달 같은 화면에 안 보이는 요소가 본문에 섞이지 않게 제거한다.
  $("[role='dialog'],[aria-modal='true'],.modal,.popup").remove();
  $("[style*='display:none'],[style*='display: none'],[style*='display : none']").remove();
}

function extractMainText($: CheerioAPI, selectors: string[]) {
  for (const selector of selectors) {
    const matches = $(selector);
    if (matches.length === 0) continue;
    const texts = matches
      .toArray()
      .map((element) => elementText($, $(element)))
      .filter((text) => text.length >= 20);
    if (texts.length > 0) return normalizeText(texts.join("\n\n"));
  }
  return elementText($, $("body"));
}

function isKstartupEmptyShell(
  $: CheerioAPI,
  attachments: StoredDetailLink[],
  signals: { hasIframe: boolean; isLoginPage: boolean; isJavascriptApp: boolean }
) {
  const visibleText = elementText($, $("body"));
  const hasCurrentSelector = hasMeaningfulSelector($, [
    ".information_list",
    ...SOURCE_SELECTORS.kstartup,
  ]);
  const hasAlternateSelector = hasMeaningfulSelector($, KSTARTUP_ALTERNATE_SELECTORS);

  return (
    visibleText.length < 20 &&
    !hasCurrentSelector &&
    !hasAlternateSelector &&
    !signals.hasIframe &&
    attachments.length === 0 &&
    !signals.isLoginPage &&
    !signals.isJavascriptApp
  );
}

function hasMeaningfulSelector($: CheerioAPI, selectors: string[]) {
  return selectors.some((selector) =>
    $(selector)
      .toArray()
      .some((element) => elementText($, $(element)).length >= 20)
  );
}

function extractKstartupSections($: CheerioAPI) {
  const sections = $(".information_list")
    .toArray()
    .map((element) => {
      const root = $(element);
      const title = normalizeText(root.find(".title").first().text());
      const body = elementText($, root.find(".dot_list").length ? root.find(".dot_list") : root);
      return title && body ? { title, body } : null;
    })
    .filter(Boolean) as Array<{ title: string; body: string }>;

  const find = (title: string) =>
    sections.find((section) => section.title.includes(title))?.body ?? null;

  return {
    fullText: sections.map((section) => `${section.title}\n${section.body}`).join("\n\n"),
    applyMethod: find("신청방법 및 대상"),
    documents: find("제출서류"),
    contact: find("문의처"),
  };
}

function emptySections() {
  return {
    fullText: "",
    applyMethod: null,
    documents: null,
    contact: null,
  };
}

// 원문에서 빨간 강조·굵은 글씨를 감지해 텍스트 마커로 보존한다.
// (인라인 style color / font-weight, <font color>, <strong>/<b> 기준.
//  CSS 클래스 기반 색상은 서버에서 해석할 수 없어 제외된다.)
function annotateEmphasis($: CheerioAPI, root: Cheerio<AnyNode>) {
  root.find("[style],font[color],strong,b").each((_, element) => {
    const node = $(element);

    // 중첩 강조는 바깥 것 하나만 표시한다.
    if (node.parents("[data-gov-emphasis]").length > 0) return;
    if (!node.text().trim()) return;

    const kind = emphasisKind(node);
    if (!kind) return;

    node.attr("data-gov-emphasis", kind);
    node.prepend(kind === "red" ? EM_OPEN : B_OPEN);
    node.append(kind === "red" ? EM_CLOSE : B_CLOSE);
  });
}

function emphasisKind(node: Cheerio<AnyNode>): "red" | "bold" | null {
  const style = (node.attr("style") ?? "").toLowerCase();
  const fontColor = node.is("font") ? (node.attr("color") ?? "") : "";
  const styleColor = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/)?.[1] ?? "";
  const color = (styleColor || fontColor).trim();

  if (color && isRedColor(color)) return "red";
  if (node.is("strong,b")) return "bold";
  if (/font-weight\s*:\s*(bold|bolder|[7-9]00)/.test(style)) return "bold";
  return null;
}

function isRedColor(value: string) {
  const color = value.toLowerCase().trim();

  if (/^(red|crimson|firebrick|darkred|orangered|tomato|indianred|maroon)$/.test(color)) {
    return true;
  }

  let r = -1;
  let g = -1;
  let b = -1;
  const hex6 = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/);
  const hex3 = color.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  const rgb = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);

  if (hex6) [r, g, b] = [parseInt(hex6[1], 16), parseInt(hex6[2], 16), parseInt(hex6[3], 16)];
  else if (hex3) [r, g, b] = [parseInt(hex3[1] + hex3[1], 16), parseInt(hex3[2] + hex3[2], 16), parseInt(hex3[3] + hex3[3], 16)];
  else if (rgb) [r, g, b] = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  else return false;

  // 빨강 계열: R이 지배적이고 G/B가 낮은 색만 인정
  return r >= 160 && g <= 96 && b <= 96;
}

function elementText($: CheerioAPI, root: Cheerio<AnyNode>) {
  const clone = root.clone();
  annotateEmphasis($, clone);
  clone.find("br").replaceWith("\n");
  clone
    .find("h1,h2,h3,h4,h5,h6,p,li,dt,dd,tr,section,article")
    .each((_, element) => {
      $(element).append("\n");
    });
  return normalizeText(clone.text());
}

function normalizeText(value: string) {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractAttachments($: CheerioAPI, baseUrl: URL) {
  const links: StoredDetailLink[] = [];
  const seen = new Set<string>();

  $("a[href]").each((_, element) => {
    if (links.length >= MAX_ATTACHMENTS) return;
    const anchor = $(element);
    const href = anchor.attr("href")?.trim();
    if (!href || href.startsWith("#") || href.toLowerCase().startsWith("javascript:")) return;

    const text = normalizeText(anchor.text());
    const title = normalizeText(anchor.attr("title") ?? "");
    // "다운로드" 같은 버튼 문구보다 title 속성이나 주변의 실제 파일명을 우선한다.
    const isGenericText = !text || /^(다운로드|바로보기|내려받기|첨부파일|download|view)$/i.test(text);
    const isGenericTitle = !title || /^(파일\s?다운로드|다운로드|첨부파일)$/i.test(title);
    let label = isGenericText && !isGenericTitle ? title : text || title || "첨부파일";

    if (isGenericText && isGenericTitle) {
      // K-Startup처럼 파일명(.file_bg)이 다운로드 버튼의 상위 항목에 있는 구조 지원.
      const container = anchor
        .parents("li,tr,dd,div")
        .filter((_, parent) => $(parent).find("a.file_bg").length > 0)
        .first();
      const siblingName = normalizeText(container.find("a.file_bg").first().text());
      if (siblingName) label = siblingName;
    }

    label = normalizeText(
      label
        .replace(/^\[?첨부파일\]?\s*/, "")
        .replace(/(\s*(다운로드|바로보기|내려받기))+$/g, "")
    ) || "첨부파일";
    const looksLikeFile =
      anchor.is("[download]") ||
      /\.(pdf|hwp|hwpx|doc|docx|xls|xlsx|ppt|pptx|zip)(?:$|[?#])/i.test(href) ||
      /(file|atch|attach|download)/i.test(href + " " + label);
    if (!looksLikeFile) return;

    let resolved: URL;
    try {
      resolved = new URL(href, baseUrl);
    } catch {
      return;
    }
    if (
      !["http:", "https:"].includes(resolved.protocol) ||
      resolved.username ||
      resolved.password ||
      isPrivateHostname(resolved.hostname)
    ) {
      return;
    }
    const url = resolved.toString();
    if (seen.has(url)) return;
    seen.add(url);
    links.push({ label: label.slice(0, 300), url });
  });

  return links;
}

function isPrivateHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".local")) return true;
  if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return true;
  const match = host.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}
