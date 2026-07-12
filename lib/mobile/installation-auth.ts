import { createHash, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_MIN_LENGTH = 32;
const TOKEN_MAX_LENGTH = 512;

export interface InstallationCredentials {
  installationId: string;
  installationToken: string;
}

export class InstallationAuthError extends Error {
  constructor(
    public readonly status: 401 | 403 | 503,
    public readonly code: "INVALID_INSTALLATION" | "INSTALLATION_FORBIDDEN" | "SERVICE_UNAVAILABLE",
  ) {
    super(code);
  }
}

export function parseInstallationHeaders(headers: Headers): InstallationCredentials | null {
  const installationId = headers.get("x-installation-id")?.trim().toLowerCase() ?? "";
  const installationToken = headers.get("x-installation-token")?.trim() ?? "";
  if (
    !UUID_PATTERN.test(installationId) ||
    installationToken.length < TOKEN_MIN_LENGTH ||
    installationToken.length > TOKEN_MAX_LENGTH
  ) {
    return null;
  }
  return { installationId, installationToken };
}

export function hashInstallationToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function tokenHashMatches(token: string, expectedHash: string) {
  const actual = Buffer.from(hashInstallationToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function parseAnnouncementId(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function authenticateInstallation(request: Request) {
  const credentials = parseInstallationHeaders(request.headers);
  if (!credentials) {
    throw new InstallationAuthError(401, "INVALID_INSTALLATION");
  }

  const { data, error } = await supabaseAdmin
    .from("device_installations")
    .select("installation_id,token_hash")
    .eq("installation_id", credentials.installationId)
    .maybeSingle();

  if (error) throw new InstallationAuthError(503, "SERVICE_UNAVAILABLE");
  if (!data) throw new InstallationAuthError(401, "INVALID_INSTALLATION");
  if (!tokenHashMatches(credentials.installationToken, data.token_hash)) {
    throw new InstallationAuthError(403, "INSTALLATION_FORBIDDEN");
  }
  return credentials;
}

export function installationErrorResponse(error: unknown) {
  if (error instanceof InstallationAuthError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message:
            error.status === 503
              ? "알림 서비스를 일시적으로 사용할 수 없습니다."
              : "기기 인증에 실패했습니다.",
        },
      },
      { status: error.status },
    );
  }
  return Response.json(
    { error: { code: "SERVICE_UNAVAILABLE", message: "알림 서비스를 일시적으로 사용할 수 없습니다." } },
    { status: 503 },
  );
}
