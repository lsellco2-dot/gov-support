import "server-only";

import { performance } from "node:perf_hooks";
import {
  type AiLabCandidate,
  type AiLabSearchInput,
  type AiLabSearchResponse,
  sortAiLabCandidates,
} from "@/lib/admin/ai-lab-types";
import { announcementSourceLabel } from "@/lib/mobile/announcement-source";
import {
  evaluateNewMatchNotificationCandidate,
  isNationwideUserRegion,
  recommendationCategoryIds,
  type NewMatchNotificationAnnouncement,
} from "@/lib/mobile/recommendations";
import {
  policyDomainLabel,
  safeExternalHttpUrl,
  type PolicyDomain,
} from "@/lib/query/announcement-presentation";
import {
  CATEGORIES,
  getAnnouncementPresentations,
} from "@/lib/query/announcements";
import { announcementRegionPostgrestFilter } from "@/lib/regions";
import { supabaseAnon } from "@/lib/supabase/anon";

const PAGE_SIZE = 100;
const QUERY_CONCURRENCY = 3;
const ACTIVE_STATUSES = ["open", "upcoming"] as const;

type PublicAnnouncementRow = {
  id: number;
  source_id: number;
  title: string;
  organization: string | null;
  category_ids: number[];
  region: string | null;
  regions: string[] | null;
  target: string | null;
  support_type: string | null;
  apply_start: string | null;
  apply_end: string | null;
  detail_url: string | null;
  status: "open" | "upcoming";
  created_at: string;
};

type Presentation = Awaited<ReturnType<typeof getAnnouncementPresentations>>[number];

export async function runAiLabSearch(
  input: AiLabSearchInput,
): Promise<AiLabSearchResponse> {
  const totalStartedAt = performance.now();
  const dbStartedAt = performance.now();
  const categoryIds = recommendationCategoryIds(input.profile);

  const [totalResult, firstPage] = await Promise.all([
    supabaseAnon
      .from("announcements_public")
      .select("id", { count: "exact", head: true })
      .in("status", [...ACTIVE_STATUSES]),
    fetchCandidatePage(input, categoryIds, 1, true),
  ]);
  if (totalResult.error) throw new Error("AI_LAB_TOTAL_QUERY_FAILED");

  const pageCount = Math.ceil(firstPage.count / PAGE_SIZE);
  const remainingPages = Array.from(
    { length: Math.max(0, pageCount - 1) },
    (_, index) => index + 2,
  );
  const rest = await mapWithConcurrency(
    remainingPages,
    QUERY_CONCURRENCY,
    (page) => fetchCandidatePage(input, categoryIds, page, false),
  );
  const rows = [firstPage.rows, ...rest.map(({ rows: pageRows }) => pageRows)].flat();
  const dbMs = elapsed(dbStartedAt);

  const recommendationStartedAt = performance.now();
  const scored = rows.flatMap(({ row, presentation }) => {
    const announcement = toRecommendationAnnouncement(row, presentation);
    const evaluation = evaluateNewMatchNotificationCandidate(
      input.profile,
      announcement,
      input.include_nationwide,
    );
    if (!evaluation) return [];
    return [toCandidate(announcement, evaluation.score, evaluation.reasons)];
  });
  const candidates = sortAiLabCandidates(scored, input.sort).slice(
    0,
    input.candidate_limit,
  );
  const recommendationMs = elapsed(recommendationStartedAt);

  return {
    input,
    metrics: {
      total_public: totalResult.count ?? 0,
      rule_candidates: scored.length,
      final_candidates: candidates.length,
      db_ms: dbMs,
      recommendation_ms: recommendationMs,
      total_ms: elapsed(totalStartedAt),
    },
    candidates,
  };
}

