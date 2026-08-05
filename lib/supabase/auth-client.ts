import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/supabase/auth-config";

let authClient: SupabaseClient | null = null;

export function createAuthBrowserClient(): SupabaseClient | null {
  const config = getSupabasePublicConfig();
  if (!config) return null;

  if (!authClient) {
    authClient = createBrowserClient(config.url, config.key);
  }

  return authClient;
}
