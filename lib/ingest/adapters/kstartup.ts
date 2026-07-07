import type { SourceAdapter } from "../types";
import { buildUrl, extractItems, fetchJson, pick, toDate } from "./util";

// K-Startup 조회서비스 중 "사업공고" 오퍼레이션만 수집 (사업소개/콘텐츠 제외)
const ENDPOINT =
  process.env.KSTARTUP_ENDPOINT ??
  "https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01";

const PER_PAGE = 100;
const MAX_PAGES = 100;

export const kstartup: SourceAdapter = {
  sourceCode: "kstartup",

  async *fetchPages({ serviceKey }) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = buildUrl(ENDPOINT, {
        serviceKey,
        page,
        perPage: PER_PAGE,
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
    // K-Startup 응답이 { col: [...] } 형태로 감싸져 오는 경우 대비
    const item = raw?.col ?? raw;
    const title = pick(item, ["biz_pbanc_nm", "pbancNm", "title", "intg_pbanc_biz_nm"]);
    const sourceKey = pick(item, ["pbanc_sn", "pbancSn", "id"]) ?? title;
    if (!title || !sourceKey) return null;

    return {
      sourceCode: "kstartup",
      sourceKey,
      title,
      organization: pick(item, ["pbanc_ntrp_nm", "spnsr_organ_nm", "organNm"]),
      region: pick(item, ["supt_regin", "region"]) ?? "전국",
      target: pick(item, ["aply_trgt_ctnt", "aply_trgt", "target"]),
      supportType: pick(item, ["supt_biz_clsfc", "bizClsfc"]),
      summary: pick(item, ["pbanc_ctnt", "summary"]),
      applyStart: toDate(pick(item, ["pbanc_rcpt_bgng_dt", "rcptBgngDt"])),
      applyEnd: toDate(pick(item, ["pbanc_rcpt_end_dt", "rcptEndDt"])),
      detailUrl: pick(item, ["detl_pg_url", "detailUrl", "url"]),
      raw,
    };
  },
};
