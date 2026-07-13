export const APP_BRIDGE_NAME = "GovSupportApp" as const;
export const FAVORITES_CHANGED_EVENT = "govsupport:favorites-changed" as const;

export type AppPlatform = "android" | "ios";
export type BridgeAvailability = "available" | "browser" | "outdated";

type BridgeValue = string | Record<string, unknown>;
type BridgeReturn = BridgeValue | Promise<BridgeValue>;

export interface AppInstallationContext {
  installationId: string;
  installationToken: string;
  platform: AppPlatform;
  appVersion: string | null;
}

export interface NativeFavoriteAnnouncement {
  id: number;
  title: string;
  agency: string | null;
  category_ids: number[];
  region: string | null;
  status: "open" | "closed" | null;
  apply_end: string | null;
  detail_url: string;
  original_url: string | null;
  favorited_at: number;
}

export interface NativeUserCondition {
  user_type: string;
  region: string;
  industry: string;
  interests: string[];
  startup_years: string;
  onboarding_completed: boolean;
  schema_version: number;
}

export interface FavoriteSnapshot {
  id: number;
  title: string;
  agency?: string | null;
  organization?: string | null;
  category_ids: number[];
  region: string | null;
  status: "open" | "closed" | null;
  apply_end: string | null;
  detail_url: string;
  original_url: string | null;
}

interface NativeAppBridge {
  getInstallationContext?: () => BridgeReturn;
  getFavorites?: () => BridgeReturn;
  isFavorite?: (announcementId: number) => BridgeReturn;
  addFavorite?: (announcementJson: string) => BridgeReturn;
  removeFavorite?: (announcementId: number) => BridgeReturn;
  getUserCondition?: () => BridgeReturn;
  openAppSettings?: () => BridgeReturn;
}

declare global {
  interface Window {
    GovSupportApp?: NativeAppBridge;
  }
}

export type NativeResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const favoriteMethods = [
  "getFavorites",
  "isFavorite",
  "addFavorite",
  "removeFavorite",
] as const;

export function getFavoritesBridgeAvailability(): BridgeAvailability {
  return bridgeAvailability(favoriteMethods);
}

export function getRecommendationsBridgeAvailability(): BridgeAvailability {
  return bridgeAvailability(["getUserCondition", ...favoriteMethods]);
}

export function getAppSettingsBridgeAvailability(): BridgeAvailability {
  return bridgeAvailability(["openAppSettings"]);
}

export function isAppBridgeAvailable() {
  return bridgeAvailability(["getInstallationContext"]) === "available";
}

export async function getAppInstallationContext(): Promise<AppInstallationContext | null> {
  if (!isAppBridgeAvailable()) return null;
  try {
    const value = await callBridge("getInstallationContext", []);
    return normalizeInstallationContext(parseValue(value));
  } catch {
    return null;
  }
}

export async function getFavorites(): Promise<NativeResult<NativeFavoriteAnnouncement[]>> {
  const result = await callNativeResult<unknown>("getFavorites", []);
  if (!result.success) return result;
  if (!Array.isArray(result.data)) return invalidBridgeResponse();
  const favorites = result.data.map(normalizeFavorite);
  if (favorites.some((item) => item === null)) return invalidBridgeResponse();
  return { success: true, data: favorites as NativeFavoriteAnnouncement[] };
}

export async function isFavorite(announcementId: number): Promise<NativeResult<boolean>> {
  const result = await callNativeResult<unknown>("isFavorite", [announcementId]);
  if (!result.success) return result;
  if (!isRecord(result.data) || typeof result.data.is_favorite !== "boolean") {
    return invalidBridgeResponse();
  }
  return { success: true, data: result.data.is_favorite };
}

export async function addFavorite(
  snapshot: FavoriteSnapshot,
): Promise<NativeResult<NativeFavoriteAnnouncement>> {
  const detailUrl = absoluteProductionDetailUrl(snapshot.id);
  const payload = { ...snapshot, detail_url: detailUrl };
  const result = await callNativeResult<unknown>("addFavorite", [JSON.stringify(payload)]);
  if (!result.success) return result;
  const favorite = normalizeFavorite(result.data);
  return favorite ? { success: true, data: favorite } : invalidBridgeResponse();
}

export async function removeFavorite(announcementId: number): Promise<NativeResult<boolean>> {
  const result = await callNativeResult<unknown>("removeFavorite", [announcementId]);
  if (!result.success) return result;
  if (!isRecord(result.data) || typeof result.data.removed !== "boolean") {
    return invalidBridgeResponse();
  }
  return { success: true, data: result.data.removed };
}

export async function getUserCondition(): Promise<NativeResult<NativeUserCondition>> {
  const result = await callNativeResult<unknown>("getUserCondition", []);
  if (!result.success) return result;
  const condition = normalizeUserCondition(result.data);
  return condition ? { success: true, data: condition } : invalidBridgeResponse();
}

