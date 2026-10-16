import type { NormalizedAnnouncement, SourceAdapter } from "../types";
import { buildUrl } from "./util";
import { apiDetail, checkPageProgress, explicitRegion, fetchPublicText, parseServiceXml, serviceText } from "./public-service";

export function createBokjiAdapter(local: boolean): SourceAdapter {
  const sourceCode = local ? "bokji-local" : "bokji-central";
  const keyEnv = local ? "BOKJI_LOCAL_API_KEY" : "BOKJI_CENTRAL_API_KEY";
  const base = local
    ? "https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations/"
    : "https://apis.data.go.kr/B554287/NationalWelfareInformationsV001/";
  return {
    sourceCode, keyEnv,
    name: local ? "복지로 지자체 복지서비스" : "복지로 중앙부처 복지서비스",
    enableEnv: local ? "INGEST_BOKJI_LOCAL_ENABLED" : "INGEST_BOKJI_CENTRAL_ENABLED",
    skipHtmlDetails: true,
    async *fetchPages({ serviceKey }) {
      let collected = 0;
      const seen = new Set<string>();
      // Central development keys allow 100 requests/day; details have a separate per-run budget.
      for (let page = 1; page <= 50; page++) {
        const url = buildUrl(base + (local ? "LcgvWelfarelist" : "NationalWelfarelistV001"), {
          serviceKey, pageNo: page, numOfRows: 500, srchKeyCode: "003",
          ...(local ? {} : { callTp: "L" }),
        });
        const { items, total } = parseServiceXml(await fetchPublicText(url), "servList");
        checkPageProgress(items, total, collected);
        for (const item of items) {
          if (!item.servId || seen.has(item.servId)) throw new Error("BOKJI_DUPLICATE_OR_MISSING_ID");
          seen.add(item.servId);
        }
        collected += items.length;
        if (items.length) yield items;
        if (collected >= total) return;
      }
      throw new Error("BOKJI_PAGE_LIMIT_REACHED");
    },
    normalize(raw: unknown): NormalizedAnnouncement | null {
      const row = raw as Record<string, string>;
      const title = serviceText(row.servNm);
      if (!title || !row.servId) return null;
      return {
        sourceCode, sourceKey: row.servId, title,
        organization: serviceText(local ? [row.ctpvNm, row.sggNm, row.bizChrDeptNm].filter(Boolean).join(" ") : row.jurMnofNm),
        region: local ? explicitRegion(row.ctpvNm) : "미확인",
        // Life-stage and household labels are not complete eligibility conditions.
        target: null, supportType: serviceText(row.srvPvsnNm),
        summary: ["복지서비스", serviceText(row.servDgst), serviceText(row.intrsThemaNmArray ?? row.intrsThemaArray)].filter(Boolean).join("\n"),
        applyStart: null, applyEnd: null,
        detailUrl: safeBokjiUrl(row.servDtlLink), raw,
      };
    },
    async fetchDetail(announcement) {
      const serviceKey = process.env[keyEnv] ?? process.env.DATA_GO_KR_KEY;
      if (!serviceKey) throw new Error("BOKJI_API_KEY_MISSING");
      const url = buildUrl(base + (local ? "LcgvWelfaredetailed" : "NationalWelfaredetailedV001"), {
        serviceKey, servId: announcement.sourceKey, ...(local ? {} : { callTp: "D" }),
      });
      const { $ } = parseServiceXml(await fetchPublicText(url), "unused");
      const value = (tag: string) => $(tag).first().text();
      if (value("servId") !== announcement.sourceKey) throw new Error("BOKJI_DETAIL_ID_MISMATCH");
      const target = value(local ? "sprtTrgtCn" : "tgtrDtlCn");
      const method = local ? value("aplyMtdCn") : $("applmetList servSeDetailNm").map((_, e) => $(e).text()).get().join("\n");
      const contact = local ? $("inqplCtadrList wlfareInfoReldCn").map((_, e) => $(e).text()).get().join("\n") : value("rprsCtadr");
      const detail = apiDetail([
        ["지원대상", target], ["선정기준", value("slctCritCn")], ["지원내용", value("alwServCn")], ["신청방법", method],
      ], { target, applyMethod: method, contact });
      // 시행기간 is not 접수기간. Do not manufacture an application deadline.
      if (!detail) throw new Error("BOKJI_EMPTY_DETAIL");
      return detail;
    },
  };
}

function safeBokjiUrl(value: string | undefined): string | null {
  try {
    const url = new URL(value ?? "");
    return ["https:", "http:"].includes(url.protocol) && (url.hostname === "bokjiro.go.kr" || url.hostname.endsWith(".bokjiro.go.kr")) ? url.href : null;
  } catch { return null; }
}

export const bokjiCentral = createBokjiAdapter(false);
export const bokjiLocal = createBokjiAdapter(true);
