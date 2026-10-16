import { createHash } from "node:crypto";
import type { SourceAdapter } from "../types";
import { buildUrl, toDate } from "./util";
import { apiDetail, checkPageProgress, fetchPublicText, parseServiceXml, serviceText, unwrapServiceCdata } from "./public-service";

export async function fetchEnaraText(
  url: string,
  request = fetchPublicText,
  wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try { return await request(url, 45_000); }
    catch (error) {
      const code = error instanceof Error ? error.message : "";
      // 조회 GET의 일시 장애만 최대 2회 재시도. 인증/할당량/스키마 오류는 즉시 중단.
      if (attempt >= 2 || !/^PUBLIC_SOURCE_(NETWORK_ERROR|HTTP_50[234])$/.test(code)) throw error;
      console.warn(`[enara] 원천 통신 재시도 ${attempt + 1}/2: ${code}`);
      await wait((attempt + 1) * 2_000);
    }
  }
}

// 종합 API에는 일반 보조사업도 포함된다. 공고명 필터로 공모 연결 행만 요청한다.
export const enara: SourceAdapter = {
  sourceCode: "enara", name: "e나라도움 국고보조금 공모사업",
  requiresLongRunningJob: true,
  enableEnv: "INGEST_ENARA_ENABLED", keyEnv: "ENARA_API_KEY", skipHtmlDetails: true,
  async *fetchPages({ serviceKey }) {
    const year = Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Seoul", year: "numeric" }).format(new Date()));
    const seen = new Set<string>();
    // 최신 모집 공고를 먼저 반영하고, 전년도 계속 모집 공고도 빠뜨리지 않는다.
    for (const businessYear of [year, year - 1]) {
      let collected = 0;
      for (let page = 1; page <= 100; page++) {
        const url = buildUrl("https://apis.data.go.kr/1051000/MoefOpenAPI2025/T_OPD_ASBS_PBNS_UNITY", {
          // 2026-10-16 실응답: '%'는 공고명이 있는 행만 반환한다. 무필터 20만여 사업 행 스캔 방지.
          serviceKey, pageNo: page, numOfRows: 500, resultType: "xml", bsnsyear: businessYear, pblanc_nm: "%",
        });
        // 장시간 CLI 전용. 해외 runner에서 원천 응답 본문 수신까지 15초를 넘길 수 있다.
        const { items, total } = parseServiceXml(await fetchEnaraText(url), "item");
        checkPageProgress(items, total, collected);
        collected += items.length;
        if (page % 10 === 0 || collected >= total) {
          console.log(JSON.stringify({ source: "enara", year: businessYear, page, collected, total }));
        }
        const calls: typeof items = [];
        for (const item of items) {
          if (!item.PBLANC_NM || !item.PBLANC_POPUP_URL) throw new Error("ENARA_CALL_FILTER_INVALID");
          // 하나의 공고에 여러 보조사업이 연결되어 동일 공고 행이 반복될 수 있다.
          if (!seen.has(item.PBLANC_POPUP_URL)) {
            seen.add(item.PBLANC_POPUP_URL);
            calls.push(item);
          }
        }
        if (calls.length) yield calls;
        if (collected >= total) break;
        if (page === 100) throw new Error("ENARA_PAGE_LIMIT_REACHED");
      }
    }
  },
  normalize(raw: unknown) {
    const row = raw as Record<string, string>;
    const title = serviceText(row.PBLANC_NM);
    let url: URL;
    try { url = new URL(unwrapServiceCdata(row.PBLANC_POPUP_URL)); } catch { return null; }
    if (!title || !["https:", "http:"].includes(url.protocol) || !/(^|\.)(bojo|gosims)\.go\.kr$/.test(url.hostname)) return null;
    const target = serviceText(row.SPORT_TRGET_CN);
    return {
      sourceCode: "enara", sourceKey: createHash("sha256").update(url.href).digest("hex"),
      title, organization: serviceText(row.DLVPL_NM || row.JRSD_NM),
      // CTPRVN_NM describes the implementing body; it is not applicant eligibility.
      region: "미확인", target, supportType: "국고보조금 공모",
      summary: serviceText(row.SPORT_CN_DC || row.DDTLBZ_BSNS_PURPS_DC),
      applyStart: toDate(row.RCEPT_BEGIN_DE), applyEnd: toDate(row.RCEPT_END_DE),
      detailUrl: url.href,
      detail: apiDetail([
        ["지원내용", row.SPORT_CN_DC], ["지원대상", target], ["지원조건", row.SPORT_CND_CN],
        ["선정기준", row.SLCTN_STDR_DC], ["제외대상", row.EXCL_TRGET_CN],
        ["접수기간", row.RCEPT_PD_DC], ["신청방법", row.REQST_RCEPT_MTH_CN],
        ["제출서류", row.PRESENTN_PAPERS_GUIDANCE_CN],
      ], { applyMethod: row.REQST_RCEPT_MTH_CN, documents: row.PRESENTN_PAPERS_GUIDANCE_CN }), raw,
    };
  },
};
