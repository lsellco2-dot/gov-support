import { NextRequest, NextResponse } from "next/server";
import { getAnnouncementPresentations } from "@/lib/query/announcements";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ids = parseIds(request.nextUrl.searchParams.get("ids"));
  if (!ids) {
    return NextResponse.json(
      { error: "ids must contain up to 100 comma-separated positive integers." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(
      { data: await getAnnouncementPresentations(ids) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    console.error("announcement display metadata query failed");
    return NextResponse.json(
      { error: "공고 표시 정보를 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

function parseIds(value: string | null) {
  if (!value || !/^\d+(?:,\d+)*$/.test(value)) return null;
  const ids = [...new Set(value.split(",").map(Number))];
  return ids.length <= 100 &&
    ids.every((id) => Number.isSafeInteger(id) && id > 0)
    ? ids
    : null;
}
