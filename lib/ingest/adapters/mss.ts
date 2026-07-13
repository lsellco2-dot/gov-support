import type { NormalizedAttachment, SourceAdapter } from "../types";
import { buildUrl, fetchXmlItems, pick, stripHtml, toDate, type XmlItem } from "./util";

// 공공데이터포털 중소벤처기업부 사업공고 v2(XML).
// 기업마당·K-Startup과 겹치는 공고는 수집 단계에서 해당 출처를 우선한다.
const ENDPOINT =
  process.env.MSS_ENDPOINT ??
  "https://apis.data.go.kr/1421000/mssBizService_v2/getbizList_v2";

const PER_PAGE = 100;
const MAX_PAGES = 10;

const SUPPORT_SIGNALS = [
  "지원사업", "지원계획", "시행계획", "모집공고", "참여기업", "기업 모집",
  "기업모집", "창업", "소상공인", "중소기업", "수출", "판로", "마케팅",
  "기술개발", "연구개발", "r&d", "스마트공장", "정책자금", "융자", "보증",
  "바우처", "컨설팅", "교육", "인증", "사업자", "주관기관", "수행기관",
];

const ADMINISTRATIVE_SIGNALS = [
  "입법예고", "행정예고", "훈령", "법령", "인사발령", "공무원 채용",
  "직원 채용", "채용 공고", "감사결과", "정책연구", "연구용역", "용역 입찰",
  "입찰공고", "계약 공고", "청문", "행정처분", "등록취소", "과태료", "제재",
  "위원 모집", "위원회 위원", "모니터링단", "기자단", "국민참여", "유공 포상",
  "포상 후보자", "공모전", "설문조사",
];

export const mss: SourceAdapter = {
  sourceCode: "mss",

  async *fetchPages({ serviceKey }) {
    const { startDate, endDate } = mssFetchWindow();
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = buildUrl(ENDPOINT, {
        serviceKey,
        pageNo: page,
        numOfRows: PER_PAGE,
        startDate,
        endDate,
      });
      const items = await fetchXmlItems(url);
      if (items.length === 0) break;
      yield items;
      if (items.length < PER_PAGE) break;
    }
  },

  normalize(raw: unknown) {
    const item = raw as XmlItem;
    const title = pick(item, ["title"]);
    const sourceKey = pick(item, ["itemId"]);
    if (!title || !sourceKey) return null;

    const summary = stripHtml(pick(item, ["dataContents"]))?.slice(0, 2_000) ?? null;
    if (!isMssSupportAnnouncement(title, summary)) return null;

    return {
      sourceCode: "mss",
      sourceKey,
      title,
      organization: "중소벤처기업부",
      region: "전국",
      target: null,
      supportType: null,
      summary,
      applyStart: toDate(pick(item, ["applicationStartDate"])),
      applyEnd: toDate(pick(item, ["applicationEndDate"])),
      detailUrl: safeMssUrl(pick(item, ["viewUrl"])),
      attachments: mssAttachments(item),
      raw: item,
    };
  },
};

export function isMssSupportAnnouncement(title: string, summary: string | null) {
  const titleLower = title.toLocaleLowerCase("ko-KR");
  if (ADMINISTRATIVE_SIGNALS.some((signal) => titleLower.includes(signal))) return false;

  const searchable = `${title}\n${summary ?? ""}`.toLocaleLowerCase("ko-KR");
  return SUPPORT_SIGNALS.some((signal) => searchable.includes(signal));
}

export function mssFetchWindow(now = new Date()) {
  const endDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return { startDate: `${endDate.slice(0, 4)}-01-01`, endDate };
}

function mssAttachments(item: XmlItem): NormalizedAttachment[] {
  const names = asArray(item.fileName);
  const urls = asArray(item.fileUrl);
  const attachments: NormalizedAttachment[] = [];
  for (let index = 0; index < Math.max(names.length, urls.length); index++) {
    const url = safeMssUrl(urls[index] ?? null);
    if (!url) continue;
    attachments.push({
      label: names[index]?.trim() || `첨부파일 ${index + 1}`,
      url,
    });
  }
  return attachments;
}

function asArray(value: string | string[] | undefined) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function safeMssUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    if (host !== "mss.go.kr" && !host.endsWith(".mss.go.kr")) return null;
    return url.toString();
  } catch {
    return null;
  }
}
