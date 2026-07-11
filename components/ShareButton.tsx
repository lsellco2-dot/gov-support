"use client";

import { useState } from "react";

// Android WebView 브릿지 (android/app/.../WebAppBridge.kt의 JS 계약)
declare global {
  interface Window {
    GovSupportNative?: {
      share: (title: string, url: string) => void;
      openExternal: (url: string) => void;
      getFcmToken: () => string;
    };
  }
}

export default function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const url = window.location.href;

    // 1순위: Android 네이티브 공유 시트 (WebView 안에서만 존재)
    if (window.GovSupportNative) {
      window.GovSupportNative.share(title, url);
      return;
    }
    // 2순위: Web Share API (모바일 브라우저)
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        /* 사용자가 공유 시트를 닫음 */
      }
      return;
    }
    // 3순위: 클립보드 복사 (데스크톱 등)
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 권한이 없으면 주소창 URL을 직접 복사하도록 선택 대화상자로 안내
      window.prompt("아래 링크를 복사하세요", url);
    }
  }

  return (
    <button
      type="button"
      onClick={onShare}
      className="flex h-11 shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 active:bg-slate-50"
      aria-label="공고 공유하기"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.6" y1="10.5" x2="15.4" y2="6.5" />
        <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
      </svg>
      {copied ? "링크 복사됨" : "공유"}
    </button>
  );
}
