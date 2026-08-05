"use client";

import { LoaderCircle, LogIn, LogOut, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createAuthBrowserClient } from "@/lib/supabase/auth-client";

interface AuthControlProps {
  user: {
    email: string | null;
    displayName: string | null;
  } | null;
}

export default function AuthControl({ user }: AuthControlProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    if (pending) return;
    const supabase = createAuthBrowserClient();
    if (!supabase) {
      setError("로그인 설정을 불러오지 못했습니다.");
      return;
    }

    setPending(true);
    setError(null);
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
          onClick={signIn}
          disabled={pending}
          className="flex h-10 items-center justify-center rounded-md border border-line bg-white px-2 text-sm font-semibold text-ink hover:border-primary hover:text-primary disabled:opacity-60 sm:px-3"
          aria-label="Google 로그인"
        >
          {pending ? (
            <LoaderCircle className="animate-spin sm:mr-2" size={17} aria-hidden="true" />
          ) : (
            <LogIn className="sm:mr-2" size={17} aria-hidden="true" />
          )}
          <span className="hidden sm:inline">Google 로그인</span>
        </button>
        {error && (
          <p className="absolute right-0 top-11 z-10 w-56 rounded-md border border-urgent bg-white px-3 py-2 text-xs text-urgent shadow-sm" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-2">
      <span className="hidden max-w-36 items-center truncate text-sm font-semibold text-ink sm:flex">
        <UserRound className="mr-2 shrink-0 text-primary" size={18} aria-hidden="true" />
        {user.displayName || user.email || "로그인 사용자"}
      </span>
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        className="flex h-10 w-10 items-center justify-center rounded-md border border-line bg-white text-subtle hover:border-primary hover:text-primary disabled:opacity-60"
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
