import type { NativeFavoriteAnnouncement } from "./app-bridge";

export type FavoriteSort = "latest" | "deadline";

export function sortFavoriteAnnouncements(
  items: NativeFavoriteAnnouncement[],
  sort: FavoriteSort,
) {
  return [...items].sort((a, b) => {
    if (sort === "deadline") {
      const aEnd = normalizedDate(a.apply_end);
      const bEnd = normalizedDate(b.apply_end);
      if (aEnd === null && bEnd !== null) return 1;
      if (aEnd !== null && bEnd === null) return -1;
      if (aEnd !== null && bEnd !== null) {
        const deadlineOrder = aEnd.localeCompare(bEnd);
        if (deadlineOrder !== 0) return deadlineOrder;
      }
    }
    return b.favorited_at - a.favorited_at || b.id - a.id;
  });
}

function normalizedDate(value: string | null) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
