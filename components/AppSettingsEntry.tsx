"use client";

import { useState } from "react";
import {
  getAppSettingsBridgeAvailability,
  openAppSettings,
} from "@/lib/mobile/app-bridge";

const APP_ONLY_MESSAGE = "설정 기능은 정부지원AI비서 앱에서 사용할 수 있습니다.";

export default function AppSettingsEntry() {
  const [message, setMessage] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  async function handleOpenSettings() {
    if (getAppSettingsBridgeAvailability() !== "available") {
      setMessage(APP_ONLY_MESSAGE);
      return;
    }

    setOpening(true);
    setMessage(null);
    const result = await openAppSettings();
    if (!result.success) setMessage(APP_ONLY_MESSAGE);
    setOpening(false);
  }

  return (
    <div>
      <button
        type="button"
        className="w-full rounded-xl border border-line bg-white px-4 py-8 text-center hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        onClick={handleOpenSettings}
        disabled={opening}
      >
        <span className="block text-base font-semibold text-primary">정부지원AI비서</span>
        <span className="mt-2 block text-2xl font-bold leading-snug text-ink sm:text-3xl">
          AI 맞춤 설정하기
        </span>
        <span className="mt-2 block text-sm leading-relaxed text-subtle sm:text-base">
          나에게 맞는 맞춤 공고를 설정하세요.
        </span>
      </button>
      {message ? (
        <p className="mt-3 text-center text-sm text-subtle" aria-live="polite">
          {message}
        </p>
      ) : null}
    </div>
  );
}
