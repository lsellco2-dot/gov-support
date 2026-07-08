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
      <div className="rounded-lg border border-open/40 bg-[#EAF6EC] p-4 text-sm font-medium text-open">
        상담 요청이 접수되었습니다. 전문가 배정 후 입력하신 연락처로 연락드립니다.
      </div>
    );
  }

  const inputClass =
    "h-11 rounded-lg border border-line bg-white px-3 text-sm text-ink placeholder:text-slate-400 focus:border-primary";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="lead-name" className="text-sm font-semibold text-ink">
            이름 <span className="text-urgent">*</span>
          </label>
          <input id="lead-name" name="name" required placeholder="이름" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="lead-phone" className="text-sm font-semibold text-ink">
            연락처 <span className="text-urgent">*</span>
          </label>
          <input id="lead-phone" name="phone" required inputMode="tel" placeholder="숫자만 입력" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="lead-region" className="text-sm font-semibold text-ink">지역</label>
          <select id="lead-region" name="region" className={`${inputClass} bg-white`}>
            <option value="">지역 선택</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-subtle">
          <input type="checkbox" name="isBusiness" className="h-4 w-4 accent-[#256ef4]" />
          사업자등록이 있어요
        </label>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="lead-message" className="text-sm font-semibold text-ink">문의 내용 <span className="font-normal text-subtle">(선택)</span></label>
        <textarea
          id="lead-message"
          name="message"
          rows={3}
          placeholder="상담받고 싶은 내용을 적어주세요."
          className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder:text-slate-400 focus:border-primary"
        />
      </div>
      <label className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-subtle">
        <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 accent-[#256ef4]" />
        <span>
          상담 연결 목적의 개인정보(이름, 연락처) 수집·이용에 동의합니다.
          수집 항목은 수집일로부터 3개월 보관 후 파기되며, 자세한 내용은{" "}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline"
          >
            개인정보처리방침
          </a>
          을 확인하세요.
        </span>
      </label>
      {state === "error" && (
        <p className="rounded-lg border border-urgent/30 bg-[#FCE8E6] px-3 py-2 text-sm text-urgent">{errorMsg}</p>
      )}
      <button
        type="submit"
        disabled={state === "sending"}
        className="h-12 w-full rounded-md bg-primary text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
      >
        {state === "sending" ? "접수 중..." : "전문가 상담 요청하기"}
      </button>
    </form>
  );
}
