import { NextRequest, NextResponse } from "next/server";
import { getAnnouncement } from "@/lib/query/announcements";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  try {
    const item = await getAnnouncement(id);
    if (!item) return NextResponse.json({ error: "공고를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json(item);
  } catch (error) {
    console.error("announcement detail 조회 실패:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json(
      { error: "공고 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요." },
      { status: 500 }
    );
  }
}
