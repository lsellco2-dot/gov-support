import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const TYPES = new Set(["view", "detail", "expert_click"]);

export async function POST(req: NextRequest) {
  try {
    const { announcementId, type, sessionId } = await req.json();
    if (!TYPES.has(type)) return NextResponse.json({ ok: false }, { status: 400 });
    await supabaseAdmin.from("announcement_events").insert({
      announcement_id: announcementId ? Number(announcementId) : null,
      event_type: type,
      session_id: sessionId ? String(sessionId).slice(0, 64) : null,
    });
  } catch {
    /* 이벤트 로깅 실패는 무시 */
  }
  return NextResponse.json({ ok: true });
}
