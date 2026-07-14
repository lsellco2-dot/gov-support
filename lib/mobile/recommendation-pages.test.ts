import assert from "node:assert/strict";
import test from "node:test";
import type { NativeUserCondition } from "./app-bridge";
import type { OpenAnnouncementsPage } from "./open-announcements-client";
import { loadRecommendationBatch } from "./recommendation-pages";
import type { OpenAnnouncement } from "./recommendations";

const condition: NativeUserCondition = {
  user_type: "small_business",
  region: "seoul",
  industry: "retail",
  interests: ["finance_loan_guarantee"],
  startup_years: "years_1_3",
  onboarding_completed: true,
  schema_version: 1,
};

test("continues past an empty filtered candidate page before showing empty state", async () => {
  const calls: Array<{
    page: number;
    sort: string;
    limit: number;
    categories: number[];
    userRegion: string;
    includeNationwide: boolean;
  }> = [];
  const pages = new Map([
    [1, candidatePage(1, [announcement(1, "전국"), announcement(2, null)], true)],
    [2, candidatePage(2, [announcement(3, "서울")], false)],
  ]);

  const batch = await loadRecommendationBatch({
    condition,
    sort: "latest",
    includeNationwide: false,
    currentPage: 0,
    hasMoreCandidates: true,
    batchSize: 1,
    fetchPage: async (page, sort, limit, filter) => {
      calls.push({
        page,
        sort,
        limit,
        categories: filter.categoryIds,
        userRegion: filter.userRegion,
        includeNationwide: filter.includeNationwide,
      });
      return pages.get(page)!;
    },
  });

  assert.deepEqual(batch.items.map(({ announcement: item }) => item.id), [3]);
  assert.deepEqual(calls, [
    {
      page: 1,
      sort: "latest",
      limit: 100,
      categories: [3],
      userRegion: "seoul",
      includeNationwide: false,
    },
    {
      page: 2,
      sort: "latest",
      limit: 100,
      categories: [3],
      userRegion: "seoul",
      includeNationwide: false,
    },
  ]);
  assert.equal(batch.hasMoreCandidates, false);
});

test("skips candidate API calls when no supported interest category is selected", async () => {
  let calls = 0;
  const batch = await loadRecommendationBatch({
    condition: { ...condition, interests: ["unsupported"] },
    sort: "latest",
    includeNationwide: true,
    currentPage: 0,
    hasMoreCandidates: true,
    fetchPage: async () => {
      calls += 1;
      return candidatePage(1, [], false);
    },
  });

  assert.equal(calls, 0);
  assert.deepEqual(batch.items, []);
  assert.equal(batch.hasMoreCandidates, false);
});

test("nationwide inclusion preserves the original sorted candidate order", async () => {
  const batch = await loadRecommendationBatch({
    condition,
    sort: "latest",
    includeNationwide: true,
    currentPage: 0,
    hasMoreCandidates: true,
    batchSize: 2,
    fetchPage: async () =>
      candidatePage(1, [announcement(1, "전국"), announcement(2, null)], false),
  });

  assert.deepEqual(batch.items.map(({ announcement: item }) => item.id), [1, 2]);
});

test("load more reuses deadline sort and nationwide exclusion", async () => {
  const sorts: string[] = [];
  const first = await loadRecommendationBatch({
    condition,
    sort: "deadline",
    includeNationwide: false,
    currentPage: 0,
    hasMoreCandidates: true,
    batchSize: 1,
    fetchPage: async (_page, sort) => {
      sorts.push(sort);
      return candidatePage(1, [announcement(1, "서울")], true);
    },
  });
  const more = await loadRecommendationBatch({
    condition,
    sort: "deadline",
    includeNationwide: false,
    currentPage: first.lastPage,
    hasMoreCandidates: first.hasMoreCandidates,
    pending: first.pending,
    batchSize: 1,
    fetchPage: async (_page, sort) => {
      sorts.push(sort);
      return candidatePage(
        2,
        [announcement(2, "전국"), announcement(3, null), announcement(4, "서울")],
        false,
      );
    },
  });

  assert.deepEqual(more.items.map(({ announcement: item }) => item.id), [4]);
  assert.deepEqual(sorts, ["deadline", "deadline"]);
});

function candidatePage(
  page: number,
  data: OpenAnnouncement[],
  hasMore: boolean,
): OpenAnnouncementsPage {
  return {
    data,
    pagination: {
      page,
      limit: 100,
      total: hasMore ? 200 : page * 100,
      total_pages: hasMore ? page + 1 : page,
      has_more: hasMore,
    },
  };
}

function announcement(id: number, region: string | null): OpenAnnouncement {
  return {
    id,
    source: "bizinfo",
    title: `공고 ${id}`,
    agency: "기관",
    category_ids: [3],
    region,
    target: "소상공인",
    support_type: "융자",
    status: "open",
    apply_start: "2026-07-01",
    apply_end: "2026-08-31",
    created_at: `2026-07-${String(20 - id).padStart(2, "0")}T00:00:00.000Z`,
    detail_url: `https://gov-support-nine.vercel.app/app/announcements/${id}`,
    original_url: null,
  };
}
