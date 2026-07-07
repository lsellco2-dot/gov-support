import type { SourceAdapter } from "../types";
import { buildUrl, fetchJson, parseRange, pick } from "./util";

// 행정안전부 대한민국 공공서비스(혜택) — 정부24 오픈API (2026-07-07 실응답 확인)
// 응답 필드가 한글 키: 서비스ID, 서비스명, 소관기관명, 지원대상, 지원유형, 신청기한,
// 상세조회URL, 서비스목적요약, 사용자구분(개인/기업/...) 등
const ENDPOINT =
  process.env.MOIS_ENDPOINT ?? "https://api.odcloud.kr/api/gov24/v3/serviceList";

const PER_PAGE = 100;
const MAX_PAGES = 20; // 최신 2,000건까지만 수집 (안전장치 겸용)

// 개인 혜택이 다수 → 사용자구분에 "기업"이 없고 기업 키워드도 없으면 스킵
const BUSINESS_KEYWORDS = ["소상공인", "중소기업", "창업", "자영업", "기업", "스타트업", "사업자"];

// 소관기관명에서 지역 추출 (예: "전라남도청" → 전남). 매칭 없으면 전국
const REGION_PATTERNS: [RegExp, string][] = [
  [/서울/, "서울"], [/부산/, "부산"], [/대구/, "대구"], [/인천/, "인천"], [/광주/, "광주"],
  [/대전/, "대전"], [/울산/, "울산"], [/세종/, "세종"], [/경기/, "경기"], [/강원/, "강원"],
  [/충청북도|충북/, "충북"], [/충청남도|충남/, "충남"], [/전라북도|전북/, "전북"],
  [/전라남도|전남/, "전남"], [/경상북도|경북/, "경북"], [/경상남도|경남/, "경남"], [/제주/, "제주"],
];

function regionFromOrg(org: string | null): string {
  if (!org) return "전국";
  for (const [re, name] of REGION_PATTERNS) if (re.test(org)) return name;
  return "전국";
}

export const moisBenefit: SourceAdapter = {
  sourceCode: "mois",

  async *fetchPages({ serviceKey }) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = buildUrl(ENDPOINT, {
        serviceKey,
        page,
        perPage: PER_PAGE,
      });
      const data = await fetchJson(url);
      const items: any[] = Array.isArray(data?.data) ? data.data : [];
      if (items.length === 0) break;
      yield items;
      if (items.length < PER_PAGE) break;
    }
  },

  normalize(raw: any) {
    const title = pick(raw, ["서비스명"]);
    const sourceKey = pick(raw, ["서비스ID"]) ?? title;
    if (!title || !sourceKey) return null;

    const userType = pick(raw, ["사용자구분"]) ?? "";
    const target = pick(raw, ["지원대상"]);
    const haystack = `${userType} ${title} ${target ?? ""}`;
    if (!BUSINESS_KEYWORDS.some((k) => haystack.includes(k))) return null; // 개인 혜택 스킵

    const organization = pick(raw, ["소관기관명"]);
    // 신청기한: "2026.01.01.~2026.12.31." | "상시신청"(→ null=상시) 등
    const [start, end] = parseRange(pick(raw, ["신청기한"]));

    return {
      sourceCode: "mois",
      sourceKey,
      title,
      organization,
      region: regionFromOrg(organization),
      target,
      supportType: pick(raw, ["지원유형"]),
      summary: pick(raw, ["서비스목적요약", "지원내용"]),
      applyStart: start,
      applyEnd: end,
      detailUrl: pick(raw, ["상세조회URL"]),
      raw,
    };
  },
};
