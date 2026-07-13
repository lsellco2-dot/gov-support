import test from "node:test";
import assert from "node:assert/strict";
import { inferBizinfoRegion } from "./bizinfo-region";

const empty = { title: null, target: null, summary: null };

test("accepts only explicit nationwide eligibility", () => {
  const result = inferBizinfoRegion({
    ...empty,
    summary: "전국의 중견ㆍ중소기업 지원(지역 제한 없음)",
  });
  assert.equal(result.region, "전국");
  assert.equal(result.reason, "nationwide");
});

test("does not treat 전국권 as nationwide eligibility", () => {
  const result = inferBizinfoRegion({
    ...empty,
    summary: "최근 6개월간 지상파 전국권 방송광고 집행이 없는 기업",
  });
  assert.equal(result.region, "미확인");
});

test("uses explicit target region before weaker fields", () => {
  const result = inferBizinfoRegion({
    title: "기업 지원사업",
    target: "경상북도에 사업장을 둔 중소기업",
    summary: null,
  });
  assert.equal(result.region, "경북");
  assert.equal(result.evidenceField, "target");
});

test("maps title municipalities to their province", () => {
  for (const [municipality, expected] of [
    ["청송군", "경북"],
    ["밀양시", "경남"],
    ["강릉시", "강원"],
    ["수원시", "경기"],
  ]) {
    const result = inferBizinfoRegion({
      ...empty,
      title: `2026년 ${municipality} 중소기업 지원사업 공고`,
    });
    assert.equal(result.region, expected);
  }
});

test("distinguishes Gyeonggi Gwangju from Gwangju Metropolitan City", () => {
  assert.equal(
    inferBizinfoRegion({ ...empty, title: "광주시 중소기업 지원사업 공고" }).region,
    "경기"
  );
  assert.equal(
    inferBizinfoRegion({ ...empty, title: "[광주] 광주광역시 기업 지원사업" }).region,
    "광주"
  );
  assert.equal(
    inferBizinfoRegion({
      title: "[광주] 임산부 지원사업",
      target: null,
      summary: "광주광역시 소재 사업장으로 공고일 현재 광주시 소재 기업",
    }).region,
    "광주"
  );
});

test("does not treat the common word 경기 as Gyeonggi Province", () => {
  const result = inferBizinfoRegion({
    ...empty,
    summary: "경기침체로 어려움을 겪는 중소기업을 지원합니다.",
  });
  assert.equal(result.region, "미확인");
});

test("uses title context for a relative 도내 eligibility phrase", () => {
  const result = inferBizinfoRegion({
    title: "[충북] 소상공인 육성자금 지원계획",
    target: "소상공인",
    summary: null,
    detailContent: "사업개요 및 지원대상 ☞ 도내 사업장을 둔 소상공인 사업신청 방법 방문 접수",
  });
  assert.equal(result.region, "충북");
  assert.equal(result.evidenceField, "detail_content");
});

test("ignores contact and reception addresses", () => {
  const result = inferBizinfoRegion({
    ...empty,
    detailContent: "사업개요 장비를 지원합니다. 사업신청 방법 접수처: 경기신용보증재단 부천지점 문의처 031-000-0000",
  });
  assert.equal(result.region, "미확인");
});

test("does not use organization-only evidence", () => {
  const result = inferBizinfoRegion({
    ...empty,
    title: "중소기업 경영개선 지원사업",
    summary: "경영 개선 비용을 지원합니다.",
  });
  assert.equal(result.region, "미확인");
});

test("marks local and nationwide mixed eligibility as unknown", () => {
  const result = inferBizinfoRegion({
    ...empty,
    summary: "경상북도 소재 제조기업과 전국 소재 협력기업의 컨소시엄을 지원합니다.",
  });
  assert.equal(result.region, "미확인");
  assert.equal(result.reason, "conflict_or_multiple");
});

test("marks conflicting local regions as unknown", () => {
  const result = inferBizinfoRegion({
    title: "[대구] 기업 지원사업",
    target: null,
    summary: "경상북도 소재 중소기업을 지원합니다.",
  });
  assert.equal(result.region, "미확인");
  assert.deepEqual(new Set(result.candidates), new Set(["대구", "경북"]));
});