export async function openAppSettings(): Promise<NativeResult<boolean>> {
  const result = await callNativeResult<unknown>("openAppSettings", []);
  if (!result.success) return result;
  if (!isRecord(result.data) || result.data.opened !== true) {
    return invalidBridgeResponse();
  }
  return { success: true, data: true };
}

function bridgeAvailability(methods: readonly (keyof NativeAppBridge)[]): BridgeAvailability {
  if (typeof window === "undefined" || !window[APP_BRIDGE_NAME]) return "browser";
  const bridge = window[APP_BRIDGE_NAME]!;
  return methods.every((method) => typeof bridge[method] === "function")
    ? "available"
    : "outdated";
}

async function callNativeResult<T>(
  method: keyof NativeAppBridge,
  args: unknown[],
): Promise<NativeResult<T>> {
  try {
    return normalizeNativeResult<T>(parseValue(await callBridge(method, args)));
  } catch {
    return {
      success: false,
      error: { code: "BRIDGE_ERROR", message: "앱 저장소와 연결할 수 없습니다." },
    };
  }
}

async function callBridge(method: keyof NativeAppBridge, args: unknown[]): Promise<BridgeValue> {
  if (typeof window === "undefined") throw new Error("BRIDGE_UNAVAILABLE");
  const bridge = window[APP_BRIDGE_NAME];
  const callable = bridge?.[method];
  if (typeof callable !== "function") throw new Error("BRIDGE_METHOD_UNAVAILABLE");
  return Promise.resolve((callable as (...values: unknown[]) => BridgeReturn)(...args));
}

function parseValue(value: BridgeValue): unknown {
  return typeof value === "string" ? JSON.parse(value) : value;
}

function normalizeNativeResult<T>(value: unknown): NativeResult<T> {
  if (!isRecord(value) || typeof value.success !== "boolean") return invalidBridgeResponse();
  if (value.success) return { success: true, data: value.data as T };
  const error = isRecord(value.error) ? value.error : {};
  return {
    success: false,
    error: {
      code: typeof error.code === "string" ? error.code : "BRIDGE_ERROR",
      message: typeof error.message === "string" ? error.message : "앱 요청을 처리하지 못했습니다.",
    },
  };
}

function normalizeInstallationContext(value: unknown): AppInstallationContext | null {
  if (!isRecord(value)) return null;
  const installationId = String(value.installation_id ?? "").trim().toLowerCase();
  const installationToken = String(value.installation_token ?? "").trim();
  const platform = value.platform;
  const appVersion = value.app_version;
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

function normalizeFavorite(value: unknown): NativeFavoriteAnnouncement | null {
  if (!isRecord(value)) return null;
  const id = Number(value.id);
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const detailUrl = typeof value.detail_url === "string" ? value.detail_url : "";
  if (!Number.isSafeInteger(id) || id <= 0 || !title || !isProductionDetailUrl(detailUrl, id)) {
    return null;
  }
  const status = value.status === "open" || value.status === "closed" ? value.status : null;
  return {
    id,
    title,
    agency: nullableString(value.agency),
    category_ids: normalizeCategoryIds(value.category_ids),
    region: nullableString(value.region),
    status,
    apply_end: nullableString(value.apply_end),
    detail_url: detailUrl,
    original_url: nullableString(value.original_url),
    favorited_at: Number.isFinite(Number(value.favorited_at)) ? Number(value.favorited_at) : 0,
  };
}

function normalizeUserCondition(value: unknown): NativeUserCondition | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.user_type !== "string" ||
    typeof value.region !== "string" ||
    typeof value.industry !== "string" ||
    !Array.isArray(value.interests) ||
    typeof value.startup_years !== "string" ||
    typeof value.onboarding_completed !== "boolean" ||
    !Number.isInteger(value.schema_version)
  ) {
    return null;
  }
  return {
    user_type: value.user_type,
    region: value.region,
    industry: value.industry,
    interests: value.interests.filter((item): item is string => typeof item === "string"),
    startup_years: value.startup_years,
    onboarding_completed: value.onboarding_completed,
    schema_version: Number(value.schema_version),
  };
}

function absoluteProductionDetailUrl(id: number): string {
  if (typeof window === "undefined") throw new Error("BRIDGE_UNAVAILABLE");
  return new URL(`/app/announcements/${id}`, window.location.origin).toString();
}

function isProductionDetailUrl(value: string, id: number): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "gov-support-nine.vercel.app" &&
      (url.port === "" || url.port === "443") &&
      (url.pathname === `/app/announcements/${id}` || url.pathname === `/app/announcements/${id}/`) &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function normalizeCategoryIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id >= 1 && id <= 9))]
    .sort((a, b) => a - b);
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function invalidBridgeResponse<T>(): NativeResult<T> {
  return {
    success: false,
    error: { code: "INVALID_BRIDGE_RESPONSE", message: "앱 응답 형식을 확인할 수 없습니다." },
  };
}
