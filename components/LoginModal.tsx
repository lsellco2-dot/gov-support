"use client";

import { LoaderCircle, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface LoginModalProps {
  open: boolean;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onGoogleSignIn: () => void;
}

function GoogleMark() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 18 18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.716v2.259h2.909c1.702-1.567 2.684-3.875 2.684-6.616Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.468-.806 5.956-2.179l-2.91-2.259c-.805.54-1.835.86-3.046.86-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.963 10.708A5.42 5.42 0 0 1 3.682 9c0-.593.102-1.17.281-1.708V4.96H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.04l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.578c1.322 0 2.508.454 3.442 1.346l2.582-2.582C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.96l3.007 2.332C4.672 5.163 6.656 3.578 9 3.578Z"
      />
    </svg>
  );
}

export default function LoginModal({
  open,
  pending,
  error,
  onClose,
  onGoogleSignIn,
}: LoginModalProps) {
  const googleButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    googleButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open, pending]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-6">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-ink/55"
        aria-label="로그인 창 닫기"
        onClick={pending ? undefined : onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        className="relative w-full max-w-sm rounded-lg border border-line bg-white p-6 shadow-xl"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-md text-subtle hover:bg-primary-light hover:text-primary disabled:opacity-50"
          aria-label="로그인 창 닫기"
        >
          <X size={20} aria-hidden="true" />
        </button>

        <div className="px-8 text-center">
          <h2 id="login-modal-title" className="text-2xl font-bold text-ink">
            정부지원AI비서
          </h2>
          <p className="mt-2 text-xs font-semibold text-subtle">
            AI 맞춤 정부지원 공고 안내
          </p>
        </div>

        <button
          ref={googleButtonRef}
          type="button"
          onClick={onGoogleSignIn}
          disabled={pending}
          className="mt-8 flex h-12 w-full items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-bold text-ink shadow-sm hover:border-primary hover:bg-primary-light disabled:opacity-60"
        >
          {pending ? (
            <LoaderCircle className="mr-2 animate-spin" size={19} aria-hidden="true" />
          ) : (
            <span className="mr-3 flex h-6 w-6 items-center justify-center">
              <GoogleMark />
            </span>
          )}
          Google로 시작하기
        </button>

        {error && (
          <p
            className="mt-3 rounded-md border border-urgent bg-white px-3 py-2 text-sm text-urgent"
            role="alert"
          >
            {error}
          </p>
        )}

        <p className="mt-6 border-t border-line pt-5 text-center text-xs leading-5 text-subtle">
          계속하면 정부지원AI비서의{" "}
          <Link
            href="/terms"
            onClick={onClose}
            className="font-semibold text-primary hover:underline"
          >
            이용약관
          </Link>
          과{" "}
          <Link
            href="/privacy"
            onClick={onClose}
            className="font-semibold text-primary hover:underline"
          >
            개인정보처리방침
          </Link>
          에 동의하게 됩니다.
        </p>
      </section>
    </div>,
    document.body,
  );
}
