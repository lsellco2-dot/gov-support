"use client";

import Link from "next/link";
import { LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useState } from "react";
import { useEffect } from "react";
import CategoryChips from "./CategoryChips";
import FavoriteButton from "./FavoriteButton";
import CardApplicationDates from "./CardApplicationDates";
import {
  getRecommendationsBridgeAvailability,
  getUserCondition,
  type NativeUserCondition,
} from "@/lib/mobile/app-bridge";
import { fetchOpenAnnouncements } from "@/lib/mobile/open-announcements-client";
import type { OpenAnnouncementsSort } from "@/lib/mobile/open-announcements";
import {
  matchRecommendations,
  type RecommendationResult,
} from "@/lib/mobile/recommendations";

type State = "loading" | "browser" | "outdated" | "ready" | "error" | "no-condition";

export default function AppRecommendationsPage() {
  const [state, setState] = useState<State>("loading");
  const [condition, setCondition] = useState<NativeUserCondition | null>(null);
  const [items, setItems] = useState<RecommendationResult[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sort, setSort] = useState<OpenAnnouncementsSort>("latest");

  const load = useCallback(async () => {
    const availability = getRecommendationsBridgeAvailability();
    if (availability !== "available") {
      setState(availability);
      return;
    }
    setState("loading");
    try {
      const conditionResult = await getUserCondition();
      if (!conditionResult.success || !conditionResult.data.onboarding_completed) {
        setState(conditionResult.success ? "no-condition" : "error");
        return;
      }
      const nextPage = await fetchOpenAnnouncements(1, sort);
      setCondition(conditionResult.data);
      setItems(matchRecommendations(conditionResult.data, nextPage.data));
      setPage(nextPage.pagination.page);
      setHasMore(nextPage.pagination.has_more);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [sort]);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadMore() {
    if (!condition || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = await fetchOpenAnnouncements(page + 1, sort);
      const nextRecommendations = matchRecommendations(condition, nextPage.data);
      setItems((current) => [
        ...current,
        ...nextRecommendations.filter(
          (candidate) => !current.some((item) => item.announcement.id === candidate.announcement.id),
        ),
      ]);
      setPage(nextPage.pagination.page);
      setHasMore(nextPage.pagination.has_more);
    } catch {
      setState("error");
    } finally {
      setLoadingMore(false);
    }
  }

  if (state === "loading") return <Status icon="loading" text="AI추천 공고를 불러오는 중입니다." />;
  if (state === "browser") {
    return <Status icon="sparkles" text="즐겨찾기와 AI추천은 정부지원AI비서 앱에서 사용할 수 있습니다." />;
  }
  if (state === "outdated") {
    return <Status icon="sparkles" text="정부지원AI비서 앱을 최신 버전으로 업데이트하면 사용할 수 있습니다." />;
  }
  if (state === "no-condition") {
    return <Status icon="sparkles" text="AI추천을 사용하려면 앱에서 내 정보를 먼저 설정해 주세요." />;
  }
  if (state === "error") {
    return <Status icon="refresh" text="AI추천 공고를 불러오지 못했습니다." retry={load} />;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-2">
        <label htmlFor="recommendation-sort" className="text-xs font-semibold text-subtle">
          정렬
        </label>
        <select
          id="recommendation-sort"
          value={sort}
          onChange={(event) => setSort(event.target.value as OpenAnnouncementsSort)}
          className="h-10 rounded-md border border-line bg-white px-3 text-xs font-semibold text-ink focus:border-primary"
        >
          <option value="latest">등록일 최신순</option>
          <option value="deadline">마감 임박순</option>
        </select>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-white px-5 py-10 text-center">
          <Sparkles className="mx-auto text-slate-400" size={30} aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-ink">현재 불러온 공고 중 추천 결과가 없습니다.</p>
          <p className="mt-1 text-xs leading-relaxed text-subtle">
            업종과 창업 연차는 현재 강제 제외 조건으로 사용하지 않습니다.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(({ announcement, matchedCategoryIds, reasons, needsAdditionalReview }) => (
            <article key={announcement.id} className="rounded-lg border border-line bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="min-w-0 break-words text-sm font-bold leading-snug text-ink">
                  {announcement.title}
                </h2>
                <CardApplicationDates
                  applyStart={announcement.apply_start}
                  applyEnd={announcement.apply_end}
                  status={announcement.status}
                />
              </div>
              <p className="mt-2 text-xs text-subtle">기관: {announcement.agency ?? "정보 없음"}</p>
              <p className="mt-1 text-xs text-subtle">지역: {announcement.region ?? "확인 필요"}</p>
              <div className="mt-3">
                <p className="mb-1 text-[11px] font-semibold text-subtle">관심 분야 일치</p>
                <CategoryChips ids={matchedCategoryIds} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {reasons.map((reason) => (
                  <span key={reason} className="rounded-badge bg-primary-light px-2 py-1 text-[11px] font-semibold text-primary-dark">
                    {reason}
                  </span>
                ))}
                {needsAdditionalReview && (
                  <span className="rounded-badge bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">
                    추가 확인 필요
                  </span>
                )}
              </div>
              <Link
                href={`/app/announcements/${announcement.id}`}
                className="mt-3 flex h-11 items-center justify-center rounded-md border border-primary text-xs font-semibold text-primary"
              >
                상세보기
              </Link>
              <FavoriteButton
                compact
                announcement={{
                  id: announcement.id,
                  title: announcement.title,
                  agency: announcement.agency,
                  category_ids: announcement.category_ids,
                  region: announcement.region,
                  status: announcement.status,
                  apply_end: announcement.apply_end,
                  detail_url: announcement.detail_url,
                  original_url: announcement.original_url,
                }}
              />
            </article>
          ))}
        </div>
      )}
      {hasMore && (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loadingMore}
          className="mt-4 flex h-12 w-full items-center justify-center rounded-md border border-line bg-white text-sm font-semibold text-primary disabled:opacity-60"
        >
          {loadingMore && <LoaderCircle className="mr-2 animate-spin" size={18} aria-hidden="true" />}
          {loadingMore ? "불러오는 중" : "추천 공고 더 보기"}
        </button>
      )}
    </div>
  );
}

function Status({
  icon,
  text,
  retry,
}: {
  icon: "loading" | "sparkles" | "refresh";
  text: string;
  retry?: () => Promise<void>;
}) {
  const Icon = icon === "sparkles" ? Sparkles : icon === "refresh" ? RefreshCw : LoaderCircle;
  return (
    <div className="rounded-lg border border-line bg-white px-5 py-10 text-center">
      <Icon className={`mx-auto text-slate-400 ${icon === "loading" ? "animate-spin" : ""}`} size={30} aria-hidden="true" />
      <p className="mt-3 text-sm leading-relaxed text-subtle">{text}</p>
      {retry && (
        <button type="button" onClick={() => void retry()} className="mt-4 h-11 font-semibold text-primary">
          다시 시도
        </button>
      )}
    </div>
  );
}
