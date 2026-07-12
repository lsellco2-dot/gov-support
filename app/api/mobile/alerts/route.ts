import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  authenticateInstallation,
  installationErrorResponse,
  parseAnnouncementId,
} from "@/lib/mobile/installation-auth";

export const dynamic = "force-dynamic";

const PUBLIC_FIELDS =
  "id,title,organization,category_ids,region,target,support_type,apply_start,apply_end,status,created_at";

export async function GET(request: NextRequest) {
  try {
    const credentials = await authenticateInstallation(request);
    const { data: alerts, error: alertsError } = await supabaseAdmin
      .from("announcement_alerts")
      .select("announcement_id,created_at")
      .eq("installation_id", credentials.installationId)
      .order("created_at", { ascending: false });
    if (alertsError) throw alertsError;
    if (!alerts?.length) return NextResponse.json({ data: [] });

    const ids = alerts.map((alert) => alert.announcement_id);
    const { data: announcements, error: announcementsError } = await supabaseAdmin
      .from("announcements_public")
      .select(PUBLIC_FIELDS)
      .in("id", ids);
    if (announcementsError) throw announcementsError;

    const byId = new Map((announcements ?? []).map((item) => [Number(item.id), item]));
    const data = alerts.flatMap((alert) => {
      const item = byId.get(Number(alert.announcement_id));
      return item ? [{ ...item, alert_created_at: alert.created_at }] : [];
    });
    return NextResponse.json({ data });
  } catch (error) {
    return installationErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const credentials = await authenticateInstallation(request);
    const body = (await request.json().catch(() => null)) as { announcement_id?: unknown } | null;
    const announcementId = parseAnnouncementId(body?.announcement_id);
    if (!announcementId) {
      return NextResponse.json(
        { error: { code: "INVALID_ANNOUNCEMENT", message: "공고 정보를 확인할 수 없습니다." } },
        { status: 400 },
      );
    }

    const { data: announcement, error: announcementError } = await supabaseAdmin
      .from("announcements_public")
      .select("id")
      .eq("id", announcementId)
      .maybeSingle();
    if (announcementError) throw announcementError;
    if (!announcement) {
      return NextResponse.json(
        { error: { code: "ANNOUNCEMENT_NOT_FOUND", message: "공개된 공고를 찾을 수 없습니다." } },
        { status: 404 },
      );
    }

    const { error } = await supabaseAdmin.from("announcement_alerts").upsert(
      {
        installation_id: credentials.installationId,
        announcement_id: announcementId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "installation_id,announcement_id" },
    );
    if (error) throw error;
    return NextResponse.json({ ok: true, announcement_id: announcementId });
  } catch (error) {
    return installationErrorResponse(error);
  }
}
