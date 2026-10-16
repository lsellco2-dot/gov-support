import assert from "node:assert/strict";
import test from "node:test";
import { listAnnouncements, normalizeAudience } from "./announcements";
import { ageEligibility, matchesAge, normalizeAge } from "./age";
import { keywordFilters, matchesTerms, normalizeSupportTopic, searchTerms, topicKeywords } from "./discovery";
import { canonicalPageUrl } from "./pagination";
import { readWithTimeoutRetry } from "./read-retry";

test("사무실 지원 검색으로 입주기업과 창업보육 공고를 찾는다", () => {
  for (const value of ["사무실", "사무실 지원", "입주 공간", "창업공간"]) {
    assert.equal(matchesTerms("마포비즈니스센터 신규입주기업 모집", searchTerms(value)), true);
    assert.equal(matchesTerms("국립대학교 창업보육센터 모집", searchTerms(value)), true);
    assert.equal(matchesTerms("청년 월세 지원", searchTerms(value)), false);
  }
  assert.deepEqual(searchTerms("스마트공장"), ["스마트공장"]);
});

test("복지와 공익 지원 목적을 독립적으로 검색한다", () => {
  assert.equal(matchesTerms("한부모 가정 돌봄 지원", topicKeywords("welfare")), true);
  assert.equal(matchesTerms("비영리 민간단체 활동 지원", topicKeywords("public-interest")), true);
  assert.equal(normalizeSupportTopic("arbitrary"), undefined);
  assert.equal(matchesTerms("노숙인 복지단체 활동 공간 지원", topicKeywords("workspace")), true);
  assert.equal(matchesTerms("성인 평생학습 프로그램", topicKeywords("education")), true);
  assert.equal(matchesTerms("주민 테니스 동호회 활동 지원", topicKeywords("sports-culture")), true);
  assert.equal(normalizeAudience("community"), "community");
  assert.equal(normalizeAudience("nonprofit"), "nonprofit");
  assert.equal(normalizeAudience("arbitrary"), "all");
});

test("다중 검색어는 필드별 단일 패턴으로 묶고 정규식 문자를 이스케이프한다", () => {
  const filters = keywordFilters(["입주기업", "AI+R&D", "a.b"], ["title", "summary"]);
  assert.equal(filters.length, 2);
  const regex = new RegExp(JSON.parse(filters[0].slice("title.imatch.".length)), "i");
  assert.equal(regex.test("AI+R&D 지원"), true);
  assert.equal(regex.test("aXb"), false);
});

test("50세는 명시된 39세 상한에서 제외되고 중장년·연령무관 공고는 유지한다", () => {
  for (const target of ["만 19~39세 청년", "19세 이상 39세 이하", "만39세 이하 취업준비생", "40세 미만"]) {
    assert.equal(ageEligibility({ target }, 50), "conflict", target);
  }
  for (const target of ["만 40~65세 구직자", "만 50세 이상", "연령 제한 없음"]) {
    assert.equal(ageEligibility({ target }, 50), "match", target);
  }
  assert.equal(ageEligibility({ age_min: 19, age_max: 39 }, 39), "match");
  assert.equal(ageEligibility({ age_min: 19, age_max: 39 }, 40), "conflict");
  assert.equal(ageEligibility({ target: "50세 초과" }, 50), "conflict");
  assert.equal(ageEligibility({ target: "만 19세 이상 50세 미만 구직자" }, 50), "conflict");
});

test("불명·우대·복수범위·단체 수혜자 연령은 신청자 제한으로 단정하지 않는다", () => {
  for (const target of ["청년", "구직자", "청년 39세 이하 우대", "39세 이하 또는 50세 이상", "19~39세, 50~65세", "청년 19~39세를 지원하는 비영리단체", "근로자 50세 이상 자녀"]) {
    assert.equal(ageEligibility({ target }, 50), "unknown", target);
    assert.equal(matchesAge({ target }, 50, true), false);
    assert.equal(matchesAge({ target }, 50, false), true);
  }
  assert.equal(ageEligibility({ age_min: 60, age_max: 39 }, 50), "unknown");
  for (const input of ["", "abc", -1, 121, 50.5, null, true]) assert.equal(normalizeAge(input), undefined);
  assert.equal(normalizeAge("50"), 50);
});

test("실제 원천의 0세 미입력 상한과 서로 다른 연령 문구를 무제한으로 해석하지 않는다", () => {
  assert.equal(ageEligibility({ age_min: 18, age_max: null, target: "만 18세~0세\n소득 무관" }, 50), "unknown");
  assert.equal(matchesAge({ age_min: 18, age_max: null, target: "만 18세~0세" }, 50, true), false);
  assert.equal(ageEligibility({ age_max: 50, target: "만 0세~50세\n18세 이상 50세 미만" }, 50), "unknown");
  assert.equal(ageEligibility({ age_min: 18, age_max: 50, target: "18세 이상 50세 미만" }, 50), "conflict");
  assert.equal(ageEligibility({ age_min: 18, age_max: 64, target: "만 18세~64세" }, 50), "match");
});

