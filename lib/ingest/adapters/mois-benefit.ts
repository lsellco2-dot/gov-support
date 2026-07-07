import type { SourceAdapter } from "../types";
import { buildUrl, extractItems, fetchJson, pick, toDate } from "./util";

// 행안부 공공서비스(혜택)는 개인 대상 혜택이 다수 →
// 지원대상/서비스명에 기업 관련 키워드가 없으면 normalize에서 null 반환(스킵)
const BUSINESS_KEYWORDS = ["소상공인", "중소기업", "창업", "자영업", "기업", "스타트업", "사업자"];

const ENDPOINT =
  process.env.MOIS_ENDPOINT ??
  "https://apis.data.go.kr/1741000/publicServiceList/getPublicServiceList";

const PER_PAGE = 100;
const MAX_PAGES = 20; // 최신 2,000건까지만 수집 (안전장치 겸용)

export const moisBenefit: SourceAdapter = {
  sourceCode: "mois",

  async *fetchPages({ serviceKey }) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = buildUrl(ENDPOINT, {
        serviceKey,
        pageNo: page,
        numOfRows: PER_PAGE,
        type: "json",
      });
      const data = await fetchJson(url);
      const items = extractItems(data);
      if (items.length === 0) break;
      yield items;
      if (items.length < PER_PAGE) break;
    }
  },

  normalize(raw: any) {
    const title = pick(raw, ["servNm", "svcNm", "serviceName", "title"]);
    const sourceKey = pick(raw, ["servId", "svcId", "serviceId", "id"]) ?? title;
    if (!title || !sourceKey) return null;

    const target = pick(raw, ["trgterIndvdlNmArray", "sprtTrgtCn", "target", "jurMnofNm"]);
    const haystack = `${title} ${target ?? ""}`;
    if (!BUSINESS_KEYWORDS.some((k) => haystack.includes(k))) return null; // 개인 혜택 스킵

    return {
      sourceCode: "mois",
      sourceKey,
      title,
      organization: pick(raw, ["jurMnofNm", "bizChrDeptNm", "organNm"]),
      region: pick(raw, ["ctpvNm", "region"]) ?? "전국",
      target,
      supportType: pick(raw, ["srvPvsnNm", "suptType", "intrsThemaNmArray"]),
      summary: pick(raw, ["servDgst", "svcDgst", "summary"]),
      applyStart: null,
      applyEnd: toDate(pick(raw, ["aplyEndDt", "endDate"])), // 대부분 상시 → null
      detailUrl: pick(raw, ["servDtlLink", "svcDtlLink", "url"]),
      raw,
    };
  },
};
