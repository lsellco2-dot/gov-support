import type { AppInstallationContext } from "./app-bridge";

export interface AlertAnnouncement {
  id: number;
  title: string;
  organization: string | null;
  category_ids: number[];
  region: string | null;
  target: string | null;
  support_type: string | null;
  apply_start: string | null;
  apply_end: string | null;
  status: "open" | "closed";
  created_at: string;
  alert_created_at: string;
}

export class AlertsApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

const registrations = new Map<string, Promise<void>>();

export function registerInstallation(context: AppInstallationContext) {
  const cached = registrations.get(context.installationId);
  if (cached) return cached;
  const request = apiFetch("/api/mobile/installations/register", context, {
    method: "POST",
    body: JSON.stringify({ platform: context.platform, app_version: context.appVersion }),
  }).then(() => undefined);
  registrations.set(context.installationId, request);
  request.catch(() => registrations.delete(context.installationId));
  return request;
}

export async function listAnnouncementAlerts(context: AppInstallationContext) {
  const payload = await apiFetch<{ data: AlertAnnouncement[] }>("/api/mobile/alerts", context);
  return payload.data;
}

export async function addAnnouncementAlert(context: AppInstallationContext, announcementId: number) {
  await apiFetch("/api/mobile/alerts", context, {
    method: "POST",
    body: JSON.stringify({ announcement_id: announcementId }),
  });
}

export async function removeAnnouncementAlert(
  context: AppInstallationContext,
  announcementId: number,
) {
  await apiFetch(`/api/mobile/alerts/${announcementId}`, context, { method: "DELETE" });
}

async function apiFetch<T = unknown>(
  path: string,
  context: AppInstallationContext,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Installation-Id": context.installationId,
      "X-Installation-Token": context.installationToken,
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message ?? "알림 요청을 처리하지 못했습니다.";
    throw new AlertsApiError(response.status, message);
  }
  return payload as T;
}
