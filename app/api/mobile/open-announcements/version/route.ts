import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, count, error } = await supabaseAdmin
      .from("announcements_public")
      .select("id,created_at", { count: "exact" })
      .eq("status", "open")
      .order("id", { ascending: false })
      .limit(1);
    if (error) throw error;

    const latest = data?.[0];
    return NextResponse.json(
      {
        version: [
          koreaDateKey(),
          latest?.id ?? 0,
          latest?.created_at ?? "",
          count ?? 0,
        ].join(":"),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    console.error("open announcements version query failed");
    return NextResponse.json(
      {
        error: {
          code: "OPEN_ANNOUNCEMENTS_VERSION_UNAVAILABLE",
          message: "공고 갱신 상태를 확인할 수 없습니다.",
        },
      },
      { status: 500 },
    );
  }
}

function koreaDateKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
