import { notFound } from "next/navigation";
import Link from "next/link";
import DDayBadge from "@/components/DDayBadge";
import CategoryChips from "@/components/CategoryChips";
import LeadForm from "@/components/LeadForm";
import ShareButton from "@/components/ShareButton";
import { getAnnouncement } from "@/lib/query/announcements";
import { EXPERT_CONSULTATION_ENABLED } from "@/lib/features";

export const dynamic = "force-dynamic";

export default async function AppDetail({ params }: { params: { id: string } }) {
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
    <article>
      <div className="flex items-center justify-between">
        <Link href="/app/announcements" className="inline-flex h-11 items-center text-sm text-subtle">← 목록으로</Link>
        <ShareButton title={item.title} />
      </div>
      <div className="mt-2 rounded-lg border border-line bg-white p-4">
        <div className="flex items-start justify-between gap-2">
          <h1 className="min-w-0 break-words text-base font-bold leading-snug text-ink">{item.title}</h1>
          <DDayBadge applyEnd={item.apply_end} />
        </div>
        <div className="mt-2"><CategoryChips ids={item.category_ids} /></div>
        <dl className="mt-4 space-y-2 rounded-lg border border-line bg-slate-50 p-3 text-sm">
          <div className="flex gap-2"><dt className="w-12 shrink-0 font-medium text-subtle">기관</dt><dd className="min-w-0 break-words text-ink">{item.organization ?? "정보 없음"}</dd></div>
          <div className="flex gap-2"><dt className="w-12 shrink-0 font-medium text-subtle">지역</dt><dd className="text-ink">{item.region ?? "전국"}</dd></div>
          <div className="flex gap-2"><dt className="w-12 shrink-0 font-medium text-subtle">대상</dt><dd className="min-w-0 break-words text-ink">{item.target ?? "정보 없음"}</dd></div>
          <div className="flex gap-2"><dt className="w-12 shrink-0 font-medium text-subtle">기간</dt><dd className="min-w-0 break-words text-ink">{formatApplyPeriod(item.apply_start, item.apply_end)}</dd></div>
        </dl>
        {item.summary && (
          <p className="mt-4 whitespace-pre-line rounded-lg border-l-4 border-primary bg-primary-light p-3 text-sm leading-relaxed text-ink">
            {item.summary}
          </p>
        )}
        {!item.summary && !hasDetailedInfo && (
          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-subtle">
            상세 내용은 원문 공고에서 확인해 주세요.
          </p>
        )}
        {hasDetailedInfo && (
          <div className="mt-5 space-y-5 border-t border-line pt-5">
            {item.source_id === 2 && (
              <div className="rounded-lg border-l-4 border-info bg-[#EAF3FB] px-4 py-3 text-xs leading-relaxed text-ink">
                K-Startup 공고 정보는 해당 기관 요청에 의해 제공됩니다. 신청 정보는 해당 기관에서 관리됩니다.
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
            className="mt-4 flex h-12 items-center justify-center rounded-md border border-primary text-sm font-semibold text-primary"
          >
            공고 원문 보기 →
          </a>
        )}
        {!item.detail_url && (
          <p className="mt-4 rounded-lg border border-line bg-slate-50 p-3 text-xs leading-relaxed text-subtle">
            원문 링크가 제공되지 않은 공고입니다. 정확한 내용은 소관 기관에 확인해 주세요.
          </p>
        )}
        <p className="mt-3 text-[11px] text-slate-400">
          출처: {item.organization ?? "해당 기관"} · 공공데이터포털 — 정확한 내용은 원문 공고를 확인하세요.
        </p>
      </div>

      {EXPERT_CONSULTATION_ENABLED && (
        <section className="mt-4 rounded-lg border border-line bg-white p-4">
          <h2 className="text-base font-bold text-ink">전문가 무료 상담</h2>
          <p className="mt-1 text-xs text-subtle">신청 자격 확인부터 서류 준비까지 도와드립니다.</p>
          <div className="mt-3"><LeadForm announcementId={item.id} /></div>
        </section>
      )}
    </article>
  );
}

function DetailBlock({ title, value }: { title: string; value: string | null }) {
  if (!value) return null;
  const rows = toDetailRows(value);
  return (
    <section className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0">
      <h2 className="text-sm font-bold text-ink">{title}</h2>
      <div className="mt-2 divide-y divide-slate-100 border-y border-slate-100">
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`} className="py-3 text-sm leading-relaxed">
            {row.body ? (
              <>
                <h3 className="font-bold text-ink">{row.label}</h3>
                <p className="mt-1 whitespace-pre-line text-slate-700">{row.body}</p>
              </>
            ) : (
              <p className="whitespace-pre-line font-semibold text-slate-700">{row.label}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function AttachmentList({ links }: { links: { label: string; url: string }[] }) {
  return (
    <section className="border-t border-slate-200 pt-4">
      <h2 className="text-sm font-bold text-ink">관련 링크/자료</h2>
      <ul className="mt-2 divide-y divide-slate-100 border-y border-slate-100">
        {links.map((link) => (
          <li key={`${link.label}-${link.url}`} className="py-3 text-sm">
            <span className="block break-words text-slate-700">{link.label}</span>
            <a
              href={link.url}
              className="mt-2 inline-flex h-11 items-center justify-center rounded-md border border-slate-300 px-4 text-xs font-semibold text-ink"
            >
              열기
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatApplyPeriod(start: string | null, end: string | null) {
  if (!start && !end) return "정보 없음";
  return `${start ?? "시작일 미정"} ~ ${end ?? "상시/미정"}`;
}

function toDetailRows(value: string) {
  const blocks = value
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length <= 1) return { label: lines[0] ?? block, body: "" };
    return { label: lines[0], body: lines.slice(1).join("\n") };
  });
}
