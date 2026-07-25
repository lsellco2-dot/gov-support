"use client";

import Link from "next/link";
import { LoaderCircle, RefreshCw, Settings, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useEffect } from "react";
import CategoryChips from "./CategoryChips";
import FavoriteButton from "./FavoriteButton";
import CardApplicationDates from "./CardApplicationDates";
import {
  getUserConditionSettingsBridgeAvailability,
  openUserConditionSettings,
} from "@/lib/mobile/app-bridge";
import type { OpenAnnouncementsSort } from "@/lib/mobile/open-announcements";
import {
  isNationwideUserRegion,
  type RecommendationResult,
} from "@/lib/mobile/recommendations";
import { announcementSourceLabel } from "@/lib/mobile/announcement-source";
import { loadRecommendationBatch } from "@/lib/mobile/recommendation-pages";
import {
  resolveUserCondition,
  type UserConditionSource,
} from "@/lib/mobile/user-condition-source";
import {
  USER_CONDITION_CHANGED_EVENT,
  type UserCondition,
} from "@/lib/mobile/user-condition";
import {
  YouthPolicyChips,
  YouthPolicyRegion,
} from "./AnnouncementPolicyMeta";
import { isYouthCenterSource } from "@/lib/query/announcement-presentation";

type State = "loading" | "outdated" | "ready" | "error" | "no-condition";

