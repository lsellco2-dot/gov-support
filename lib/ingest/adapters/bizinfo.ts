import type { SourceAdapter } from "../types";
import { buildUrl, extractItems, fetchJson, parseRange, pick, toDate } from "./util";

// ⚠️ 개발 시작 시 실제 응답 1페이지를 curl로 받아 필드명을 확정할 것.
//    아래 후보 필드명은 기업마당 계열 API에서 흔히 쓰이는 이름들.
const ENDPOINT =
  process.env.BIZINFO_ENDPOINT ??
  "https://apis.data.go.kr/B553701/bizinfoApi/getBizinfoList"; // TODO: 발급받은 API의 실제 엔드포인트로 교체

const PER_PAGE = 100;
const MAX_PAGES = 20; // 최신 2,000건까지만 수집 (안전장치 겸용)

export const bizinfo: SourceAdapter = {
  sourceCode: "bizinfo",

  async *fetchPages({ serviceKey }) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = buildUrl(ENDPOINT, {
        serviceKey,
        pageNo: page,
        numOfRows: PER_PAGE,
        returnType: "json",
      });
      const data = await fetchJson(url);
      const items = extractItems(data);
      if (items.length === 0) break;
      yield items;
      if (items.length < PER_PAGE) break;
    }
  },

  normalize(raw: any) {
    const title = pick(raw, ["pblancNm", "pblancName", "title", "bsnsTitle"]);
    const sourceKey = pick(raw, ["pblancId", "pblancSn", "id", "seq"]) ?? title;
    if (!title || !sourceKey) return null;

    const [start1, end1] = parseRange(
      pick(raw, ["reqstBeginEndDe", "reqstDe", "applyPeriod"])
    );

    return {
      sourceCode: "bizinfo",
      sourceKey,
      title,
      organization: pick(raw, ["jrsdInsttNm", "excInsttNm", "insttNm", "organNm"]),
      region: pick(raw, ["areaNm", "regionNm", "hashtags"]) ?? "전국",
      target: pick(raw, ["trgetNm", "targetNm", "aplyTrgt"]),
      supportType: pick(raw, ["pldirSportRealmLclasCodeNm", "sportRealmNm", "suptType"]),
      summary: pick(raw, ["bsnsSumryCn", "sumryCn", "summary"]),
      applyStart: start1 ?? toDate(pick(raw, ["reqstBeginDe", "applyStart"])),
      applyEnd: end1 ?? toDate(pick(raw, ["reqstEndDe", "applyEnd"])),
      detailUrl: pick(raw, ["pblancUrl", "detailUrl", "url"]),
      raw,
    };
  },
};
