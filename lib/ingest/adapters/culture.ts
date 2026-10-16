import { load } from "cheerio";
import type { SourceAdapter } from "../types";
import { buildUrl, toDate } from "./util";
import { fetchPublicText } from "./public-service";

export interface CultureListing {
  id: string; title: string; organization: string; target: string;
  supportType: string; end: string | null; url: string;
}

// Metadata/link index only. No copying third-party notice bodies or attachments.
export function parseCultureList(html: string) {
  const $ = load(html);
  if (!$("#result_rcrtinfo").length) throw new Error("CULTURE_LIST_STRUCTURE_CHANGED");
  const items: CultureListing[] = [];
  $("#result_rcrtinfo > ul > li").each((_, el) => {
    const item = $(el);
    const href = item.find("a.tit").attr("href");
    if (!href) return;
    const url = new URL(href, "https://www.culture.go.kr");
    const id = url.searchParams.get("rcrtSn");
    const title = item.find(".tit__title").text().trim();
    if (!id || !/^\d+$/.test(id) || !title || url.hostname !== "www.culture.go.kr") throw new Error("CULTURE_INVALID_LIST_ITEM");
    const cleanUrl = buildUrl("https://www.culture.go.kr/portal/cltBnf/cltSup/view.do", {
      menuNo: "200104", rcrtSn: id, viewTp: url.searchParams.get("viewTp") ?? "2",
    });
    items.push({
      id, title, organization: item.find("a.logo").text().trim(),
      target: item.find(".support-txt").text().trim(), supportType: item.find(".badge-box").map((_, badge) => $(badge).text().trim()).get().join(", "),
      end: toDate(item.find(".d-day .num").text().trim()), url: cleanUrl,
    });
  });
  const pages = $(".pagination-set a").map((_, e) => Number($(e).attr("href")?.match(/fnSearch\((\d+)\)/)?.[1] ?? 1)).get();
  return { items, lastVisiblePage: Math.max(1, ...pages) };
}

export const culture: SourceAdapter = {
  sourceCode: "culture", name: "문화포털 문화지원사업",
  enableEnv: "INGEST_CULTURE_ENABLED", skipHtmlDetails: true,
  async *fetchPages() {
    const seen = new Set<string>();
    for (const status of ["S", "W"]) {
      for (let page = 1; page <= 100; page++) {
        const url = buildUrl("https://www.culture.go.kr/portal/cltBnf/cltSup/list.do", {
          menuNo: "200104", pageIndex: page, searchPageUnit: 50, searchSttscd: status, sSort: "2",
        });
        const { items, lastVisiblePage } = parseCultureList(await fetchPublicText(url));
        const unique = items.filter(item => !seen.has(item.id));
        if (items.length > 0 && unique.length === 0 && page > 1) throw new Error("CULTURE_REPEATED_PAGE");
        for (const item of unique) seen.add(item.id);
        if (unique.length) yield unique;
        if (page >= lastVisiblePage) break;
        if (!items.length) throw new Error("CULTURE_INCOMPLETE_PAGE");
        if (page === 100) throw new Error("CULTURE_PAGE_LIMIT_REACHED");
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  },
  normalize(raw: unknown) {
    const item = raw as CultureListing;
    if (!item.id || !item.title) return null;
    return {
      sourceCode: "culture", sourceKey: item.id, title: item.title,
      organization: item.organization || null, target: item.target || null,
      region: "미확인", supportType: item.supportType || null,
      summary: `문화지원사업 · ${item.supportType || "유형 확인 필요"}`,
      applyStart: null, applyEnd: item.end, detailUrl: item.url, raw,
    };
  },
};
