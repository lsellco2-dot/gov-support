import { CATEGORIES } from "@/lib/query/announcements";

export default function CategoryChips({ ids }: { ids: number[] }) {
  if (!ids?.length) return null;
  const names = CATEGORIES.filter((c) => ids.includes(c.id)).map((c) => c.name);
  return (
    <span className="flex flex-wrap gap-1">
      {names.map((n) => (
        <span key={n} className="rounded-badge bg-primary-light px-2 py-0.5 text-[11px] font-medium text-primary-dark">
          {n}
        </span>
      ))}
    </span>
  );
}
