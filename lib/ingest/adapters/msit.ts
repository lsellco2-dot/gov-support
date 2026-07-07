import type { SourceAdapter } from "../types";
import { buildUrl, fetchXmlItems, pick, toDate } from "./util";

// 과학기술정보통신부 사업공고 (2026-07-07 실응답 확인 — XML 전용 게시판 API)
// 필드: subject(제목), viewUrl(상세), deptName(담당부서), pressDt(게시일), files(첨부)
// 접수 기간/지역/대상 필드는 제공되지 않음 → apply_end는 null(상시/미상) 처리
const ENDPOINT =
  process.env.MSIT_ENDPOINT ??
  "https://apis.data.go.kr/1721000/msitannouncementinfo/businessAnnouncMentList";

const PER_PAGE = 100;
const MAX_PAGES = 20; // 최신 2,000건까지만 수집 (안전장치 겸용)

export const msit: SourceAdapter = {
  sourceCode: "msit",

  async *fetchPages({ serviceKey }) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = buildUrl(ENDPOINT, {
        serviceKey,
        pageNo: page,
        numOfRows: PER_PAGE,
      });
      const items = await fetchXmlItems(url);
      if (items.length === 0) break;
      yield items;
      if (items.length < PER_PAGE) break;
    }
  },

  normalize(raw: any) {
    const title = pick(raw, ["subject"]);
    if (!title) return null;
    const viewUrl = pick(raw, ["viewUrl"]);
    // 고유번호가 별도 필드로 없어 상세 URL의 nttSeqNo를 사용
    const sourceKey = viewUrl?.match(/nttSeqNo=(\d+)/)?.[1] ?? title;

    return {
      sourceCode: "msit",
      sourceKey,
      title,
      organization: pick(raw, ["deptName"]) ?? "과학기술정보통신부",
      region: "전국",
      target: null,
      supportType: "기술/R&D",
      summary: null,
      applyStart: toDate(pick(raw, ["pressDt"])),
      applyEnd: null, // 게시판 API라 접수 마감일 미제공 → 상시/미상
      detailUrl: viewUrl,
      raw,
    };
  },
};
