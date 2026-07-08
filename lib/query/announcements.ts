import { supabaseAnon } from "@/lib/supabase/anon";
import { FIXTURES } from "./fixtures";
import { sanitizeDisplayRow, sanitizeDisplayText } from "@/lib/text/sanitize";

// Supabase 미연결 상태에서 UI 개발용: fixtures를 메모리에서 검색/필터/정렬/페이지네이션
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export interface ListParams {
  q?: string;
  audience?: AudienceGroup;
  category?: number;
  region?: string;
  status?: "open" | "closed" | "all";
  sort?: "deadline" | "latest";
  page?: number;
  size?: number;
}

export type AudienceGroup = "all" | "business" | "worker";

export interface AnnouncementRow {
  id: number;
  source_id: number;
  source_key?: string;
  title: string;
  organization: string | null;
  category_ids: number[];
  region: string | null;
  target: string | null;
  support_type: string | null;
  summary: string | null;
  apply_start: string | null;
  apply_end: string | null;
  detail_url: string | null;
  status: "open" | "closed";
  created_at: string;
}

export interface DetailLink {
  label: string;
  url: string;
}

export interface DetailSection {
  title: string;
  body: string;
}

export interface AnnouncementDetail extends AnnouncementRow {
  detail_content: string | null;
  apply_method: string | null;
  documents: string | null;
  contact: string | null;
  attachments: DetailLink[];
  extra_sections: DetailSection[];
}

export const CATEGORIES = [
  { id: 1, name: "창업지원" },
  { id: 2, name: "소상공인 지원" },
  { id: 3, name: "자금/대출/보증" },
  { id: 4, name: "마케팅/판로" },
  { id: 5, name: "고용/인건비" },
  { id: 6, name: "기술/R&D" },
  { id: 7, name: "수출/해외진출" },
  { id: 8, name: "교육/컨설팅" },
  { id: 9, name: "시설/디지털전환" },
] as const;

export const REGIONS = [
  "전국","서울","부산","대구","인천","광주","대전","울산","세종",
  "경기","강원","충북","충남","전북","전남","경북","경남","제주",
] as const;

const MAX_SIZE = 50;
const AUDIENCE_BATCH_SIZE = 1000;

const AUDIENCE_KEYWORDS: Record<Exclude<AudienceGroup, "all">, string[]> = {
  business: [
    "예비창업",
    "창업",
    "스타트업",
    "사업자",
    "개인사업자",
    "법인",
    "중소기업",
    "소상공인",
    "자영업",
    "기업",
    "수출기업",
    "기술기업",
  ],
  worker: [
    "구직",
    "취업",
    "취업준비",
    "청년",
    "재직자",
    "근로자",
    "직장인",
    "교육생",
    "인턴",
    "일자리",
    "채용",
    "직무교육",
  ],
};

/** mock 모드: DB 쿼리와 동일한 조건으로 fixtures를 메모리 처리 */
function listFromFixtures(p: ListParams, page: number, size: number) {
  let rows = FIXTURES.slice();

  const status = p.status ?? "open";
  if (status !== "all") rows = rows.filter((r) => r.status === status);
  if (p.audience && p.audience !== "all") {
    rows = rows.filter((r) =>
      matchesAudience(
        [r.title, r.target, r.support_type, r.summary].filter(Boolean).join(" "),
        p.audience!
      )
    );
  }
  if (p.q) {
    const needle = p.q.toLowerCase();
    rows = rows.filter((r) => r.title.toLowerCase().includes(needle));
  }
  if (p.category) rows = rows.filter((r) => r.category_ids.includes(p.category!));
  if (p.region && p.region !== "전국") {
    rows = rows.filter((r) => r.region === p.region || r.region === "전국");
  }

  if (p.sort === "latest") {
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  } else {
    // 기본: 마감 임박순 (상시=null은 뒤로)
    rows.sort((a, b) => {
      if (a.apply_end === null && b.apply_end === null) return 0;
      if (a.apply_end === null) return 1;
      if (b.apply_end === null) return -1;
      return a.apply_end.localeCompare(b.apply_end);
    });
  }

  const from = (page - 1) * size;
  return {
    items: rows.slice(from, from + size).map(sanitizeDisplayRow),
    total: rows.length,
    page,
    size,
  };
}

