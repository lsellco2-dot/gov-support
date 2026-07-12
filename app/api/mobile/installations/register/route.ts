import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  hashInstallationToken,
  InstallationAuthError,
  installationErrorResponse,
  parseInstallationHeaders,
  tokenHashMatches,
} from "@/lib/mobile/installation-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const credentials = parseInstallationHeaders(request.headers);
  if (!credentials) {
    return installationErrorResponse(new InstallationAuthError(401, "INVALID_INSTALLATION"));
  }

  const body = await readBody(request);
  if (!body) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "앱 정보를 확인할 수 없습니다." } },
      { status: 400 },
    );
  }

  const { data: existing, error: readError } = await supabaseAdmin
    .from("device_installations")
    .select("installation_id,token_hash")
    .eq("installation_id", credentials.installationId)
    .maybeSingle();
  if (readError) return installationErrorResponse(readError);

  const now = new Date().toISOString();
  if (existing) {
    if (!tokenHashMatches(credentials.installationToken, existing.token_hash)) {
      return installationErrorResponse(
        new InstallationAuthError(403, "INSTALLATION_FORBIDDEN"),
      );
    }
    const { error } = await supabaseAdmin
      .from("device_installations")
      .update({ platform: body.platform, app_version: body.appVersion, last_seen_at: now })
      .eq("installation_id", credentials.installationId);
    if (error) return installationErrorResponse(error);
    return NextResponse.json({ ok: true, registered: false });
  }

  const { error } = await supabaseAdmin.from("device_installations").insert({
    installation_id: credentials.installationId,
    token_hash: hashInstallationToken(credentials.installationToken),
    platform: body.platform,
    app_version: body.appVersion,
    created_at: now,
    last_seen_at: now,
  });
  if (error) {
    // 동일 UUID가 동시에 등록된 경우에도 토큰을 덮어쓰지 않는다.
    if (error.code === "23505") {
      const { data: raced } = await supabaseAdmin
        .from("device_installations")
        .select("token_hash")
        .eq("installation_id", credentials.installationId)
        .maybeSingle();
      if (raced && tokenHashMatches(credentials.installationToken, raced.token_hash)) {
        return NextResponse.json({ ok: true, registered: false });
      }
      return installationErrorResponse(
        new InstallationAuthError(403, "INSTALLATION_FORBIDDEN"),
      );
    }
    return installationErrorResponse(error);
  }
  return NextResponse.json({ ok: true, registered: true }, { status: 201 });
}

async function readBody(request: NextRequest) {
  try {
    const value = (await request.json()) as Record<string, unknown>;
    const platform = value.platform;
    const appVersion = value.app_version;
    if (platform !== "android" && platform !== "ios") return null;
    if (appVersion !== null && appVersion !== undefined && typeof appVersion !== "string") return null;
    const normalizedVersion = typeof appVersion === "string" ? appVersion.trim() : null;
    if (normalizedVersion && normalizedVersion.length > 64) return null;
    return { platform, appVersion: normalizedVersion || null };
  } catch {
    return null;
  }
}
