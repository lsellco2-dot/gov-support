"use client";

import { useState } from "react";
import { REGIONS } from "@/lib/query/announcements";

export default function LeadForm({ announcementId }: { announcementId: number }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState("sending");
    setErrorMsg("");
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        announcementId,
        name: f.get("name"),
        phone: f.get("phone"),
        isBusiness: f.get("isBusiness") === "on",
        region: f.get("region"),
        message: f.get("message"),
        consent: f.get("consent") === "on",
      }),
    }).catch(() => null);

    if (res?.ok) {
      setState("done");
    } else {
      const body = await res?.json().catch(() => null);
      setErrorMsg(body?.error ?? "접수에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-lg border border-open/30 bg-teal-50 p-4 text-sm text-open">
        상담 요청이 접수되었습니다. 전문가 배정 후 입력하신 연락처로 연락드립니다.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input name="name" required placeholder="이름" className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
        <input name="phone" required inputMode="tel" placeholder="연락처 (숫자만)" className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
        <select name="region" className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm">
          <option value="">지역 선택</option>
          {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <label className="flex h-10 items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="isBusiness" className="h-4 w-4" />
          사업자등록이 있어요
        </label>
      </div>
      <textarea
        name="message"
        rows={3}
        placeholder="문의 내용 (선택)"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <label className="flex items-start gap-2 text-xs text-slate-500">
        <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4" />
        <span>
          상담 연결 목적의 개인정보(이름, 연락처) 수집·이용에 동의합니다.
          수집 항목은 상담 완료 후 지체 없이 파기되며, 자세한 내용은{" "}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            개인정보처리방침
          </a>
          을 확인하세요.
        </span>
      </label>
      {state === "error" && <p className="text-sm text-urgent">{errorMsg}</p>}
      <button
        type="submit"
        disabled={state === "sending"}
        className="h-11 w-full rounded-md bg-primary text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
      >
        {state === "sending" ? "접수 중..." : "전문가 상담 요청하기"}
      </button>
    </form>
  );
}
