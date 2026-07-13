import assert from "node:assert/strict";
import test from "node:test";
import type { NativeFavoriteAnnouncement } from "./app-bridge";
import { sortFavoriteAnnouncements } from "./favorite-sort";

test("sorts favorites by most recently saved by default", () => {
  const items = [favorite(1, 100, "2026-08-01"), favorite(2, 300, "2026-09-01")];

  assert.deepEqual(sortFavoriteAnnouncements(items, "latest").map((item) => item.id), [2, 1]);
  assert.deepEqual(items.map((item) => item.id), [1, 2]);
});

test("sorts favorites by deadline and places missing dates last", () => {
  const items = [
    favorite(1, 400, null),
    favorite(2, 200, "2026-08-10"),
    favorite(3, 300, "2026-07-20"),
    favorite(4, 500, "invalid"),
  ];

  assert.deepEqual(
    sortFavoriteAnnouncements(items, "deadline").map((item) => item.id),
    [3, 2, 4, 1],
  );
});

function favorite(
  id: number,
  favoritedAt: number,
  applyEnd: string | null,
): NativeFavoriteAnnouncement {
  return {
    id,
    title: `공고 ${id}`,
    agency: null,
    category_ids: [],
    region: null,
    status: "open",
    apply_end: applyEnd,
    detail_url: `https://gov-support-nine.vercel.app/app/announcements/${id}`,
    original_url: null,
    favorited_at: favoritedAt,
  };
}
