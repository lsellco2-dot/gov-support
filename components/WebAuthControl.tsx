"use client";

import { useCallback, useEffect, useState } from "react";
import AuthControl from "@/components/AuthControl";
import { createAuthBrowserClient } from "@/lib/supabase/auth-client";

type SessionState = {
  user: { email: string | null; displayName: string | null } | null;
  isAdmin: boolean;
};

const ANONYMOUS: SessionState = { user: null, isAdmin: false };

function hasAuthCookie() {
  return document.cookie.split(";").some((part) => part.trim().startsWith("sb-"));
}

// 웹 레이아웃용 로그인 버튼. 서버 레이아웃이 쿠키를 읽지 않게 해서
// 공고 페이지를 CDN 캐시로 내보내고, 로그인 정보는 브라우저에서만 불러온다.
export default function WebAuthControl() {
  const [session, setSession] = useState<SessionState>(ANONYMOUS);

  const load = useCallback(async () => {
    if (!hasAuthCookie()) {
      setSession(ANONYMOUS);
      return;
    }
    try {
      const res = await fetch("/api/auth/session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) return;
      setSession((await res.json()) as SessionState);
    } catch {
      // 네트워크 오류면 이전 상태를 유지한다.
    }
  }, []);

  useEffect(() => {
    void load();
    const supabase = createAuthBrowserClient();
    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void load();
      }
    });
    return () => subscription?.data.subscription.unsubscribe();
  }, [load]);

  return <AuthControl user={session.user} isAdmin={session.isAdmin} />;
}