/** 목록 조회 — 중복 제거된 뷰(announcements_public) 기준 */
export async function listAnnouncements(p: ListParams) {
  const page = Math.max(1, p.page ?? 1);
  const size = Math.min(MAX_SIZE, Math.max(1, p.size ?? 20));
  const from = (page - 1) * size;

  if (USE_MOCK) return listFromFixtures(p, page, size);

  if (p.audience && p.audience !== "all") {
    return listAnnouncementsByAudience(p, page, size);
  }

  let q = supabaseAnon
    .from("announcements_public")
    .select(
      "id,source_id,title,organization,category_ids,region,target,support_type,apply_start,apply_end,detail_url,status,created_at",
      { count: "exact" }
    );

  const status = p.status ?? "open";
  if (status !== "all") q = q.eq("status", status);
  if (p.q) q = q.ilike("title", `%${p.q}%`);
  if (p.category) q = q.contains("category_ids", [p.category]);
  if (p.region && p.region !== "전국") q = q.in("region", [p.region, "전국"]);

  if (p.sort === "latest") {
    q = q.order("created_at", { ascending: false });
  } else {
    // 기본: 마감 임박순 (상시=null은 뒤로)
    q = q.order("apply_end", { ascending: true, nullsFirst: false });
  }

  const { data, count, error } = await q.range(from, from + size - 1);
  if (error) throw new Error(error.message);

  return {
    items: ((data ?? []) as AnnouncementRow[]).map(sanitizeDisplayRow),
    total: count ?? 0,
    page,
    size,
  };
}

async function listAnnouncementsByAudience(
  p: ListParams,
  page: number,
  size: number
) {
  let q = supabaseAnon
    .from("announcements")
    .select(
      "id,source_id,source_key,title,organization,category_ids,region,target,support_type,summary,apply_start,apply_end,detail_url,content_hash,created_at,raw_json"
    )
    .order("id", { ascending: true });

  if (p.q) q = q.ilike("title", `%${p.q}%`);
  if (p.category) q = q.contains("category_ids", [p.category]);
  if (p.region && p.region !== "전국") q = q.in("region", [p.region, "전국"]);

  const rows: AudienceAnnouncementRecord[] = [];
  for (let from = 0; ; from += AUDIENCE_BATCH_SIZE) {
    const { data, error } = await q.range(from, from + AUDIENCE_BATCH_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as AudienceAnnouncementRecord[]));
    if (!data || data.length < AUDIENCE_BATCH_SIZE) break;
  }

  let filtered = dedupeAnnouncementRecords(rows)
    .map(toAnnouncementRow)
    .filter((row) => matchesAudience(audienceText(row), p.audience!));

  const status = p.status ?? "open";
  if (status !== "all") filtered = filtered.filter((row) => row.status === status);

  sortAnnouncementRows(filtered, p.sort);

  const from = (page - 1) * size;
  return {
    items: filtered.slice(from, from + size).map(stripRawJson),
    total: filtered.length,
    page,
    size,
  };
}

type AudienceAnnouncementRecord = AnnouncementRecord & {
  content_hash: string;
};

function dedupeAnnouncementRecords(rows: AudienceAnnouncementRecord[]) {
  const map = new Map<string, AudienceAnnouncementRecord>();
  for (const row of rows) {
    const key = row.content_hash || `${row.source_id}:${row.source_key}`;
    const prev = map.get(key);
    if (!prev || row.source_id < prev.source_id) map.set(key, row);
  }
  return Array.from(map.values());
}

function toAnnouncementRow(row: AudienceAnnouncementRecord): AnnouncementRow & { raw_json?: unknown } {
  return {
    id: row.id,
    source_id: row.source_id,
    source_key: row.source_key,
    title: sanitizeDisplayText(row.title),
    organization: sanitizeDisplayText(row.organization),
    category_ids: row.category_ids,
    region: sanitizeDisplayText(row.region),
    target: sanitizeDisplayText(row.target),
    support_type: sanitizeDisplayText(row.support_type),
    summary: sanitizeDisplayText(row.summary),
    apply_start: row.apply_start,
    apply_end: row.apply_end,
    detail_url: row.detail_url,
    status: row.apply_end === null || row.apply_end >= todayKst() ? "open" : "closed",
    created_at: row.created_at,
    raw_json: row.raw_json,
  };
}

function sortAnnouncementRows(rows: AnnouncementRow[], sort?: ListParams["sort"]) {
  if (sort === "latest") {
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return;
  }

  rows.sort((a, b) => {
    if (a.apply_end === null && b.apply_end === null) return 0;
    if (a.apply_end === null) return 1;
    if (b.apply_end === null) return -1;
    return a.apply_end.localeCompare(b.apply_end);
  });
}

function audienceText(row: AnnouncementRow & { raw_json?: unknown }) {
  const raw = row.raw_json ? JSON.stringify(unwrapRaw(row.raw_json)) : "";
  return [row.title, row.target, row.support_type, row.summary, raw]
    .filter(Boolean)
    .join(" ");
}