test("범위를 벗어난 페이지 보정 시 지역과 지원 목적, 검색 조건을 유지한다", () => {
  for (const path of ["/announcements", "/app/announcements"]) {
    const params = { region: "경북", topic: "workspace", q: "입주", age: "50", ageKnownOnly: "1", audience: "nonprofit", sort: "latest", status: "open", page: "20" };
    const url = new URL(canonicalPageUrl(path, params, 3, 25, 10)!, "https://example.test");
    assert.equal(url.pathname, path);
    assert.equal(url.searchParams.get("page"), "3");
    for (const [key, value] of Object.entries(params).filter(([key]) => key !== "page")) {
      assert.equal(url.searchParams.get(key), value);
    }
    assert.equal(canonicalPageUrl(path, { ...params, page: "2" }, 2, 25, 10), null);
  }
});

test("연령을 모든 후보에 적용한 뒤 페이지와 총 건수를 계산한다", async (t) => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-public-key";
  const offsets: number[] = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (!url.pathname.endsWith("/announcements_public")) return new Response("[]");
    if (url.searchParams.has("id")) {
      assert.ok(url.searchParams.get("select")!.includes("summary"));
      const ids = url.searchParams.get("id")!.slice(4, -1).split(",").map(Number);
      return new Response(JSON.stringify(ids.reverse().map(id => ({ id, title: "교육 모집", target: "만 40~65세 구직자" }))));
    }
    assert.equal(url.searchParams.get("select"), "id,target,age_min,age_max");
    assert.ok(url.searchParams.getAll("or").some(value => value.includes("age_min.not.is.null")));
    const offset = Number(url.searchParams.get("offset"));
    offsets.push(offset);
    const length = Math.min(1000, 1025 - offset);
    return new Response(JSON.stringify(Array.from({ length }, (_, index) => ({
      id: offset + index + 1, source_id: 2, title: "교육 모집", organization: "센터", region: "서울", category_ids: [8],
      target: offset + index < 1000 ? "만 19~39세 구직자" : "만 40~65세 구직자",
      summary: "교육", support_type: "교육", status: "open", created_at: "2026-10-15",
    }))), { status: 206, headers: { "content-range": `${offset}-${offset + length - 1}/1025` } });
  });
  const result = await listAnnouncements({ age: 50, ageKnownOnly: true, page: 2 });
  assert.equal(result.total, 25);
  assert.equal(result.items.length, 10);
  assert.equal(result.items[0].id, 1011);
  assert.deepEqual(offsets, [0, 1000]);
});

test("조회 제한시간 초과만 한 번 재시도하며 영구 오류는 반복하지 않는다", async () => {
  let calls = 0;
  const recovered = await readWithTimeoutRetry(async () => {
    calls++;
    return { error: calls === 1 ? { code: "57014" } : null, data: [1] };
  });
  assert.equal(calls, 2);
  assert.equal(recovered.error, null);
  calls = 0;
  await readWithTimeoutRetry(async () => { calls++; return { error: { code: "57014" } }; });
  assert.equal(calls, 2);
  calls = 0;
  await readWithTimeoutRetry(async () => { calls++; return { error: { code: "42501" } }; });
  assert.equal(calls, 1);
});

test("DB 2페이지 요청과 timeout 재시도에 모든 필터와 정렬을 유지한다", async (t) => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-public-key";
  const requests: URL[] = [];
  let first = true;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/announcements_public")) {
      requests.push(url);
      if (first) {
        first = false;
        return new Response(JSON.stringify({ code: "57014", message: "canceling statement due to statement timeout" }), { status: 500 });
      }
      const offset = Number(url.searchParams.get("offset"));
      return new Response(JSON.stringify(Array.from({ length: 10 }, (_, index) => ({
        id: offset + index + 1, source_id: 2, title: "입주기업 모집", organization: "센터",
        region: "서울", category_ids: [1], target: "기업", support_type: "공간", summary: "입주 지원",
        apply_start: null, apply_end: null, detail_url: null, status: "open", created_at: "2026-10-15",
      }))), { status: 206, headers: { "content-range": `${offset}-${offset + 9}/30` } });
    }
    return new Response("[]", { status: 200 });
  });
  const params = { q: "사무실", audience: "business" as const, topic: "workspace", region: "서울", category: 1, status: "open" as const, sort: "latest" as const };
  const page1 = await listAnnouncements({ ...params, page: 1 });
  const page2 = await listAnnouncements({ ...params, page: 2 });
  assert.equal(page2.page, 2);
  assert.equal(page2.total, 30);
  assert.equal(page2.items.length, 10);
  assert.equal(page2.items.some((row) => page1.items.some((other) => other.id === row.id)), false);
  assert.equal(requests[0].search, requests[1].search);
  const second = requests[2].searchParams;
  assert.equal(second.get("offset"), "10");
  assert.equal(second.get("limit"), "10");
  assert.equal(second.get("status"), "eq.open");
  assert.equal(second.get("category_ids"), "cs.{1}");
  assert.equal(second.get("order"), "created_at.desc,id.desc");
  const filters = second.getAll("or");
  assert.equal(filters.length, 4);
  assert.ok(filters.some((value) => value.includes("입주기업")));
  assert.ok(filters.some((value) => value.includes('"서울"')));
  await listAnnouncements({ audience: "community", topic: "sports-culture" });
  const communityFilter = requests.at(-1)!.searchParams.getAll("or").find((value) => value.includes("주민모임"))!;
  assert.ok(communityFilter.includes("target.ilike"));
  assert.equal(communityFilter.includes("organization.ilike"), false);
  assert.equal(communityFilter.includes("summary.ilike"), false);
});
