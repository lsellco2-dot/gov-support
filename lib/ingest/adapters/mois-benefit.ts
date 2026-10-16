import type { SourceAdapter } from "../types";
import { buildUrl, fetchJson, parseRange, pick } from "./util";
import { apiDetail, checkPageProgress, explicitRegion } from "./public-service";

// 행정안전부 대한민국 공공서비스(혜택) — 정부24 오픈API (2026-07-07 실응답 확인)
// 응답 필드가 한글 키: 서비스ID, 서비스명, 소관기관명, 지원대상, 지원유형, 신청기한,
// 상세조회URL, 서비스목적요약, 사용자구분(개인/기업/...) 등
const ENDPOINT =
  process.env.MOIS_ENDPOINT ?? "https://api.odcloud.kr/api/gov24/v3/serviceList";

const PER_PAGE = 500;
const MAX_PAGES = 100;

// 소관기관명에서 지역 추출 (예: "전라남도청" → 전남). 매칭 없으면 전국
const REGION_PATTERNS: [RegExp, string][] = [
  [/서울/, "서울"], [/부산/, "부산"], [/대구/, "대구"], [/인천/, "인천"], [/광주/, "광주"],
  [/대전/, "대전"], [/울산/, "울산"], [/세종/, "세종"], [/경기/, "경기"], [/강원/, "강원"],
  [/충청북도|충북/, "충북"], [/충청남도|충남/, "충남"], [/전라북도|전북/, "전북"],
  [/전라남도|전남/, "전남"], [/경상북도|경북/, "경북"], [/경상남도|경남/, "경남"], [/제주/, "제주"],
];

function regionFromOrg(org: string | null): string {
  if (!org) return "전국";
  // 광역 행정구역이 명시된 경우 '경기도 광주시'를 광주광역시로 오인하지 않는다.
  const province = explicitRegion(org.split(/\s+/)[0]);
  if (province !== "미확인") return province;
  for (const [re, name] of REGION_PATTERNS) if (re.test(org)) return name;
  return "전국";
}

export const moisBenefit: SourceAdapter = {
  sourceCode: "mois",

  async *fetchPages({ serviceKey }) {
    let collected = 0;
    const seen = new Set<string>();
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = buildUrl(ENDPOINT, {
        serviceKey,
        page,
        perPage: PER_PAGE,
      });
      const data = await fetchJson(url);
      if (!Array.isArray(data?.data)) throw new Error("GOV24_INVALID_RESPONSE");
      const items: any[] = data.data;
      const total = Number(data.totalCount);
      checkPageProgress(items, total, collected);
      for (const item of items) {
        const id = pick(item, ["서비스ID"]);
        if (!id || seen.has(id)) throw new Error("GOV24_DUPLICATE_OR_MISSING_ID");
        seen.add(id);
      }
      collected += items.length;
      if (items.length === 0) return;
      yield items;
      if (collected >= total) return;
    }
    throw new Error("GOV24_PAGE_LIMIT_REACHED");
  },

  normalize(raw: any) {
    const title = pick(raw, ["서비스명"]);
    const sourceKey = pick(raw, ["서비스ID"]) ?? title;
    if (!title || !sourceKey) return null;

    const target = pick(raw, ["지원대상"]);

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
      summary: [pick(raw, ["서비스분야"]), pick(raw, ["서비스목적요약", "지원내용"])].filter(Boolean).join("\n"),
      applyStart: start,
      applyEnd: end,
      detailUrl: pick(raw, ["상세조회URL"]),
      detail: apiDetail([
        ["지원대상", target], ["선정기준", raw.선정기준], ["지원내용", raw.지원내용],
        ["신청기한", raw.신청기한], ["신청방법", raw.신청방법], ["접수기관", raw.접수기관],
      ], { applyMethod: raw.신청방법, contact: raw.전화문의 }),
      raw,
    };
  },
};
