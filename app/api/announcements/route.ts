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
      sort: (sp.get("sort") as any) ?? "deadline",
      page: sp.get("page") ? Number(sp.get("page")) : 1,
      size: sp.get("size") ? Number(sp.get("size")) : undefined,
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
