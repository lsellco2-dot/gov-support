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
  let lastPage = currentPage;
  let canFetchMore = hasMoreCandidates;
  const categoryIds = recommendationCategoryIds(condition);

  if (categoryIds.length === 0) {
    return {
      items: candidates.slice(0, batchSize),
      pending: candidates.slice(batchSize),
      lastPage,
      hasMoreCandidates: false,
    };
  }

  const filter: OpenAnnouncementsCandidateFilter = {
    categoryIds,
    userRegion: condition.region,
    includeNationwide,
  };

  while (candidates.length < batchSize && canFetchMore) {
    const page = await fetchPage(
      lastPage + 1,
      sort,
      CANDIDATE_PAGE_SIZE,
      filter,
      signal,
    );
    const recommendations = filterNationwideRecommendations(
      matchRecommendations(condition, page.data),
      condition.region,
      includeNationwide,
    );
    const seen = new Set(candidates.map(({ announcement }) => announcement.id));
    candidates.push(
      ...recommendations.filter(({ announcement }) => !seen.has(announcement.id)),
    );
    lastPage = page.pagination.page;
    canFetchMore = page.pagination.has_more;
  }

  return {
    items: candidates.slice(0, batchSize),
    pending: candidates.slice(batchSize),
    lastPage,
    hasMoreCandidates: canFetchMore,
  };
}
