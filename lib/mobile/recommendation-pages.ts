import type { NativeUserCondition } from "./app-bridge";
import {
  fetchOpenAnnouncements,
  type OpenAnnouncementsCandidateFilter,
  type OpenAnnouncementsPage,
} from "./open-announcements-client";
import type { OpenAnnouncementsSort } from "./open-announcements";
import {
  filterNationwideRecommendations,
  matchRecommendations,
  recommendationCategoryIds,
  type RecommendationResult,
} from "./recommendations";

const CANDIDATE_PAGE_SIZE = 100;
export const RECOMMENDATION_BATCH_SIZE = 10;

type FetchPage = (
  page: number,
  sort: OpenAnnouncementsSort,
  limit: number,
  filter: OpenAnnouncementsCandidateFilter,
  signal?: AbortSignal,
) => Promise<OpenAnnouncementsPage>;

export interface RecommendationBatchOptions {
  condition: NativeUserCondition;
  sort: OpenAnnouncementsSort;
  includeNationwide: boolean;
  currentPage: number;
  hasMoreCandidates: boolean;
  pending?: RecommendationResult[];
  batchSize?: number;
  fetchPage?: FetchPage;
  signal?: AbortSignal;
}

export interface RecommendationBatchVariant {
  includeNationwide: boolean;
  items: RecommendationResult[];
  pending: RecommendationResult[];
  lastPage: number;
  hasMoreCandidates: boolean;
}

export async function loadRecommendationBatch({
  condition,
  sort,
  includeNationwide,
  currentPage,
  hasMoreCandidates,
  pending = [],
  batchSize = RECOMMENDATION_BATCH_SIZE,
  fetchPage = fetchOpenAnnouncements,
  signal,
}: RecommendationBatchOptions) {
  const candidates = [...pending];
  const fetchedCandidates: RecommendationResult[] = [];
  const canBuildAlternate = currentPage === 0 && pending.length === 0;
  let lastPage = currentPage;
  let canFetchMore = hasMoreCandidates;
  const categoryIds = recommendationCategoryIds(condition);

  if (categoryIds.length === 0) {
    return {
      items: candidates.slice(0, batchSize),
      pending: candidates.slice(batchSize),
      lastPage,
      hasMoreCandidates: false,
      alternate: null,
    };
  }

  const filter: OpenAnnouncementsCandidateFilter = {
    categoryIds,
    userRegion: condition.region,
    // Fetch the superset once so both nationwide filter states can share it.
    includeNationwide: true,
  };

  while (candidates.length < batchSize && canFetchMore) {
    const page = await fetchPage(
      lastPage + 1,
      sort,
      CANDIDATE_PAGE_SIZE,
      filter,
      signal,
    );
    const recommendations = matchRecommendations(condition, page.data);
    if (canBuildAlternate) {
      appendUnique(fetchedCandidates, recommendations);
    }
    const visibleRecommendations = filterNationwideRecommendations(
      recommendations,
      condition.region,
      includeNationwide,
    );
    appendUnique(candidates, visibleRecommendations);
    lastPage = page.pagination.page;
    canFetchMore = page.pagination.has_more;
  }

  const alternate = canBuildAlternate
    ? buildAlternateVariant({
        candidates: fetchedCandidates,
        condition,
        includeNationwide: !includeNationwide,
        batchSize,
        lastPage,
        hasMoreCandidates: canFetchMore,
      })
    : null;

  return {
    items: candidates.slice(0, batchSize),
    pending: candidates.slice(batchSize),
    lastPage,
    hasMoreCandidates: canFetchMore,
    alternate,
  };
}

function buildAlternateVariant({
  candidates,
  condition,
  includeNationwide,
  batchSize,
  lastPage,
  hasMoreCandidates,
}: {
  candidates: RecommendationResult[];
  condition: NativeUserCondition;
  includeNationwide: boolean;
  batchSize: number;
  lastPage: number;
  hasMoreCandidates: boolean;
}): RecommendationBatchVariant {
  const visible = filterNationwideRecommendations(
    candidates,
    condition.region,
    includeNationwide,
  );
  return {
    includeNationwide,
    items: visible.slice(0, batchSize),
    pending: visible.slice(batchSize),
    lastPage,
    hasMoreCandidates,
  };
}

function appendUnique(
  target: RecommendationResult[],
  additions: RecommendationResult[],
) {
  const seen = new Set(target.map(({ announcement }) => announcement.id));
  for (const candidate of additions) {
    if (seen.has(candidate.announcement.id)) continue;
    seen.add(candidate.announcement.id);
    target.push(candidate);
  }
}