async function fetchCandidatePage(
  input: AiLabSearchInput,
  categoryIds: number[],
  page: number,
  includeCount: boolean,
) {
  const from = (page - 1) * PAGE_SIZE;
  let query = supabaseAnon
    .from("announcements_public")
    .select(
      "id,source_id,title,organization,category_ids,region,regions,target,support_type,apply_start,apply_end,detail_url,status,created_at",
      includeCount ? { count: "exact" } : undefined,
    )
    .in("status", [...ACTIVE_STATUSES])
    .overlaps("category_ids", categoryIds)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (!isNationwideUserRegion(input.profile.region)) {
    const label = regionLabel(input.profile.region);
    const filter = label
      ? announcementRegionPostgrestFilter(label, {
          includeNationwide: input.include_nationwide,
          includeUnknown: false,
        })
      : null;
    if (filter) query = query.or(filter);
  }

  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error("AI_LAB_CANDIDATE_QUERY_FAILED");
  const publicRows = (data ?? []) as unknown as PublicAnnouncementRow[];
  const presentations = await getAnnouncementPresentations(
    publicRows.map(({ id }) => id),
  );
  const presentationById = new Map(
    presentations.map((presentation) => [presentation.id, presentation]),
  );
  return {
    count: count ?? publicRows.length,
    rows: publicRows.map((row) => ({
      row,
      presentation: presentationById.get(row.id) ?? null,
    })),
  };
}

function toRecommendationAnnouncement(
  row: PublicAnnouncementRow,
  presentation: Presentation | null,
): NewMatchNotificationAnnouncement {
  return {
    id: row.id,
    source: presentation?.source_code ?? null,
    source_name: presentation?.source_name ?? null,
    title: row.title,
    agency: row.organization,
    category_ids: row.category_ids,
    region: presentation?.region ?? row.region,
    regions: presentation?.regions ?? row.regions,
    target: row.target,
    support_type: row.support_type,
    status: row.status,
    apply_start: row.apply_start,
    apply_end: row.apply_end,
    created_at: row.created_at,
    detail_url: `/announcements/${row.id}`,
    original_url: safeExternalHttpUrl(row.detail_url),
    age_min: presentation?.age_min ?? null,
    age_max: presentation?.age_max ?? null,
    policy_domain: presentation?.policy_domain ?? null,
    source_status: presentation?.source_status ?? row.status,
  };
}

function toCandidate(
  announcement: NewMatchNotificationAnnouncement,
  score: number,
  reasons: string[],
): AiLabCandidate {
  const source = announcement.source ?? "unknown";
  const policyDomain = isPolicyDomain(announcement.policy_domain)
    ? announcement.policy_domain
    : null;
  return {
    id: announcement.id,
    title: announcement.title,
    source,
    source_name: announcementSourceLabel(source, announcement.source_name),
    agency: announcement.agency,
    region: announcement.region,
    regions: announcement.regions ?? null,
    apply_start: announcement.apply_start,
    apply_end: announcement.apply_end,
    status: announcement.status,
    score,
    reasons,
    category_ids: announcement.category_ids,
    category_names: announcement.category_ids.flatMap((id) => {
      const category = CATEGORIES.find((item) => item.id === id);
      return category ? [category.name] : [];
    }),
    policy_domain: policyDomain,
    policy_domain_label: policyDomainLabel(policyDomain),
    detail_url: `/announcements/${announcement.id}`,
    original_url: announcement.original_url,
  };
}

function regionLabel(region: string) {
  return REGION_LABELS[region] ?? null;
}

function isPolicyDomain(value: string | null | undefined): value is PolicyDomain {
  return (
    value === "employment_startup" ||
    value === "housing" ||
    value === "education_training" ||
    value === "finance_welfare_culture" ||
    value === "participation_infrastructure"
  );
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex++;
        results[index] = await mapper(values[index]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

function elapsed(startedAt: number) {
  return Math.round((performance.now() - startedAt) * 10) / 10;
}

const REGION_LABELS: Record<string, string> = {
  seoul: "서울",
  busan: "부산",
  daegu: "대구",
  incheon: "인천",
  gwangju: "광주",
  daejeon: "대전",
  ulsan: "울산",
  sejong: "세종",
  gyeonggi: "경기",
  gangwon: "강원",
  chungbuk: "충북",
  chungnam: "충남",
  jeonbuk: "전북",
  jeonnam: "전남",
  gyeongbuk: "경북",
  gyeongnam: "경남",
  jeju: "제주",
};
