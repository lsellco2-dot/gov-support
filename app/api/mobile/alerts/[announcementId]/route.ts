import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  authenticateInstallation,
  installationErrorResponse,
  parseAnnouncementId,
} from "@/lib/mobile/installation-auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { announcementId: string } },
) {
  try {
    const credentials = await authenticateInstallation(request);
    const announcementId = parseAnnouncementId(params.announcementId);
    if (!announcementId) {
      return NextResponse.json(
        { error: { code: "INVALID_ANNOUNCEMENT", message: "공고 정보를 확인할 수 없습니다." } },
        { status: 400 },
      );
    }
    const { error } = await supabaseAdmin
      .from("announcement_alerts")
      .delete()
      .eq("installation_id", credentials.installationId)
      .eq("announcement_id", announcementId);
    if (error) throw error;
    return NextResponse.json({ ok: true, announcement_id: announcementId });
  } catch (error) {
    return installationErrorResponse(error);
  }
}
