import type { SourceAdapter } from "../types";
import { buildUrl, extractItems, fetchJson, parseRange, pick, stripHtml, toDate } from "./util";

// 기업마당(bizinfo.go.kr) 자체 오픈API — data.go.kr 인증키가 아니라
// 기업마당 사이트에서 별도 발급하는 crtfcKey가 필요 (BIZINFO_KEY 환경변수).
// 신청: bizinfo.go.kr → 활용정보 → 정책정보 개방(OpenAPI) → 인증키 발급
const ENDPOINT =
  process.env.BIZINFO_ENDPOINT ?? "https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do";

const FETCH_COUNT = 2000; // 최신 2,000건 (이 API는 페이지 대신 searchCnt로 개수 지정)

export const bizinfo: SourceAdapter = {
  sourceCode: "bizinfo",

  async *fetchPages() {
    const key = process.env.BIZINFO_KEY;
    if (!key) {
      throw new Error(
        "BIZINFO_KEY 없음 — 기업마당(bizinfo.go.kr) 오픈API 인증키를 발급받아 .env.local에 설정하세요."
      );
    }
    const url = buildUrl(ENDPOINT, {
      crtfcKey: key,
      dataType: "json",
      searchCnt: FETCH_COUNT,
    });
    const data = await fetchJson(url);
    if (data?.reqErr) throw new Error(`기업마당 API 오류: ${data.reqErr}`);
    const items = extractItems(data); // 응답이 { jsonArray: [...] } 형태
    if (items.length > 0) yield items;
  },

  normalize(raw: any) {
    const title = pick(raw, ["pblancNm", "pblancName", "title", "bsnsTitle"]);
    const sourceKey =
      pick(raw, ["pblancId", "pblancSn", "id", "seq"]) ??
      pick(raw, ["pblancUrl"])?.match(/pblancId=([\w]+)/)?.[1] ??
      title;
    if (!title || !sourceKey) return null;

    const [start1, end1] = parseRange(
      pick(raw, ["reqstBeginEndDe", "reqstDe", "applyPeriod"])
    );

    // pblancUrl이 상대경로("/web/...")로 오는 경우 절대경로로 보정
    const rawUrl = pick(raw, ["pblancUrl", "detailUrl", "url"]);
    const detailUrl = rawUrl?.startsWith("/") ? `https://www.bizinfo.go.kr${rawUrl}` : rawUrl;

    return {
      sourceCode: "bizinfo",
      sourceKey,
      title,
      organization: pick(raw, ["jrsdInsttNm", "excInsttNm", "insttNm", "organNm"]),
      region: pick(raw, ["areaNm", "regionNm"]) ?? "전국",
      target: pick(raw, ["trgetNm", "targetNm", "aplyTrgt"]),
      supportType: pick(raw, ["pldirSportRealmLclasCodeNm", "sportRealmNm", "suptType"]),
      summary: stripHtml(pick(raw, ["bsnsSumryCn", "sumryCn", "summary"])),
      applyStart: start1 ?? toDate(pick(raw, ["reqstBeginDe", "applyStart"])),
      applyEnd: end1 ?? toDate(pick(raw, ["reqstEndDe", "applyEnd"])),
      detailUrl,
      raw,
    };
  },
};
