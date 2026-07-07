import type { SourceAdapter } from "../types";
import { buildUrl, extractItems, fetchJson, parseRange, pick, toDate } from "./util";

// ⚠️ 보류(2026-07-07): 실제 엔드포인트 확인 불가 — 아래 후보는 HTTP 500 반환.
// 공공데이터포털 "중소벤처기업부_사업공고"(15113297) 활용신청 후 마이페이지의
// Swagger/요청주소를 확인해 MSS_ENDPOINT 환경변수로 교체할 것.
// 중기부 공고는 기업마당(bizinfo)·K-Startup이 대부분 커버하므로 우선순위 낮음.
const ENDPOINT =
  process.env.MSS_ENDPOINT ??
  "https://apis.data.go.kr/1421000/mssBizService/getbizList";

const PER_PAGE = 100;
const MAX_PAGES = 20; // 최신 2,000건까지만 수집 (안전장치 겸용)

export const mss: SourceAdapter = {
  sourceCode: "mss",

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
    const title = pick(raw, ["title", "pblancNm", "bsnsNm", "subject"]);
    const sourceKey = pick(raw, ["id", "pblancId", "seq", "bbsSn"]) ?? title;
    if (!title || !sourceKey) return null;

    const [start1, end1] = parseRange(pick(raw, ["applyPeriod", "reqstBeginEndDe"]));

    return {
      sourceCode: "mss",
      sourceKey,
      title,
      organization: pick(raw, ["insttNm", "deptNm", "organNm"]) ?? "중소벤처기업부",
      region: pick(raw, ["areaNm", "region"]) ?? "전국",
      target: pick(raw, ["trgetNm", "target"]),
      supportType: pick(raw, ["sportRealmNm", "category"]),
      summary: pick(raw, ["cn", "content", "summary"]),
      applyStart: start1 ?? toDate(pick(raw, ["reqstBeginDe", "startDate"])),
      applyEnd: end1 ?? toDate(pick(raw, ["reqstEndDe", "endDate"])),
      detailUrl: pick(raw, ["url", "detailUrl", "link"]),
      raw,
    };
  },
};
