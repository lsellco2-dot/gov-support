import { createHash } from "node:crypto";
import { load } from "cheerio";
import type { FetchedAnnouncementDetail } from "../detail";
import { normalizeIntegratedRegionName } from "../../regions";

// e나라도움은 XML 엔티티로 이스케이프된 CDATA 구분자를 문자열로 반환하기도 한다.
export function unwrapServiceCdata(value: string): string {
  const text = value.trim();
  return text.startsWith("<![CDATA[") && text.endsWith("]]>") ? text.slice(9, -3).trim() : text;
}

export function serviceText(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const $ = load(unwrapServiceCdata(value).replace(/<br\s*\/?\s*>/gi, "\n"));
  $("script,style").remove();
  return $.root().text().trim() || null;
}

export function apiDetail(sections: [string, unknown][], extra: {
  applyMethod?: unknown; documents?: unknown; contact?: unknown; target?: unknown;
} = {}): FetchedAnnouncementDetail | undefined {
  const detailContent = sections.map(([label, value]) => {
    const text = serviceText(value);
    return text ? `${label}\n${text}` : "";
  }).filter(Boolean).join("\n\n");
  if (!detailContent) return undefined;
  const detail = {
    detailContent,
    applyMethod: serviceText(extra.applyMethod),
    documents: serviceText(extra.documents),
    contact: serviceText(extra.contact),
    target: serviceText(extra.target) ?? undefined,
    attachments: [],
  };
  return { ...detail, contentHash: createHash("sha256").update(JSON.stringify(detail)).digest("hex") };
}

export function explicitRegion(value: unknown): string {
  const text = serviceText(value);
  if (!text) return "미확인";
  const integrated = normalizeIntegratedRegionName(text);
  if (integrated) return integrated;
  const aliases: Record<string, string> = {
    서울특별시: "서울", 부산광역시: "부산", 대구광역시: "대구", 인천광역시: "인천",
    광주광역시: "광주", 대전광역시: "대전", 울산광역시: "울산", 세종특별자치시: "세종",
    경기도: "경기", 강원특별자치도: "강원", 강원도: "강원", 충청북도: "충북", 충청남도: "충남",
    전북특별자치도: "전북", 전라북도: "전북", 전라남도: "전남", 경상북도: "경북",
    경상남도: "경남", 제주특별자치도: "제주", 제주도: "제주",
  };
  if (aliases[text]) return aliases[text];
  return ["전국", ...Object.values(aliases)].includes(text) ? text : "미확인";
}

/** Fixed public endpoints only. Never log the URL, response body, or API credential. */
export async function fetchPublicText(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
  } catch {
    throw new Error("PUBLIC_SOURCE_NETWORK_ERROR");
  }
  if (!response.ok) throw new Error(`PUBLIC_SOURCE_HTTP_${response.status}`);
  const text = await response.text();
  if (text.length > 8_000_000) throw new Error("PUBLIC_SOURCE_RESPONSE_TOO_LARGE");
  return text;
}

export function parseServiceXml(text: string, itemTag: string) {
  const $ = load(text, { xmlMode: true });
  const code = $("returnReasonCode,resultCode").first().text().trim();
  if (!code || !["0", "00", "0000"].includes(code)) {
    throw new Error("PUBLIC_SOURCE_API_REJECTED");
  }
  const total = Number($("totalCount").first().text());
  const items: Record<string, string>[] = [];
  $(itemTag).each((_, element) => {
    const row: Record<string, string> = {};
    $(element).children().each((__, child) => {
      if (child.type === "tag") row[child.name] = unwrapServiceCdata($(child).text());
    });
    items.push(row);
  });
  return { $, total, items };
}

export function checkPageProgress(items: unknown[], total: number, collected: number) {
  if (!Number.isInteger(total) || total < 0 || (items.length === 0 && collected < total)) {
    throw new Error("PUBLIC_SOURCE_INCOMPLETE_PAGE");
  }
}
