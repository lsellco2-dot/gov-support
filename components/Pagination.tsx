import Link from "next/link";
import type { ReactNode } from "react";

const PAGE_GROUP_SIZE = 10;

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
  const current = Math.min(Math.max(page, 1), last);
  const groupStart =
    Math.floor((current - 1) / PAGE_GROUP_SIZE) * PAGE_GROUP_SIZE + 1;
  const groupEnd = Math.min(last, groupStart + PAGE_GROUP_SIZE - 1);
  const pages = Array.from(
    { length: groupEnd - groupStart + 1 },
    (_, index) => groupStart + index
  );

  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) sp.set(key, value);
    }
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };

  return (
    <nav className="mt-6 overflow-x-auto pb-1" aria-label="페이지">
      <div className="mx-auto flex w-max max-w-full items-center justify-center gap-1.5 px-1 text-sm">
        <PageLink href={href(1)} disabled={current === 1} label="처음 페이지">
          &laquo;
        </PageLink>
        <PageLink
          href={href(current - 1)}
          disabled={current === 1}
          label="이전 페이지"
        >
          &lsaquo;
        </PageLink>

        {pages.map((item) => (
          <PageLink
            key={item}
            href={href(item)}
            active={item === current}
            label={`${item}페이지`}
          >
            {item}
          </PageLink>
        ))}

        <PageLink
          href={href(current + 1)}
          disabled={current === last}
          label="다음 페이지"
        >
          &rsaquo;
        </PageLink>
        <PageLink
          href={href(last)}
          disabled={current === last}
          label="마지막 페이지"
        >
          &raquo;
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({
  href,
  active = false,
  disabled = false,
  label,
  children,
}: {
  href: string;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: ReactNode;
}) {
  const className = [
    "inline-flex h-11 min-w-11 shrink-0 items-center justify-center rounded-md border px-2.5 font-semibold tabular-nums transition",
    active
      ? "border-primary bg-primary text-white shadow-sm"
      : "border-line bg-white text-ink hover:border-primary hover:text-primary",
    disabled
      ? "pointer-events-none border-slate-200 bg-slate-50 text-slate-300"
      : "",
  ].join(" ");

  if (disabled) {
    return (
      <span className={className} aria-label={label} aria-disabled="true">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={className}
      aria-label={label}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
