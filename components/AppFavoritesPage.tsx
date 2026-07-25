"use client";

import Link from "next/link";
import { LoaderCircle, RefreshCw, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import CardApplicationDates from "./CardApplicationDates";
import FavoriteButton from "./FavoriteButton";
import {
  FAVORITES_CHANGED_EVENT,
  getFavorites,
  getFavoritesBridgeAvailability,
  type NativeFavoriteAnnouncement,
} from "@/lib/mobile/app-bridge";
import {
  sortFavoriteAnnouncements,
  type FavoriteSort,
} from "@/lib/mobile/favorite-sort";
import {
  loadAnnouncementDisplayMetadata,
  type AnnouncementDisplayMetadata,
} from "@/lib/mobile/announcement-display-client";
import {
  AnnouncementSourceBadge,
  YouthPolicyChips,
  YouthPolicyRegion,
} from "./AnnouncementPolicyMeta";
import { isYouthCenterSource } from "@/lib/query/announcement-presentation";

type State = "loading" | "browser" | "outdated" | "empty" | "ready" | "error";

export default function AppFavoritesPage() {
  const [state, setState] = useState<State>("loading");
  const [items, setItems] = useState<NativeFavoriteAnnouncement[]>([]);
  const [metadata, setMetadata] = useState<
    Map<number, AnnouncementDisplayMetadata>
  >(new Map());
  const [sort, setSort] = useState<FavoriteSort>("latest");
  const sortedItems = useMemo(() => sortFavoriteAnnouncements(items, sort), [items, sort]);

  const load = useCallback(async () => {
    const availability = getFavoritesBridgeAvailability();
    if (availability !== "available") {
      setState(availability);
      return;
    }
    setState("loading");
    const result = await getFavorites();
    if (!result.success) {
      setState("error");
      return;
    }
    setItems(result.data);
    setState(result.data.length ? "ready" : "empty");
    void loadAnnouncementDisplayMetadata(result.data.map((item) => item.id))
      .then((displayMetadata) => {
        setMetadata(new Map(displayMetadata.map((item) => [item.id, item])));
      })
      .catch(() => {
        // Android에 저장된 기존 스냅샷은 그대로 표시하고 부가 정보만 생략한다.
      });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ announcementId?: number; isFavorite?: boolean }>).detail;
      if (!detail || detail.isFavorite !== false || typeof detail.announcementId !== "number") return;
      setItems((current) => {
        const next = current.filter((item) => item.id !== detail.announcementId);
        setState(next.length ? "ready" : "empty");
        return next;
      });
    };
    window.addEventListener(FAVORITES_CHANGED_EVENT, listener);
    return () => window.removeEventListener(FAVORITES_CHANGED_EVENT, listener);
  }, []);

  if (state === "loading") return <Status icon="loading" text="즐겨찾기를 불러오는 중입니다." />;
  if (state === "browser") {
    return <Status icon="star" text="즐겨찾기와 AI추천은 정부지원AI비서 앱에서 사용할 수 있습니다." />;
  }
  if (state === "outdated") {
    return <Status icon="star" text="정부지원AI비서 앱을 최신 버전으로 업데이트하면 사용할 수 있습니다." />;
  }
  if (state === "error") {
    return <Status icon="refresh" text="즐겨찾기를 불러오지 못했습니다." retry={load} />;
  }
  if (state === "empty") {
    return (
      <div className="rounded-lg border border-dashed border-line bg-white px-5 py-10 text-center">
        <Star className="mx-auto text-slate-400" size={30} aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-ink">즐겨찾기한 공고가 없습니다.</p>
        <p className="mt-1 text-xs leading-relaxed text-subtle">
          관심 있는 공고에서 즐겨찾기를 눌러 저장해보세요.
        </p>
        <Link href="/app/announcements" className="mt-4 inline-flex h-11 items-center font-semibold text-primary">
          전체공고 보기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <label htmlFor="favorite-sort" className="text-xs font-semibold text-subtle">
          정렬
        </label>
        <select
          id="favorite-sort"
          value={sort}
          onChange={(event) => setSort(event.target.value as FavoriteSort)}
          className="h-10 rounded-md border border-line bg-white px-3 text-xs font-semibold text-ink focus:border-primary"
        >
          <option value="latest">최근 저장순</option>
          <option value="deadline">마감 임박순</option>
        </select>
      </div>
      {sortedItems.map((item) => {
        const display = metadata.get(item.id);
        return (
          <article key={item.id} className="min-w-0 rounded-lg border border-line bg-white p-4">
            {isYouthCenterSource(display?.source_code) && (
              <div className="mb-2">
                <AnnouncementSourceBadge
                  sourceCode={display?.source_code}
                  sourceName={display?.source_name}
                />
              </div>
            )}
            <div className="flex items-start justify-between gap-3">
              <h2 className="min-w-0 break-words text-sm font-bold leading-snug text-ink">{item.title}</h2>
              <CardApplicationDates
                applyStart={null}
                applyEnd={item.apply_end}
                status={item.status}
                sourceStatus={display?.source_status}
              />
            </div>
            <p className="mt-2 break-words text-xs text-subtle">{item.agency ?? "기관 정보 없음"}</p>
            {isYouthCenterSource(display?.source_code) && (
              <p className="mt-1 break-words text-xs text-subtle">
                지역:{" "}
                <YouthPolicyRegion
                  sourceCode={display?.source_code}
                  region={display?.region ?? item.region}
                  regions={display?.regions}
                />
              </p>
            )}
            <YouthPolicyChips
              sourceCode={display?.source_code}
              policyDomain={display?.policy_domain}
              ageMin={display?.age_min}
              ageMax={display?.age_max}
            />
            <Link
              href={`/app/announcements/${item.id}`}
              className="mt-3 flex h-11 items-center justify-center rounded-md bg-primary text-xs font-semibold text-white"
            >
              상세보기
            </Link>
            <FavoriteButton
              compact
              announcement={{
                id: item.id,
                title: item.title,
                agency: item.agency,
                category_ids: item.category_ids,
                region: item.region,
                status: item.status,
                apply_end: item.apply_end,
                detail_url: item.detail_url,
                original_url: item.original_url,
              }}
            />
          </article>
        );
      })}
    </div>
  );
}

function Status({
  icon,
  text,
  retry,
}: {
  icon: "loading" | "star" | "refresh";
  text: string;
  retry?: () => Promise<void>;
}) {
  const Icon = icon === "star" ? Star : icon === "refresh" ? RefreshCw : LoaderCircle;
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
