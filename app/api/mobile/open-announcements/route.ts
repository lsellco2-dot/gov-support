import { NextRequest, NextResponse } from "next/server";
import {
  buildOpenAnnouncementsPayload,
  parseOpenAnnouncementsParams,
  queryOpenAnnouncements,
} from "@/lib/mobile/open-announcements";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const parsed = parseOpenAnnouncementsParams(request.nextUrl.searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  try {
    const result = await queryOpenAnnouncements(parsed.value);
    return NextResponse.json(
      buildOpenAnnouncementsPayload(result, request.nextUrl.origin),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    console.error("open announcements query failed");
    return NextResponse.json(
      {
        error: {
          code: "OPEN_ANNOUNCEMENTS_UNAVAILABLE",
          message: "공고 목록을 일시적으로 불러올 수 없습니다.",
        },
      },
      { status: 500 },
    );
  }
}
