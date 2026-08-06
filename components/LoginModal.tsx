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

        <div className="pr-10">
          <p className="text-sm font-bold text-primary">정부지원AI비서</p>
          <h2 id="login-modal-title" className="mt-2 text-xl font-bold text-ink">
            로그인
          </h2>
          <p className="mt-2 text-sm text-subtle">
            Google 계정으로 간편하게 시작하세요.
          </p>
        </div>

        <button
          ref={googleButtonRef}
          type="button"
          onClick={onGoogleSignIn}
          disabled={pending}
          className="mt-6 flex h-12 w-full items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-bold text-ink shadow-sm hover:border-primary hover:bg-primary-light disabled:opacity-60"
        >
          {pending ? (
            <LoaderCircle className="mr-2 animate-spin" size={19} aria-hidden="true" />
          ) : (
            <span
              className="mr-3 flex h-6 w-6 items-center justify-center rounded-full border border-line text-sm font-bold text-[#4285F4]"
              aria-hidden="true"
            >
              G
            </span>
          )}
          Google로 계속하기
        </button>

        {error && (
          <p
            className="mt-3 rounded-md border border-urgent bg-white px-3 py-2 text-sm text-urgent"
            role="alert"
          >
            {error}
          </p>
        )}

        <p className="mt-5 text-center text-xs leading-5 text-subtle">
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
