import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { EXPERT_CONSULTATION_ENABLED } from "@/lib/features";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!EXPERT_CONSULTATION_ENABLED) {
    return NextResponse.json({ error: "현재 제공하지 않는 기능입니다." }, { status: 404 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { name, phone, announcementId, isBusiness, region, message, consent, utm } = body ?? {};

  if (!consent) {
    return NextResponse.json(
      { error: "개인정보 수집·이용에 동의해야 접수할 수 있습니다." },
      { status: 400 }
    );
  }
  if (!name || typeof name !== "string" || name.trim().length < 1) {
    return NextResponse.json({ error: "이름을 입력해 주세요." }, { status: 400 });
  }
  const phoneDigits = String(phone ?? "").replace(/[^0-9]/g, "");
  if (phoneDigits.length < 9 || phoneDigits.length > 11) {
    return NextResponse.json({ error: "연락처를 확인해 주세요." }, { status: 400 });
  }

  // mock 모드: DB 없이 접수 성공 처리 (UI 흐름 확인용)
  if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
    console.log("[mock] lead 접수 완료");
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabaseAdmin.from("expert_leads").insert({
    announcement_id: announcementId ? Number(announcementId) : null,
    name: name.trim().slice(0, 50),
    phone: phoneDigits,
    is_business: Boolean(isBusiness),
    region: region ? String(region).slice(0, 20) : null,
    message: message ? String(message).slice(0, 1000) : null,
    utm: utm ?? null,
    consent_at: new Date().toISOString(),
  });

  if (error) {
    console.error("lead insert 실패:", error.message);
    return NextResponse.json({ error: "접수에 실패했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
