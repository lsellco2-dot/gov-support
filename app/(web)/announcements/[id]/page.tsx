import { notFound } from "next/navigation";
import DDayBadge from "@/components/DDayBadge";
import CategoryChips from "@/components/CategoryChips";
import LeadForm from "@/components/LeadForm";
import { getAnnouncement } from "@/lib/query/announcements";

export const dynamic = "force-dynamic";

export default async function DetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();
  const item = await getAnnouncement(id);
  if (!item) notFound();

  return (
    <article className="mx-auto max-w-3xl">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold leading-snug">{item.title}</h1>
          <DDayBadge applyEnd={item.apply_end} />
        </div>
        <div className="mt-3">
          <CategoryChips ids={item.category_ids} />
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Row k="소관/수행기관" v={item.organization} />
          <Row k="지역" v={item.region} />
          <Row k="지원대상" v={item.target} />
          <Row k="지원형태" v={item.support_type} />
          <Row k="접수 시작" v={item.apply_start} />
          <Row k="접수 마감" v={item.apply_end ?? "상시"} />
        </dl>

        {item.summary && (
          <p className="mt-5 whitespace-pre-line rounded-md bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
            {item.summary}
          </p>
        )}

        {item.detail_url && (
          <a
            href={item.detail_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md border border-primary text-sm font-semibold text-primary hover:bg-primary-light sm:w-auto sm:px-6"
          >
            공고 원문 보기 →
          </a>
        )}

        <p className="mt-4 text-xs text-slate-400">
          출처: {item.organization ?? "해당 기관"} · 공공데이터포털 — 정확한 내용은 반드시 원문 공고를 확인하세요.
        </p>
      </div>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-base font-bold">이 공고, 전문가와 함께 준비하기</h2>
        <p className="mt-1 text-sm text-slate-500">
          신청 자격 확인부터 사업계획서까지, 검증된 전문가가 무료로 1차 상담해 드립니다.
        </p>
        <div className="mt-4">
          <LeadForm announcementId={item.id} />
        </div>
      </section>
    </article>
  );
}

function Row({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-slate-400">{k}</dt>
      <dd className="text-ink">{v ?? "-"}</dd>
    </div>
  );
}
