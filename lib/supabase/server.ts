// 서버 전용: service_role 클라이언트 (수집/leads/events 쓰기)
// 이 파일을 클라이언트 컴포넌트에서 import하면 안 됩니다.
// 실제 사용 시점까지 초기화를 지연: 환경변수 없이도(mock 모드) import가 가능해야 함
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Supabase 환경변수(NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)가 없습니다. " +
          ".env.local에 키를 설정하세요."
      );
    }
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getClient();
    const value = Reflect.get(c, prop, c);
    return typeof value === "function" ? value.bind(c) : value;
  },
});
