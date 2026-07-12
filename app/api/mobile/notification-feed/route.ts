import { NextRequest, NextResponse } from "next/server";
import {
  buildNotificationFeedPayload,
  parseNotificationFeedParams,
  queryNotificationFeed,
} from "@/lib/mobile/notification-feed";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const parsed = parseNotificationFeedParams(request.nextUrl.searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const now = new Date();
  try {
    const { rows, sources } = await queryNotificationFeed(parsed.value, now);
    const payload = buildNotificationFeedPayload(
      rows,
      sources,
      parsed.value,
      request.nextUrl.origin,
      now,
    );
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    console.error("mobile notification feed query failed");
    return NextResponse.json(
      {
        error: {
          code: "FEED_UNAVAILABLE",
          message: "The notification feed is temporarily unavailable.",
        },
      },
      { status: 500 },
    );
  }
}
