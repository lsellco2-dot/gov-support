"use client";

import { LoaderCircle, Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  addFavorite,
  FAVORITES_CHANGED_EVENT,
  type FavoriteSnapshot,
  getFavoritesBridgeAvailability,
  isFavorite,
  removeFavorite,
} from "@/lib/mobile/app-bridge";

type State = "loading" | "browser" | "outdated" | "ready" | "error";

export default function FavoriteButton({
  announcement,
  compact = false,
}: {
  announcement: FavoriteSnapshot;
  compact?: boolean;
}) {
  const [state, setState] = useState<State>("loading");
  const [favorite, setFavorite] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const availability = getFavoritesBridgeAvailability();
    if (availability !== "available") {
      setState(availability);
      return;
    }
    setState("loading");
    const result = await isFavorite(announcement.id);
    if (result.success) {
      setFavorite(result.data);
      setState("ready");
    } else {
      setState("error");
    }
  }, [announcement.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ announcementId?: number; isFavorite?: boolean }>).detail;
      if (detail?.announcementId === announcement.id && typeof detail.isFavorite === "boolean") {
        setFavorite(detail.isFavorite);
        setState("ready");
      }
    };
    window.addEventListener(FAVORITES_CHANGED_EVENT, listener);
    return () => window.removeEventListener(FAVORITES_CHANGED_EVENT, listener);
  }, [announcement.id]);

  async function toggle() {
    if (saving || state !== "ready") return;
    setSaving(true);
    const result = favorite
      ? await removeFavorite(announcement.id)
      : await addFavorite(announcement);
    if (result.success) {
      setFavorite(!favorite);
    } else {
      setState("error");
    }
    setSaving(false);
  }

  if (state === "browser") {
    return <BridgeMessage text="즐겨찾기와 AI추천은 정부지원AI비서 앱에서 사용할 수 있습니다." compact={compact} />;
  }
  if (state === "outdated") {
    return <BridgeMessage text="정부지원AI비서 앱을 최신 버전으로 업데이트하면 사용할 수 있습니다." compact={compact} />;
  }
  if (state === "error") {
    return (
      <button type="button" onClick={() => void load()} className={secondaryClass(compact)}>
        다시 시도
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={state === "loading" || saving}
      aria-pressed={favorite}
      className={favorite ? secondaryClass(compact) : primaryClass(compact)}
    >
      {state === "loading" || saving ? (
        <LoaderCircle className="mr-1.5 animate-spin" size={17} aria-hidden="true" />
      ) : (
        <Star className="mr-1.5" size={17} fill={favorite ? "currentColor" : "none"} aria-hidden="true" />
      )}
      {saving ? "처리 중" : favorite ? "즐겨찾기 해제" : "즐겨찾기"}
    </button>
  );
}

function BridgeMessage({ text, compact }: { text: string; compact: boolean }) {
  return (
    <p className={`${compact ? "mt-2" : "mt-4"} rounded-lg border border-line bg-slate-50 p-3 text-xs leading-relaxed text-subtle`}>
      {text}
    </p>
  );
}

function primaryClass(compact: boolean) {
  return `${compact ? "mt-2 h-10" : "mt-4 h-12"} flex w-full items-center justify-center rounded-md bg-primary px-3 text-xs font-semibold text-white disabled:opacity-60`;
}

function secondaryClass(compact: boolean) {
  return `${compact ? "mt-2 h-10" : "mt-4 h-12"} flex w-full items-center justify-center rounded-md border border-line bg-white px-3 text-xs font-semibold text-subtle disabled:opacity-60`;
}
