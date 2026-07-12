import { notFound } from "next/navigation";
import Link from "next/link";
import DDayBadge from "@/components/DDayBadge";
import CategoryChips from "@/components/CategoryChips";
import LeadForm from "@/components/LeadForm";
import DetailContentBody from "@/components/DetailContentBody";
import { getAnnouncement } from "@/lib/query/announcements";
import { EXPERT_CONSULTATION_ENABLED } from "@/lib/features";

export const dynamic = "force-dynamic";

export default async function DetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();
  const item = await getAnnouncement(id);
  if (!item) notFound();
  const hasDetailedInfo = Boolean(
    (item.detail_content && item.detail_content !== item.summary) ||
      item.apply_method ||
      item.documents ||
      item.contact ||
      item.extra_sections?.length ||
      item.attachments?.length
  );
  const hasStoredOriginal = Boolean(item.detail_fetched_at && item.detail_content);

  return (
    <article className="mx-auto max-w-3xl">
      <Link href="/announcements" className="text-sm text-subtle hover:text-primary">
        ← 목록으로
      </Link>
      <div className="mt-3 rounded-lg border border-line bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 break-words text-xl font-bold leading-snug text-ink">{item.title}</h1>
          <DDayBadge applyEnd={item.apply_end} />
        </div>
        <div className="mt-3">
          <CategoryChips ids={item.category_ids} />
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border border-line bg-slate-50 p-4 text-sm sm:grid-cols-2">
          <Row k="소관/수행기관" v={item.organization} />
          <Row k="지역" v={item.region} />
          <Row k="지원대상" v={item.target} />
          <Row k="지원형태" v={item.support_type} />
          <Row k="접수 시작" v={item.apply_start ?? "정보 없음"} />
          <Row k="접수 마감" v={item.apply_end ?? (item.apply_start ? "상시/미정" : "정보 없음")} />
        </dl>

        {item.summary && (
          <p className="mt-5 whitespace-pre-line rounded-lg border-l-4 border-primary bg-primary-light p-4 text-sm leading-relaxed text-ink">
            {item.summary}
          </p>
        )}
        {!item.summary && !hasDetailedInfo && (
          <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-subtle">
            상세 내용은 원문 공고에서 확인해 주세요.
          </p>
        )}

        {hasDetailedInfo && (
          <div className="mt-6 space-y-7 border-t border-line pt-6">
            {item.source_id === 2 && (
              <div className="rounded-lg border-l-4 border-info bg-[#EAF3FB] px-5 py-4 text-sm leading-relaxed text-ink">
                K-Startup에 공고되는 정보는 해당 기관의 요청에 의해 제공됩니다. 사업 신청 시 요청하는 정보는 해당 기관에서 관리되오니 유의해 주세요.
              </div>
            )}
            <DetailBlock
              title="상세내용"
              value={item.detail_content !== item.summary ? item.detail_content : null}
            />
            {!hasStoredOriginal && (
              <>
                <DetailBlock title="신청방법" value={item.apply_method} />
                <DetailBlock title="제출서류" value={item.documents} />
                {item.extra_sections?.map((section) => (
                  <DetailBlock key={section.title} title={section.title} value={section.body} />
                ))}
                <DetailBlock title="문의처" value={item.contact} />
              </>
            )}
            {(item.attachments?.length ?? 0) > 0 && (
              <AttachmentList links={item.attachments} />
            )}
          </div>
        )}

        {item.detail_url && (
          <a
            href={item.detail_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-md border border-primary text-sm font-semibold text-primary transition hover:bg-primary-light sm:w-auto sm:px-6"
          >
            공고 원문 보기 →
          </a>
        )}
        {!item.detail_url && (
          <p className="mt-6 rounded-lg border border-line bg-slate-50 p-4 text-sm text-subtle">
            원문 링크가 제공되지 않은 공고입니다. 정확한 내용은 소관 기관에 확인해 주세요.
          </p>
        )}

        <p className="mt-4 text-xs text-slate-400">
          출처: {item.organization ?? "해당 기관"} · 공공데이터포털 — 정확한 내용은 반드시 원문 공고를 확인하세요.
        </p>
      </div>

      {EXPERT_CONSULTATION_ENABLED && (
        <section className="mt-6 rounded-lg border border-line bg-white p-6">
          <h2 className="text-lg font-bold text-ink">이 공고, 전문가와 함께 준비하기</h2>
          <p className="mt-1 text-sm text-subtle">
            신청 자격 확인부터 사업계획서까지, 검증된 전문가가 무료로 1차 상담해 드립니다.
          </p>
          <div className="mt-4">
            <LeadForm announcementId={item.id} />
          </div>
        </section>
      )}
    </article>
  );
}

function Row({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 font-medium text-subtle">{k}</dt>
      <dd className="min-w-0 break-words text-ink">{v ?? "정보 없음"}</dd>
    </div>
  );
}

function DetailBlock({ title, value }: { title: string; value: string | null }) {
  if (!value) return null;
  return (
    <section className="border-t border-slate-200 pt-5 first:border-t-0 first:pt-0">
      <h2 className="flex items-center gap-2 text-base font-bold text-ink">
        <span aria-hidden className="h-[18px] w-1 shrink-0 rounded-full bg-primary" />
        {title}
      </h2>
      <div className="mt-4 rounded-lg border border-line bg-white px-5 py-5">
        <DetailContentBody text={value} />
      </div>
    </section>
  );
}

function AttachmentList({ links }: { links: { label: string; url: string }[] }) {
  return (
    <section className="border-t border-slate-200 pt-5">
      <h2 className="text-base font-bold text-ink">관련 링크/자료</h2>
      <ul className="mt-3 divide-y divide-slate-100 border-y border-slate-100">
        {links.map((link) => (
          <li
            key={`${link.label}-${link.url}`}
            className="flex flex-col gap-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="flex min-w-0 items-start gap-2 text-slate-700">
              <span className="mt-0.5 text-lg leading-none text-slate-400">↗</span>
              <span className="break-words">{link.label}</span>
            </span>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-ink hover:border-primary hover:text-primary"
            >
              열기
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
