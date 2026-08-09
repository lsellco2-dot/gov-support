import "server-only";

import { notFound, redirect } from "next/navigation";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import {
  resolveAdminAccess,
  type AdminAccess,
  type AdminIdentity,
} from "@/lib/admin/auth-policy";

export async function getCurrentAdminAccess(): Promise<AdminAccess> {
  const supabase = createAuthServerClient();
  if (!supabase) return resolveAdminAccess(null, null);

  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims || typeof claims.sub !== "string") {
    return resolveAdminAccess(null, null);
  }

  const metadata = claims.user_metadata as
    | { full_name?: unknown; name?: unknown }
    | undefined;
  const appMetadata = claims.app_metadata as
    | { provider?: unknown }
    | undefined;
  const user: AdminIdentity = {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    displayName:
      displayString(metadata?.full_name) ?? displayString(metadata?.name),
    provider: displayString(appMetadata?.provider),
  };

  const { data: membership, error: membershipError } = await supabase
    .from("admin_users")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (membershipError) {
    console.error("admin authorization lookup failed");
    return resolveAdminAccess(user, null);
  }
  return resolveAdminAccess(user, membership);
}

export async function requireAdminPage(loginNext = "/admin") {
  const access = await getCurrentAdminAccess();
  if (access.status === "unauthenticated") {
    redirect(`/?login=required&next=${encodeURIComponent(loginNext)}`);
  }
  if (access.status === "forbidden") notFound();
  return access;
}

function displayString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
