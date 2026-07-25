import type { AnnouncementPresentationFields } from "@/lib/query/announcement-presentation";

export interface AnnouncementDisplayMetadata
  extends AnnouncementPresentationFields {
  id: number;
  region: string | null;
}

export async function loadAnnouncementDisplayMetadata(
  ids: number[],
  signal?: AbortSignal,
) {
  const validIds = [...new Set(ids)]
    .filter((id) => Number.isSafeInteger(id) && id > 0)
    .slice(0, 100);
  if (validIds.length === 0) return [];

  const response = await fetch(
    `/api/announcements/display?ids=${validIds.join(",")}`,
    { cache: "no-store", signal },
  );
  if (!response.ok) throw new Error("DISPLAY_METADATA_UNAVAILABLE");
  const payload = (await response.json()) as { data?: unknown };
  if (!Array.isArray(payload.data)) throw new Error("INVALID_DISPLAY_METADATA");
  return payload.data.filter(isDisplayMetadata);
}

function isDisplayMetadata(value: unknown): value is AnnouncementDisplayMetadata {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Number.isSafeInteger(Number(record.id)) && Number(record.id) > 0;
}
