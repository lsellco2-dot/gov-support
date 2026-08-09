export type AdminRole = "admin";

export interface AdminIdentity {
  id: string;
  email: string | null;
  displayName: string | null;
  provider: string | null;
}

export type AdminAccess =
  | { status: "authorized"; user: AdminIdentity; role: AdminRole }
  | { status: "forbidden"; user: AdminIdentity }
  | { status: "unauthenticated"; user: null };

export function resolveAdminAccess(
  user: AdminIdentity | null,
  membership: { role?: unknown } | null,
): AdminAccess {
  if (!user) return { status: "unauthenticated", user: null };
  if (membership?.role === "admin") {
    return { status: "authorized", user, role: "admin" };
  }
  return { status: "forbidden", user };
}

export function adminAccessHttpStatus(access: AdminAccess) {
  if (access.status === "unauthenticated") return 401;
  if (access.status === "forbidden") return 403;
  return 200;
}
