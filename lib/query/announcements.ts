import { supabaseAnon } from "@/lib/supabase/anon";
import { FIXTURES } from "./fixtures";

// Supabase 미연결 상태에서 UI 개발용: fixtures를 메모리에서 검색/필터/정렬/페이지네이션
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export interface ListParams {
  q?: string;
  category?: number;
  region?: string;
  status?: "open" | "closed" | "all";
  sort?: "deadline" | "latest";
  page?: number;
  size?: number;
}

export interface AnnouncementRow {
  id: number;
  source_id: number;
  title: string;
  organization: string | null;
  category_ids: number[];
  region: string | null;
  target: string | null;
  support_type: string | null;
  summary: string | null;
  apply_start: string | null;
  apply_end: string | null;
  detail_url: string | null;
  status: "open" | "closed";
  created_at: string;
}

export const CATEGORIES = [
  { id: 1, name: "창업지원" },
  { id: 2, name: "소상공인 지원" },
  { id: 3, name: "자금/대출/보증" },
  { id: 4, name: "마케팅/판로" },
  { id: 5, name: "고용/인건비" },
  { id: 6, name: "기술/R&D" },
  { id: 7, name: "수출/해외진출" },
  { id: 8, name: "교육/컨설팅" },
  { id: 9, name: "시설/디지털전환" },
] as const;

export const REGIONS = [
  "전국","서울","부산","대구","인천","광주","대전","울산","세종",
  "경기","강원","충북","충남","전북","전남","경북","경남","제주",
] as const;

const MAX_SIZE = 50;

/** mock 모드: DB 쿼리와 동일한 조건으로 fixtures를 메모리 처리 */
function listFromFixtures(p: ListParams, page: number, size: number) {
  let rows = FIXTURES.slice();

  const status = p.status ?? "open";
  if (status !== "all") rows = rows.filter((r) => r.status === status);
  if (p.q) {
    const needle = p.q.toLowerCase();
    rows = rows.filter((r) => r.title.toLowerCase().includes(needle));
  }
  if (p.category) rows = rows.filter((r) => r.category_ids.includes(p.category!));
  if (p.region && p.region !== "전국") {
    rows = rows.filter((r) => r.region === p.region || r.region === "전국");
  }

  if (p.sort === "latest") {
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  } else {
    // 기본: 마감 임박순 (상시=null은 뒤로)
    rows.sort((a, b) => {
      if (a.apply_end === null && b.apply_end === null) return 0;
      if (a.apply_end === null) return 1;
      if (b.apply_end === null) return -1;
      return a.apply_end.localeCompare(b.apply_end);
    });
  }

  const from = (page - 1) * size;
  return {
    items: rows.slice(from, from + size),
    total: rows.length,
    page,
    size,
  };
}

/** 목록 조회 — 중복 제거된 뷰(announcements_public) 기준 */
export async function listAnnouncements(p: ListParams) {
  const page = Math.max(1, p.page ?? 1);
  const size = Math.min(MAX_SIZE, Math.max(1, p.size ?? 20));
  const from = (page - 1) * size;

  if (USE_MOCK) return listFromFixtures(p, page, size);

  let q = supabaseAnon
    .from("announcements_public")
    .select(
      "id,source_id,title,organization,category_ids,region,target,support_type,apply_start,apply_end,detail_url,status,created_at",
      { count: "exact" }
    );

  const status = p.status ?? "open";
  if (status !== "all") q = q.eq("status", status);
  if (p.q) q = q.ilike("title", `%${p.q}%`);
  if (p.category) q = q.contains("category_ids", [p.category]);
  if (p.region && p.region !== "전국") q = q.in("region", [p.region, "전국"]);

  if (p.sort === "latest") {
    q = q.order("created_at", { ascending: false });
  } else {
    // 기본: 마감 임박순 (상시=null은 뒤로)
    q = q.order("apply_end", { ascending: true, nullsFirst: false });
  }

  const { data, count, error } = await q.range(from, from + size - 1);
  if (error) throw new Error(error.message);

  return {
    items: (data ?? []) as AnnouncementRow[],
    total: count ?? 0,
    page,
    size,
  };
}

export async function getAnnouncement(id: number) {
  if (USE_MOCK) {
    return (FIXTURES.find((r) => r.id === id) ?? null) as
      | (AnnouncementRow & { summary: string | null })
      | null;
  }

  const { data, error } = await supabaseAnon
    .from("announcements_public")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as (AnnouncementRow & { summary: string | null }) | null;
}
