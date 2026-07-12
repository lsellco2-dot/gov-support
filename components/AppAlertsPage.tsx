"use client";

import Link from "next/link";
import { Bell, BellOff, LoaderCircle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import CategoryChips from "./CategoryChips";
import {
  type AlertAnnouncement,
  AlertsApiError,
  listAnnouncementAlerts,
  registerInstallation,
  removeAnnouncementAlert,
} from "@/lib/mobile/alerts-client";
import {
  getAppInstallationContext,
  type AppInstallationContext,
} from "@/lib/mobile/app-bridge";

type State = "loading" | "unsupported" | "empty" | "ready" | "error" | "unauthorized";

export default function AppAlertsPage() {
  const [state, setState] = useState<State>("loading");
  const [context, setContext] = useState<AppInstallationContext | null>(null);
  const [items, setItems] = useState<AlertAnnouncement[]>([]);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    const nextContext = await getAppInstallationContext();
    if (!nextContext) {
      setState("unsupported");
      return;
    }
    try {
      await registerInstallation(nextContext);
      const nextItems = await listAnnouncementAlerts(nextContext);
      setContext(nextContext);
      setItems(nextItems);
      setState(nextItems.length ? "ready" : "empty");
    } catch (error) {
      setState(
        error instanceof AlertsApiError && (error.status === 401 || error.status === 403)
          ? "unauthorized"
          : "error",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: number) {
    if (!context || removingId !== null) return;
    setRemovingId(id);
    try {
      await removeAnnouncementAlert(context, id);
      const nextItems = items.filter((item) => item.id !== id);
      setItems(nextItems);
      setState(nextItems.length ? "ready" : "empty");
    } catch (error) {
      setState(
        error instanceof AlertsApiError && (error.status === 401 || error.status === 403)
          ? "unauthorized"
          : "error",
      );
    } finally {
      setRemovingId(null);
    }
  }

  if (state === "loading") return <Status icon="loading" text="내 알림을 불러오는 중입니다." />;
  if (state === "unsupported") {
    return <Status icon="bell" text="내 알림은 정부지원AI비서 앱에서 사용할 수 있습니다." />;
  }
  if (state === "unauthorized") {
    return (
      <Status
        icon="bell"
        text="앱 기기 인증을 확인할 수 없습니다. 앱을 다시 실행해 주세요."
        retry={load}
      />
    );
  }
  if (state === "error") {
    return <Status icon="refresh" text="내 알림을 불러오지 못했습니다." retry={load} />;
  }
  if (state === "empty") {
    return (
      <div className="rounded-lg border border-dashed border-line bg-white px-5 py-10 text-center">
        <Bell className="mx-auto text-slate-400" size={30} aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-ink">설정한 공고 알림이 없습니다.</p>
        <p className="mt-1 text-xs leading-relaxed text-subtle">공고 상세화면에서 알림을 설정해 보세요.</p>
        <Link href="/app/announcements" className="mt-4 inline-flex h-11 items-center font-semibold text-primary">
          전체공고 보기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article key={item.id} className="rounded-lg border border-line bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 break-words text-sm font-bold leading-snug text-ink">{item.title}</h2>
            <span
              className={`shrink-0 rounded-badge px-2 py-1 text-[11px] font-semibold ${
                item.status === "open" ? "bg-[#E8F3EA] text-open" : "bg-slate-200 text-slate-500"
              }`}
            >
              {item.status === "open" ? "모집중" : "모집종료"}
            </span>
          </div>
          <p className="mt-2 break-words text-xs text-subtle">{item.organization ?? "기관 정보 없음"}</p>
          <div className="mt-2"><CategoryChips ids={item.category_ids ?? []} /></div>
          <p className="mt-3 text-xs text-subtle">신청 마감: {item.apply_end ?? "상시/미정"}</p>
          <div className="mt-3 flex gap-2">
            <Link
              href={`/app/announcements/${item.id}`}
              className="flex h-11 flex-1 items-center justify-center rounded-md bg-primary text-xs font-semibold text-white"
            >
              공고 상세보기
            </Link>
            <button
              type="button"
              onClick={() => void remove(item.id)}
              disabled={removingId !== null}
              className="flex h-11 flex-1 items-center justify-center rounded-md border border-line bg-white text-xs font-semibold text-subtle disabled:opacity-60"
            >
              {removingId === item.id ? (
                <LoaderCircle className="mr-1.5 animate-spin" size={16} aria-hidden="true" />
              ) : (
                <BellOff className="mr-1.5" size={16} aria-hidden="true" />
              )}
              알림 해제
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function Status({
  icon,
  text,
  retry,
}: {
  icon: "loading" | "bell" | "refresh";
  text: string;
  retry?: () => Promise<void>;
}) {
  const Icon = icon === "bell" ? Bell : icon === "refresh" ? RefreshCw : LoaderCircle;
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
