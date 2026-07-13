import { NextRequest, NextResponse } from "next/server";
import { listAnnouncements } from "@/lib/query/announcements";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  try {
    const result = await listAnnouncements({
      q: sp.get("q") ?? undefined,
      audience: (sp.get("audience") as any) ?? "all",
      category: sp.get("category") ? Number(sp.get("category")) : undefined,
      region: sp.get("region") ?? undefined,
      status: (sp.get("status") as any) ?? "open",
      sort: (sp.get("sort") as any) ?? "latest",
      page: sp.get("page") ? Number(sp.get("page")) : 1,
      size: sp.get("size") ? Number(sp.get("size")) : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("announcement list 조회 실패:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json(
      { error: "공고 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요." },
      { status: 500 }
    );
  }
}
