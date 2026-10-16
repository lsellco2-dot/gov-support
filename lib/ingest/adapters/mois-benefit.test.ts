import assert from "node:assert/strict";
import test from "node:test";
import { moisBenefit } from "./mois-benefit";

for (const [title, userType, target] of [
  ["저소득 가구 생계비 지원", "개인", "기초생활수급자"],
  ["비영리단체 공익활동 지원", "단체", "지역 비영리 민간단체"],
  ["소상공인 창업 지원", "기업", "소상공인"],
]) {
  test(`정부24 수집 대상 유지: ${title}`, () => {
    const result = moisBenefit.normalize({ 서비스명: title, 서비스ID: "fixture", 사용자구분: userType, 지원대상: target, 소관기관명: "서울특별시", 신청기한: "상시신청" });
    assert.ok(result);
    assert.equal(result.title, title);
    assert.equal(result.target, target);
    assert.equal(result.sourceCode, "mois");
    assert.equal(result.region, "서울");
  });
}

test("서비스명이 없는 잘못된 정부24 자료는 받지 않는다", () => {
  assert.equal(moisBenefit.normalize({ 서비스ID: "fixture" }), null);
});

test("정부24 경기도 광주시를 광주광역시와 구분한다", () => {
  const item = moisBenefit.normalize({ 서비스명: "평생교육 지원", 서비스ID: "fixture", 소관기관명: "경기도 광주시" });
  assert.equal(item?.region, "경기");
});

test("정부24 전체 페이지를 읽고 2,000건 이후도 버리지 않는다", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (input: string) => {
    calls++;
    const url = new URL(input);
    const page = Number(url.searchParams.get("page"));
    assert.equal(url.searchParams.get("perPage"), "500");
    const count = page === 5 ? 1 : 500;
    return new Response(JSON.stringify({ totalCount: 2001, data: Array.from({ length: count }, (_, i) => ({ 서비스ID: `${page}-${i}` })) }));
  });
  let received = 0;
  for await (const page of moisBenefit.fetchPages({ serviceKey: "fixture" })) received += page.length;
  assert.equal(received, 2001);
  assert.equal(calls, 5);
});

test("정부24 짧은 중간 페이지에도 totalCount까지 진행한다", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return new Response(JSON.stringify({ totalCount: 2, data: [{ 서비스ID: String(calls) }] }));
  });
  for await (const _ of moisBenefit.fetchPages({ serviceKey: "fixture" })) { /* consume */ }
  assert.equal(calls, 2);
});

test("정부24 반복 페이지는 성공으로 종료하지 않는다", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ totalCount: 2, data: [{ 서비스ID: "same" }] })));
  await assert.rejects(async () => {
    for await (const _ of moisBenefit.fetchPages({ serviceKey: "fixture" })) { /* consume */ }
  }, /DUPLICATE/);
});

test("정부24 상세 API 필드와 교육 분류를 보존한다", () => {
  const item = moisBenefit.normalize({ 서비스ID: "test", 서비스명: "교육 지원", 서비스분야: "보육·교육", 서비스목적요약: "학비 지원", 지원내용: "수업료 지원", 선정기준: "소득 확인", 신청방법: "방문신청", 전화문의: "공식 문의처" });
  assert.match(item?.summary ?? "", /교육/);
  assert.match(item?.detail?.detailContent ?? "", /수업료 지원/);
  assert.match(item?.detail?.detailContent ?? "", /소득 확인/);
  assert.equal(item?.detail?.applyMethod, "방문신청");
});
