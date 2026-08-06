"use client";

import { LoaderCircle, LogIn, LogOut, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import LoginModal from "@/components/LoginModal";
import {
  APP_AUTH_CALLBACK_URL,
  APP_AUTH_CODE_AVAILABLE_EVENT,
  clearPendingAuthCode,
  getAuthBridgeAvailability,
  getPendingAuthCode,
  openAppAuth,
} from "@/lib/mobile/app-bridge";
import { createAuthBrowserClient } from "@/lib/supabase/auth-client";

interface AuthControlProps {
  user: {
    email: string | null;
    displayName: string | null;
  } | null;
  compact?: boolean;
}

export default function AuthControl({ user, compact = false }: AuthControlProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  const completeAppSignIn = useCallback(async () => {
    if (getAuthBridgeAvailability() !== "available") return;
    const pendingCode = await getPendingAuthCode();
    if (!pendingCode.success || !pendingCode.data) return;

    const supabase = createAuthBrowserClient();
    if (!supabase) {
      setError("로그인 설정을 불러오지 못했습니다.");
      return;
    }

    setPending(true);
    setError(null);
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
      pendingCode.data,
    );
    await clearPendingAuthCode(pendingCode.data);
    if (exchangeError) {
      setError("Google 로그인을 완료하지 못했습니다. 다시 시도해 주세요.");
      setPending(false);
      return;
    }

    router.refresh();
    setPending(false);
  }, [router]);

  useEffect(() => {
    if (user || getAuthBridgeAvailability() !== "available") return;
    const handleCodeAvailable = () => void completeAppSignIn();
    window.addEventListener(APP_AUTH_CODE_AVAILABLE_EVENT, handleCodeAvailable);
    void completeAppSignIn();
    return () =>
      window.removeEventListener(APP_AUTH_CODE_AVAILABLE_EVENT, handleCodeAvailable);
  }, [completeAppSignIn, user]);

  useEffect(() => {
    if (user) setLoginOpen(false);
  }, [user]);

  async function signIn() {
    if (pending) return;
    const supabase = createAuthBrowserClient();
    if (!supabase) {
      setError("로그인 설정을 불러오지 못했습니다.");
      return;
    }

    setPending(true);
    setError(null);
    const authBridge = getAuthBridgeAvailability();
    if (authBridge === "available") {
      const { data, error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: APP_AUTH_CALLBACK_URL,
          skipBrowserRedirect: true,
        },
      });
      if (authError || !data.url) {
        setError("Google 로그인을 시작하지 못했습니다.");
        setPending(false);
        return;
      }
      const opened = await openAppAuth(data.url);
      if (!opened.success) {
        setError("Google 로그인 화면을 열지 못했습니다.");
      } else {
        setLoginOpen(false);
      }
      setPending(false);
      return;
    }
    if (authBridge === "outdated") {
      setError("앱을 최신 버전으로 업데이트하면 로그인할 수 있습니다.");
      setPending(false);
      return;
    }

    const next = `${window.location.pathname}${window.location.search}`;
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (authError) {
      setError("Google 로그인을 시작하지 못했습니다.");
      setPending(false);
    }
  }

  async function signOut() {
    if (pending) return;
    const supabase = createAuthBrowserClient();
    if (!supabase) return;

    setPending(true);
    setError(null);
    const { error: authError } = await supabase.auth.signOut({ scope: "local" });
    if (authError) {
      setError("로그아웃하지 못했습니다.");
      setPending(false);
      return;
    }

    router.refresh();
    setPending(false);
  }

  if (!user) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setLoginOpen(true);
          }}
          disabled={pending}
          className={`flex items-center justify-center rounded-md border border-line bg-white font-semibold text-ink hover:border-primary hover:text-primary disabled:opacity-60 ${
            compact ? "h-9 px-2 text-xs" : "h-10 px-2 text-sm sm:px-3"
          }`}
          aria-label="로그인"
          aria-haspopup="dialog"
          aria-expanded={loginOpen}
        >
          {pending ? (
            <LoaderCircle className={`animate-spin ${compact ? "mr-1" : "sm:mr-2"}`} size={17} aria-hidden="true" />
          ) : (
            <LogIn className={compact ? "mr-1" : "sm:mr-2"} size={17} aria-hidden="true" />
          )}
          <span className={compact ? "inline" : "hidden sm:inline"}>
            로그인
          </span>
        </button>
        <LoginModal
          open={loginOpen}
          pending={pending}
          error={error}
          onClose={() => setLoginOpen(false)}
          onGoogleSignIn={() => void signIn()}
        />
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-2">
      <span className={`${compact ? "sr-only" : "hidden max-w-36 items-center truncate text-sm font-semibold text-ink sm:flex"}`}>
        <UserRound className="mr-2 shrink-0 text-primary" size={18} aria-hidden="true" />
        {user.displayName || user.email || "로그인 사용자"}
      </span>
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        className={`flex items-center justify-center rounded-md border border-line bg-white text-subtle hover:border-primary hover:text-primary disabled:opacity-60 ${compact ? "h-9 w-9" : "h-10 w-10"}`}
        aria-label="로그아웃"
        title="로그아웃"
      >
        {pending ? (
          <LoaderCircle className="animate-spin" size={17} aria-hidden="true" />
        ) : (
          <LogOut size={17} aria-hidden="true" />
        )}
      </button>
      {error && (
        <p className="absolute right-0 top-11 z-10 w-48 rounded-md border border-urgent bg-white px-3 py-2 text-xs text-urgent shadow-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