function stripRawJson(row: AnnouncementRow & { raw_json?: unknown }): AnnouncementRow {
  const { raw_json: _rawJson, ...rest } = row;
  return rest;
}

function matchesAudience(text: string, audience: AudienceGroup) {
  if (audience === "all") return true;
  const keywords = AUDIENCE_KEYWORDS[audience];
  const haystack = text.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

export async function getAnnouncement(id: number) {
  if (USE_MOCK) {
    return (FIXTURES.find((r) => r.id === id) ?? null) as
      | AnnouncementDetail
      | null;
  }

  const { data, error } = await supabaseAnon
    .from("announcements")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const detail = toDetail(data as AnnouncementRecord);
  return enrichKstartupDetail(detail);
}

type AnnouncementRecord = AnnouncementRow & {
  source_key: string;
  content_hash: string;
  raw_json: unknown;
  updated_at: string;
};

function toDetail(row: AnnouncementRecord): AnnouncementDetail {
  const raw = unwrapRaw(row.raw_json);
  const detailContent = cleanText(
    pickRaw(raw, ["pbanc_ctnt", "detail_content", "content", "summary"])
  );
  const documents = cleanText(
    pickRaw(raw, ["sbmsn_dcmnt_ctnt", "sbmsn_dcmnt", "submit_documents", "documents"])
  );

  return {
    id: row.id,
    source_id: row.source_id,
    source_key: row.source_key,
    title: sanitizeDisplayText(row.title),
    organization: sanitizeDisplayText(row.organization),
    category_ids: row.category_ids,
    region: sanitizeDisplayText(row.region),
    target: sanitizeDisplayText(row.target),
    support_type: sanitizeDisplayText(row.support_type),
    summary: sanitizeDisplayText(row.summary),
    apply_start: row.apply_start,
    apply_end: row.apply_end,
    detail_url: row.detail_url,
    status: row.apply_end === null || row.apply_end >= todayKst() ? "open" : "closed",
    created_at: row.created_at,
    detail_content: sanitizeDisplayText(detailContent),
    apply_method: buildApplyMethod(raw),
    documents: sanitizeDisplayText(documents),
    contact: sanitizeDisplayText(buildContact(raw)),
    attachments: buildLinks(raw),
    extra_sections: [],
  };
}

async function enrichKstartupDetail(detail: AnnouncementDetail) {
  if (detail.source_id !== 2 || !detail.detail_url) return detail;

  const scraped = await fetchKstartupSections(detail.detail_url);
  if (!scraped) return detail;

  const applyTarget = sectionBody(scraped.sections, "신청방법 및 대상");
  const documents = sectionBody(scraped.sections, "제출서류");
  const support = sectionBody(scraped.sections, "지원내용");
  const selection = sectionBody(scraped.sections, "선정절차 및 평가방법");
  const contact = sectionBody(scraped.sections, "문의처");

  return {
    ...detail,
    apply_method: applyTarget ?? detail.apply_method,
    documents: documents ?? detail.documents,
    contact: contact ?? detail.contact,
    attachments: mergeLinks(detail.attachments, scraped.links),
    extra_sections: [
      support ? { title: "지원내용", body: support } : null,
      selection ? { title: "선정절차 및 평가방법", body: selection } : null,
    ].filter(Boolean) as DetailSection[],
  };
}

async function fetchKstartupSections(url: string) {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "text/html",
        "User-Agent": "gov-support-detail-fetcher/1.0",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const html = await res.text();
    return parseKstartupHtml(html);
  } catch {
    return null;
  }
}

