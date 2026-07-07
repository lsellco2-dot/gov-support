import { notFound } from "next/navigation";
import Link from "next/link";
import DDayBadge from "@/components/DDayBadge";
import CategoryChips from "@/components/CategoryChips";
import LeadForm from "@/components/LeadForm";
import ShareButton from "@/components/ShareButton";
import { getAnnouncement } from "@/lib/query/announcements";

export const dynamic = "force-dynamic";

export default async function AppDetail({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();
  const item = await getAnnouncement(id);
  if (!item) notFound();

  return (
    <article>
      <div className="flex items-center justify-between">
        <Link href="/app" className="text-sm text-slate-500">← 목록으로</Link>
        <ShareButton title={item.title} />
      </div>
      <div className="mt-2 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-base font-bold leading-snug">{item.title}</h1>
          <DDayBadge applyEnd={item.apply_end} />
        </div>
        <div className="mt-2"><CategoryChips ids={item.category_ids} /></div>
        <div className="mt-4 space-y-2 text-sm">
          <p><span className="text-slate-400">기관</span> {item.organization ?? "-"}</p>
          <p><span className="text-slate-400">지역</span> {item.region ?? "전국"}</p>
          <p><span className="text-slate-400">대상</span> {item.target ?? "-"}</p>
          <p><span className="text-slate-400">기간</span> {item.apply_start ?? "?"} ~ {item.apply_end ?? "상시"}</p>
        </div>
        {item.summary && (
          <p className="mt-4 whitespace-pre-line rounded-md bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
            {item.summary}
          </p>
        )}
        {item.detail_url && (
          <a
            href={item.detail_url}
            className="mt-4 flex h-11 items-center justify-center rounded-md border border-primary text-sm font-semibold text-primary"
          >
            공고 원문 보기 →
          </a>
        )}
        <p className="mt-3 text-[11px] text-slate-400">
          출처: {item.organization ?? "해당 기관"} · 공공데이터포털 — 정확한 내용은 원문 공고를 확인하세요.
        </p>
      </div>

      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-bold">전문가 무료 상담</h2>
        <p className="mt-1 text-xs text-slate-500">신청 자격 확인부터 서류 준비까지 도와드립니다.</p>
        <div className="mt-3"><LeadForm announcementId={item.id} /></div>
      </section>
    </article>
  );
}
