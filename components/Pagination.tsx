import Link from "next/link";

export default function Pagination({
  page,
  size,
  total,
  basePath,
  params,
}: {
  page: number;
  size: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const last = Math.max(1, Math.ceil(total / size));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };
  return (
    <nav className="mt-6 flex items-center justify-center gap-2 text-sm" aria-label="페이지">
      {page > 1 && (
        <Link href={href(page - 1)} className="rounded border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50">
          이전
        </Link>
      )}
      <span className="px-2 text-slate-500 tabular-nums">
        {page} / {last}
      </span>
      {page < last && (
        <Link href={href(page + 1)} className="rounded border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50">
          다음
        </Link>
      )}
    </nav>
  );
}
