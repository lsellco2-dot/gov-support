// ── 어댑터 공통 유틸 ──────────────────────────────────────
// 공공데이터포털 API들은 문서와 실제 응답 필드명이 다른 경우가 잦음.
// pick()으로 후보 필드명을 순서대로 시도하고, 실제 샘플 응답 확인 후
// 각 어댑터 상단의 필드 후보 목록을 확정할 것.

export function pick(obj: any, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }
  return null;
}

/** 'YYYYMMDD' | 'YYYY-MM-DD' | 'YYYY.MM.DD' → 'YYYY-MM-DD' */
export function toDate(s: string | null): string | null {
  if (!s) return null;
  const digits = s.replace(/[^0-9]/g, "");
  if (digits.length < 8) return null;
  const y = digits.slice(0, 4);
  const m = digits.slice(4, 6);
  const d = digits.slice(6, 8);
  if (Number(m) < 1 || Number(m) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  return `${y}-${m}-${d}`;
}

/** '20240101 ~ 20240131' 형태의 기간 문자열 → [start, end] */
export function parseRange(s: string | null): [string | null, string | null] {
  if (!s) return [null, null];
  const parts = s.split(/\s*(?:~|∼|–|—|\s-\s)\s*/).map((p) => p.trim());
  if (parts.length >= 2) return [toDate(parts[0]), toDate(parts[1])];
  return [toDate(parts[0]), null];
}

export function stripHtml(value: string | null): string | null {
  if (!value) return null;
  return decodeHtmlEntities(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

/** 공공데이터포털 공통 GET + JSON 파싱 (재시도 1회) */
export async function fetchJson(url: string): Promise<any> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      // 일부 API는 에러를 XML로 반환 → JSON 파싱 실패 시 원문 일부를 에러로
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`JSON 아님: ${text.slice(0, 200)}`);
      }
    } catch (e) {
      if (attempt === 1) throw e;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

/** XML 전용 API(과기부 등)용: <item>...</item> 블록을 평면 객체 배열로 파싱 */
export async function fetchXmlItems(url: string): Promise<Record<string, string>[]> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const items: Record<string, string>[] = [];
  for (const [, block] of Array.from(text.matchAll(/<item>([\s\S]*?)<\/item>/g))) {
    const obj: Record<string, string> = {};
    for (const [, tag, val] of Array.from(block.matchAll(/<(\w+)>([^<]*)<\/\1>/g))) {
      obj[tag] = decodeXmlEntities(val.trim());
    }
    items.push(obj);
  }
  return items;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

export function buildUrl(base: string, params: Record<string, string | number>) {
  const u = new URL(base);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  return u.toString();
}

/** 응답 구조가 API마다 달라서, item 배열이 있을 법한 경로를 순서대로 탐색 */
export function extractItems(data: any): any[] {
  const candidates = [
    data?.response?.body?.items?.item,
    data?.response?.body?.items,
    data?.jsonArray,
    data?.data,
    data?.items,
    data?.body?.items,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
    if (c && typeof c === "object") return [c]; // 단건이 객체로 오는 경우
  }
  return [];
}
