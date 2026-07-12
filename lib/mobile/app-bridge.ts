export const APP_BRIDGE_NAME = "GovSupportApp" as const;
export const APP_BRIDGE_METHOD = "getInstallationContext" as const;

export type AppPlatform = "android" | "ios";

export interface AppInstallationContext {
  installationId: string;
  installationToken: string;
  platform: AppPlatform;
  appVersion: string | null;
}

interface NativeAppBridge {
  /** JSON 문자열 또는 같은 구조의 객체를 반환한다. */
  getInstallationContext: () => string | Record<string, unknown> | Promise<string | Record<string, unknown>>;
}

declare global {
  interface Window {
    GovSupportApp?: NativeAppBridge;
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isAppBridgeAvailable() {
  return typeof window !== "undefined" &&
    typeof window[APP_BRIDGE_NAME]?.[APP_BRIDGE_METHOD] === "function";
}

export async function getAppInstallationContext(): Promise<AppInstallationContext | null> {
  if (!isAppBridgeAvailable()) return null;
  try {
    const bridge = window[APP_BRIDGE_NAME]!;
    const raw = await Promise.resolve(bridge[APP_BRIDGE_METHOD]());
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    return normalizeContext(value);
  } catch {
    return null;
  }
}

function normalizeContext(value: unknown): AppInstallationContext | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const installationId = String(record.installation_id ?? "").trim().toLowerCase();
  const installationToken = String(record.installation_token ?? "").trim();
  const platform = record.platform;
  const appVersion = record.app_version;

  if (
    !UUID_PATTERN.test(installationId) ||
    installationToken.length < 32 ||
    installationToken.length > 512 ||
    (platform !== "android" && platform !== "ios") ||
    (appVersion !== null && appVersion !== undefined && typeof appVersion !== "string")
  ) {
    return null;
  }

  return {
    installationId,
    installationToken,
    platform,
    appVersion: typeof appVersion === "string" ? appVersion.slice(0, 64) : null,
  };
}
