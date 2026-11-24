// 읽기 전용 anon 클라이언트 (RLS: announcements/categories SELECT만 허용)
// 실제 사용 시점까지 초기화를 지연: 환경변수 없이도(mock 모드) import가 가능해야 함
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
let cachedClient: SupabaseClient | null = null;

function readEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase 환경변수(NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)가 없습니다. " +
        ".env.local에 키를 설정하거나 NEXT_PUBLIC_USE_MOCK=true로 목업 모드를 사용하세요."
    );
  }
  return { url, key };
}

function getClient(): SupabaseClient {
  if (!client) {
    const { url, key } = readEnv();
    client = createClient(url, key, {
      auth: { persistSession: false },
      // Next.js 14는 서버측 GET fetch를 기본 캐시함 → DB 조회가 낡은 결과를 돌려주는 것 방지
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
    });
  }
  return client;
}

// ISR 페이지(공고 상세·사이트맵)용: 결과를 1시간 캐시한다. no-store를 쓰면
// Next.js가 페이지를 동적으로 바꿔 버려 캐시 페이지에서 오류가 난다.
function getCachedClient(): SupabaseClient {
  if (!cachedClient) {
    const { url, key } = readEnv();
    cachedClient = createClient(url, key, {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, next: { revalidate: 3600 } }),
      },
    });
  }
  return cachedClient;
}

function lazyClient(get: () => SupabaseClient): SupabaseClient {
  return new Proxy({} as SupabaseClient, {
    get(_target, prop) {
      const c = get();
      const value = Reflect.get(c, prop, c);
      return typeof value === "function" ? value.bind(c) : value;
    },
  });
}

export const supabaseAnon: SupabaseClient = lazyClient(getClient);
export const supabaseAnonCached: SupabaseClient = lazyClient(getCachedClient);