function parseKstartupHtml(html: string) {
  const sections: DetailSection[] = [];
  const sectionRe =
    /<div[^>]*class=["'][^"']*\binformation_list\b[^"']*["'][^>]*>([\s\S]*?)(?=<div[^>]*class=["'][^"']*\binformation_list\b|<div[^>]*class=["'][^"']*\bbtn_wrap\b|<\/form>|$)/gi;

  for (const [, block] of Array.from(html.matchAll(sectionRe))) {
    const title = cleanText(matchFirst(block, /<p[^>]*class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i));
    if (!title) continue;

    const items: string[] = [];
    const itemRe = /<li[^>]*class=["'][^"']*\bdot_list\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
    for (const [, item] of Array.from(block.matchAll(itemRe))) {
      const itemTitle = cleanText(matchFirst(item, /<p[^>]*class=["'][^"']*\btit\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i));
      const itemBody =
        cleanText(matchFirst(item, /<p[^>]*class=["'][^"']*\btxt\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)) ??
        cleanText(matchFirst(item, /<p[^>]*class=["'][^"']*\blist\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i));

      if (itemTitle && itemBody) items.push(`${itemTitle}\n${itemBody}`);
      else if (itemTitle) items.push(itemTitle);
      else if (itemBody) items.push(itemBody);
    }

    const body = items.join("\n\n").trim();
    if (body) sections.push({ title, body });
  }

  return {
    sections,
    links: extractKstartupLinks(html),
  };
}

function extractKstartupLinks(html: string): DetailLink[] {
  return dedupeLinks(extractKstartupFiles(html));
}

function extractKstartupFiles(html: string): DetailLink[] {
  const files: DetailLink[] = [];
  const board = matchFirst(
    html,
    /<div[^>]*class=["'][^"']*\bboard_file\b[^"']*["'][^>]*>([\s\S]*?)(?:<!-- 파일다운로드|<div[^>]*class=["'][^"']*\blicense\b|<script>|$)/i
  );
  if (!board) return files;

  const fileRe =
    /<a[^>]*class=["'][^"']*\bfile_bg\b[^"']*["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+href=["']([^"']*\/afile\/fileDownload\/[^"']+)["'][^>]*>/gi;

  for (const [, labelHtml, href] of Array.from(board.matchAll(fileRe))) {
    const label =
      cleanText(labelHtml) ??
      cleanText(matchFirst(labelHtml, /title=["']\[첨부파일\]\s*([^"']+)["']/i));
    const url = href ? normalizeKstartupHref(href) : null;
    if (label && url) files.push({ label, url });
  }

  return files;
}

function normalizeKstartupHref(href: string) {
  const value = decodeHtml(href).trim();
  if (!value || value.startsWith("#") || value.startsWith("javascript:")) return null;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/")) return `https://www.k-startup.go.kr${value}`;
  return normalizeUrl(value);
}

function matchFirst(value: string, re: RegExp) {
  return value.match(re)?.[1] ?? null;
}

function sectionBody(sections: DetailSection[], title: string) {
  return sections.find((section) => section.title.includes(title))?.body ?? null;
}

function mergeLinks(a: DetailLink[], b: DetailLink[]) {
  return dedupeLinks([...a, ...b]);
}

function dedupeLinks(links: DetailLink[]) {
  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  });
}

function unwrapRaw(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const col = obj.col;
  return col && typeof col === "object" ? (col as Record<string, unknown>) : obj;
}

function pickRaw(raw: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return null;
}

function cleanText(value: string | null) {
  if (!value) return null;
  const text = decodeHtml(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
  return sanitizeDisplayText(text) || null;
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function buildApplyMethod(raw: Record<string, unknown>) {
  const rows = [
    ["온라인 신청", pickRaw(raw, ["aply_mthd_onli_rcpt_istc", "biz_aply_url"])],
    ["이메일 접수", pickRaw(raw, ["aply_mthd_eml_rcpt_istc"])],
    ["방문 접수", pickRaw(raw, ["aply_mthd_vst_rcpt_istc"])],
    ["우편 접수", pickRaw(raw, ["aply_mthd_pssr_rcpt_istc"])],
    ["팩스 접수", pickRaw(raw, ["aply_mthd_fax_rcpt_istc"])],
    ["기타", pickRaw(raw, ["aply_mthd_etc_istc"])],
  ]
    .map(([label, value]) => {
      const text = cleanText(value);
      if (!text || looksEncrypted(text)) return null;
      return `${label}: ${text}`;
    })
    .filter(Boolean);

  return rows.length > 0 ? rows.join("\n") : null;
}

function buildContact(raw: Record<string, unknown>) {
  const dept = cleanText(pickRaw(raw, ["biz_prch_dprt_nm", "charge_dept"]));
  const phone = cleanText(pickRaw(raw, ["prch_cnpl_no", "inqr_telno", "contact"]));
  return [dept, phone].filter(Boolean).join(" / ") || null;
}

function buildLinks(raw: Record<string, unknown>): DetailLink[] {
  const candidates: [string, string[]][] = [
    ["사업 신청", ["biz_aply_url"]],
    ["사업 안내", ["biz_gdnc_url"]],
    ["첨부파일", ["pbanc_file_url", "atch_file_url", "file_url", "atchFileUrl", "fileUrl"]],
  ];

  const links: DetailLink[] = [];
  for (const [label, keys] of candidates) {
    const value = cleanText(pickRaw(raw, keys));
    if (value && isUrl(value)) links.push({ label, url: normalizeUrl(value) });
  }
  return links;
}

function looksEncrypted(value: string) {
  return /^[A-Za-z0-9+/]{24,}={0,2}$/.test(value);
}

function isUrl(value: string) {
  return /^https?:\/\//i.test(value) || /^www\./i.test(value);
}

function normalizeUrl(value: string) {
  return /^www\./i.test(value) ? `https://${value}` : value;
}

function todayKst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
