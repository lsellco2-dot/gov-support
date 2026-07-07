import { NextRequest, NextResponse } from "next/server";
import { listAnnouncements } from "@/lib/query/announcements";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  try {
    const result = await listAnnouncements({
      q: sp.get("q") ?? undefined,
      category: sp.get("category") ? Number(sp.get("category")) : undefined,
      region: sp.get("region") ?? undefined,
      status: (sp.get("status") as any) ?? "open",
      sort: (sp.get("sort") as any) ?? "deadline",
      page: sp.get("page") ? Number(sp.get("page")) : 1,
      size: sp.get("size") ? Number(sp.get("size")) : 20,
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