export default function AppRecommendationsPage({
  detailBasePath = "/app/announcements",
  settingsPath = "/recommendations/settings",
  showFavorites = false,
  notice = null,
}: {
  detailBasePath?: "/announcements" | "/app/announcements";
  settingsPath?: string;
  showFavorites?: boolean;
  notice?: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<State>("loading");
  const [condition, setCondition] = useState<UserCondition | null>(null);
  const [conditionSource, setConditionSource] = useState<UserConditionSource>("web");
  const [items, setItems] = useState<RecommendationResult[]>([]);
  const [page, setPage] = useState(1);
  const [pendingItems, setPendingItems] = useState<RecommendationResult[]>([]);
  const [hasMoreCandidates, setHasMoreCandidates] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sort, setSort] = useState<OpenAnnouncementsSort>("latest");
  const [includeNationwide, setIncludeNationwide] = useState(true);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setState("loading");
    try {
      const resolution = await resolveUserCondition();
      if (signal?.aborted) return;
      if (resolution.status !== "ready") {
        if ("source" in resolution && resolution.source === "web") {
          setConditionSource("web");
        } else {
          setConditionSource("native");
        }
        setState(
          resolution.status === "missing"
            ? "no-condition"
            : resolution.status === "outdated"
              ? "outdated"
              : "error",
        );
        return;
      }
      setConditionSource(resolution.source);
      const batch = await loadRecommendationBatch({
        condition: resolution.condition,
        sort,
        includeNationwide,
        currentPage: 0,
        hasMoreCandidates: true,
        signal,
      });
      if (signal?.aborted) return;
      setCondition(resolution.condition);
      setItems(batch.items);
      setPendingItems(batch.pending);
      setPage(batch.lastPage);
      setHasMoreCandidates(batch.hasMoreCandidates);
      setState("ready");
    } catch {
      if (signal?.aborted) return;
      setState("error");
    }
  }, [includeNationwide, sort]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const reload = () => void load();
    window.addEventListener("focus", reload);
    window.addEventListener(USER_CONDITION_CHANGED_EVENT, reload);
    return () => {
      window.removeEventListener("focus", reload);
      window.removeEventListener(USER_CONDITION_CHANGED_EVENT, reload);
    };
  }, [load]);

  async function loadMore() {
    const hasMore = pendingItems.length > 0 || hasMoreCandidates;
    if (!condition || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const batch = await loadRecommendationBatch({
        condition,
        sort,
        includeNationwide,
        currentPage: page,
        hasMoreCandidates,
        pending: pendingItems,
      });
      setItems((current) => [
        ...current,
        ...batch.items.filter(
          (candidate) => !current.some((item) => item.announcement.id === candidate.announcement.id),
        ),
      ]);
      setPendingItems(batch.pending);
      setPage(batch.lastPage);
      setHasMoreCandidates(batch.hasMoreCandidates);
    } catch {
      setState("error");
    } finally {
      setLoadingMore(false);
    }
  }

  const hasMore = pendingItems.length > 0 || hasMoreCandidates;

  async function openSettings() {
    setSettingsMessage(null);
    if (
      conditionSource === "native" ||
      getUserConditionSettingsBridgeAvailability() === "available"
    ) {
      const result = await openUserConditionSettings();
      if (!result.success) {
        setSettingsMessage("앱의 내 정보 설정 화면을 열지 못했습니다.");
      }
      return;
    }
    router.push(settingsPath);
  }

  if (state === "loading") return <Status icon="loading" text="AI추천 공고를 불러오는 중입니다." />;
  if (state === "outdated") {
    return <Status icon="sparkles" text="정부지원AI비서 앱을 최신 버전으로 업데이트하면 사용할 수 있습니다." />;
  }
  if (state === "no-condition") {
    return (
      <ConditionPrompt
        native={conditionSource === "native"}
        onOpenSettings={openSettings}
        message={settingsMessage}
      />
    );
  }
  if (state === "error") {
    return <Status icon="refresh" text="AI추천 공고를 불러오지 못했습니다." retry={load} />;
  }

  return (
    <div>
      {notice && (
        <p
          className="mb-3 rounded-md border border-open bg-green-50 px-3 py-2 text-sm font-semibold text-open"
          role="status"
        >
          {notice}
        </p>
      )}
      {settingsMessage && (
        <p className="mb-3 text-sm text-urgent" role="alert">
          {settingsMessage}
        </p>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void openSettings()}
          className="flex h-10 items-center justify-center rounded-md border border-line bg-white px-3 text-xs font-semibold text-primary"
        >
          <Settings className="mr-1.5" size={16} aria-hidden="true" />
          내 정보 수정
        </button>
        {condition && !isNationwideUserRegion(condition.region) && (
          <div
            role="group"
            aria-label="전국 공고 표시"
            className="grid min-w-[14rem] flex-1 grid-cols-2 rounded-md border border-line bg-white p-1"
          >
            <NationwideFilterButton
              active={includeNationwide}
              onClick={() => setIncludeNationwide(true)}
            >
              전국 공고 포함
            </NationwideFilterButton>
            <NationwideFilterButton
              active={!includeNationwide}
              onClick={() => setIncludeNationwide(false)}
            >
              전국 공고 제외
            </NationwideFilterButton>
          </div>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">
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
                  sourceStatus={announcement.source_status}
                />
              </div>
              <div className="mt-2">
                <span className="inline-flex rounded-badge bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                  출처: {announcementSourceLabel(announcement.source, announcement.source_name)}
                </span>
              </div>
              <p className="mt-2 text-xs text-subtle">기관: {announcement.agency ?? "정보 없음"}</p>
              <p className="mt-1 break-words text-xs text-subtle">
                지역:{" "}
                <YouthPolicyRegion
                  sourceCode={announcement.source}
                  region={announcement.region}
                  regions={announcement.regions}
                />
                {!isYouthCenterSource(announcement.source) &&
                  (announcement.region ?? "확인 필요")}
              </p>
              <YouthPolicyChips
                sourceCode={announcement.source}
                policyDomain={announcement.policy_domain}
                ageMin={announcement.age_min}
                ageMax={announcement.age_max}
              />
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
                href={`${detailBasePath}/${announcement.id}`}
                className="mt-3 flex h-11 items-center justify-center rounded-md border border-primary text-xs font-semibold text-primary"
              >
                상세보기
              </Link>
              {showFavorites && (
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
              )}
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

function ConditionPrompt({
  native,
  onOpenSettings,
  message,
}: {
  native: boolean;
  onOpenSettings: () => Promise<void>;
  message: string | null;
}) {
  return (
    <div className="rounded-lg border border-line bg-white px-5 py-10 text-center">
      <Sparkles className="mx-auto text-primary" size={30} aria-hidden="true" />
      <h2 className="mt-3 text-base font-bold text-ink">
        내 정보를 설정하고 맞춤 공고를 확인하세요
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-subtle">
        사용자 유형, 지역, 관심 분야를 기준으로 신청 가능성이 높은 공고를 추천합니다.
      </p>
      <button
        type="button"
        onClick={() => void onOpenSettings()}
        className="mt-5 h-12 rounded-md bg-primary px-6 text-sm font-semibold text-white"
      >
        {native ? "앱에서 내 정보 설정" : "내 정보 설정"}
      </button>
      {message && (
        <p className="mt-3 text-sm text-urgent" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}

function NationwideFilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-10 rounded px-2 text-xs font-semibold transition-colors ${
        active ? "bg-primary text-white" : "bg-white text-subtle"
      }`}
    >
      {children}
    </button>
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
