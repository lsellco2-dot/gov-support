import { createHash } from "crypto";
import type { NormalizedAnnouncement } from "./types";

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .replace(/\s+/g, "")
    .replace(/[\[\]()〈〉<>「」『』【】]/g, "")
    .toLowerCase();

/** 출처 간 중복 탐지용: 제목 + 기관 + 마감일 */
export function contentHash(a: NormalizedAnnouncement): string {
  return createHash("sha256")
    .update([norm(a.title), norm(a.organization), a.applyEnd ?? ""].join("|"))
    .digest("hex");
}
