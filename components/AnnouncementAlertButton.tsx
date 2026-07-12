"use client";

import { Bell, BellOff, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  addAnnouncementAlert,
  AlertsApiError,
  listAnnouncementAlerts,
  registerInstallation,
  removeAnnouncementAlert,
} from "@/lib/mobile/alerts-client";
import {
  getAppInstallationContext,
  type AppInstallationContext,
} from "@/lib/mobile/app-bridge";

type State = "loading" | "unsupported" | "ready" | "error";

export default function AnnouncementAlertButton({ announcementId }: { announcementId: number }) {
  const [state, setState] = useState<State>("loading");
  const [context, setContext] = useState<AppInstallationContext | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    setMessage("");
    const nextContext = await getAppInstallationContext();
    if (!nextContext) {
      setState("unsupported");
      return;
    }
    try {
      await registerInstallation(nextContext);
      const alerts = await listAnnouncementAlerts(nextContext);
      setContext(nextContext);
      setEnabled(alerts.some((item) => item.id === announcementId));
      setState("ready");
    } catch (error) {
      setMessage(errorMessage(error));
      setState("error");
    }
  }, [announcementId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle() {
    if (!context || saving) return;
    setSaving(true);
    setMessage("");
    try {
      if (enabled) await removeAnnouncementAlert(context, announcementId);
      else await addAnnouncementAlert(context, announcementId);
      setEnabled(!enabled);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (state === "loading") {
    return (
      <div className="mt-4 flex h-12 items-center justify-center rounded-md border border-line bg-slate-50 text-xs text-subtle">
        <LoaderCircle className="mr-2 animate-spin" size={17} aria-hidden="true" />
        알림 상태 확인 중
      </div>
    );
  }
  if (state === "unsupported") {
    return (
      <p className="mt-4 rounded-lg border border-line bg-slate-50 p-3 text-xs leading-relaxed text-subtle">
        공고 알림은 정부지원AI비서 앱에서 설정할 수 있습니다.
      </p>
    );
  }
  if (state === "error") {
    return (
      <div className="mt-4 rounded-lg border border-line bg-slate-50 p-3 text-xs text-subtle">
        <p>{message}</p>
        <button type="button" onClick={() => void load()} className="mt-2 h-10 font-semibold text-primary">
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-line bg-slate-50 p-3">
      <p className="text-xs text-subtle" aria-live="polite">
        {enabled ? "이 공고의 알림이 설정되었습니다." : "이 공고를 내 알림 목록에 저장합니다."}
      </p>
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={saving}
        className={`mt-2 flex h-12 w-full items-center justify-center rounded-md text-sm font-semibold disabled:opacity-60 ${
          enabled ? "border border-line bg-white text-subtle" : "bg-primary text-white"
        }`}
      >
        {saving ? (
          <LoaderCircle className="mr-2 animate-spin" size={18} aria-hidden="true" />
        ) : enabled ? (
          <BellOff className="mr-2" size={18} aria-hidden="true" />
        ) : (
          <Bell className="mr-2" size={18} aria-hidden="true" />
        )}
        {saving ? "처리 중" : enabled ? "알림 해제" : "알림 설정"}
      </button>
      {message && <p className="mt-2 text-xs text-urgent">{message}</p>}
    </div>
  );
}

function errorMessage(error: unknown) {
  if (error instanceof AlertsApiError && (error.status === 401 || error.status === 403)) {
    return "앱 기기 인증을 확인할 수 없습니다. 앱을 다시 실행해 주세요.";
  }
  return "알림 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
