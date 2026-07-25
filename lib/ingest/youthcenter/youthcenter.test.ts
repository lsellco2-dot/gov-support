import assert from "node:assert/strict";
import test from "node:test";
import { buildYouthCenterPolicyDetailUrl } from "@/lib/youthcenter/url";
import {
  parseYouthCenterXmlPage,
  requireYouthCenterApiKey,
} from "./client";
import {
  mapYouthCenterPolicy,
  normalizeApplicationPeriod,
  normalizePolicyDomain,
  normalizeYouthSourceStatus,
} from "./mapper";

test("current XML fields are parsed and mapped without exposing credentials", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <response>
      <totalCount>1</totalCount>
      <items>
        <item>
          <plcyNo>R202607250001</plcyNo>
          <plcyNm><![CDATA[서울 청년 면접비 지원]]></plcyNm>
          <plcyExplnCn>청년 구직자의 면접 교통비를 지원합니다.</plcyExplnCn>
          <plcySprtCn>면접 1회당 교통비 지원</plcySprtCn>
          <lclsfNm>일자리</lclsfNm>
          <mclsfNm>취업</mclsfNm>
          <pvsnInstGroupCd>0054002</pvsnInstGroupCd>
          <zipCd>11000</zipCd>
          <sprvsnInstCdNm>서울특별시</sprvsnInstCdNm>
          <operInstCdNm>서울청년센터</operInstCdNm>
          <aplyYmd>2026-07-01 ~ 2026-08-31</aplyYmd>
          <aplyUrlAddr>https://example.go.kr/apply</aplyUrlAddr>
          <sprtTrgtMinAge>19</sprtTrgtMinAge>
          <sprtTrgtMaxAge>39</sprtTrgtMaxAge>
          <schoolCd>0049010</schoolCd>
          <jobCd>0013003</jobCd>
          <lastMdfcnDt>2026-07-24 09:30:00</lastMdfcnDt>
        </item>
      </items>
    </response>`;
  const page = parseYouthCenterXmlPage(xml);
  assert.equal(page.total, 1);
  assert.equal(page.records.length, 1);

  const result = mapYouthCenterPolicy(
    page.records[0],
    new Date("2026-07-25T00:00:00Z"),
  );
  assert.equal(result.error, null);
  assert.equal(result.policy?.sourceExternalId, "R202607250001");
  assert.equal(result.policy?.region, "서울");
  assert.equal(result.policy?.policyDomain, "employment_startup");
  assert.equal(result.policy?.status, "open");
  assert.equal(result.policy?.sourceStatus, "open");
  assert.equal(result.policy?.included, true);
  assert.equal(
    result.policy?.originalUrl,
    "https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch/ythPlcyDetail/R202607250001",
  );
});

test("official policy URLs are generated only for safe policy IDs", () => {
  assert.equal(
    buildYouthCenterPolicyDetailUrl(" 20260725005400000001 "),
    "https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch/ythPlcyDetail/20260725005400000001",
  );
  assert.equal(buildYouthCenterPolicyDetailUrl("../unsafe"), null);
  assert.equal(buildYouthCenterPolicyDetailUrl(""), null);
});

test("legacy XML aliases and regional codes are supported", () => {
  const xml = `<youthPolicyList>
    <youthPolicy>
      <bizId>POLICY-1</bizId>
      <polyBizSjnm>청년 월세 지원</polyBizSjnm>
      <polyItcnCn>청년의 주거비 부담 완화</polyItcnCn>
      <sporCn>월세 비용 지원</sporCn>
      <polyRlmCd>023020</polyRlmCd>
      <polyBizSecd>003002001</polyBizSecd>
      <rqutPrdCn>20260701 ~ 20260831</rqutPrdCn>
      <rqutUrla>https://example.go.kr/youth</rqutUrla>
    </youthPolicy>
  </youthPolicyList>`;
  const page = parseYouthCenterXmlPage(xml);
  const result = mapYouthCenterPolicy(page.records[0]);
  assert.equal(result.policy?.region, "서울");
  assert.equal(result.policy?.policyDomain, "housing");
  assert.equal(result.policy?.applyStart, "2026-07-01");
  assert.equal(result.policy?.applyEnd, "2026-08-31");
});

test("integrated Gwangju-Jeonnam policy region codes use the new standard", () => {
  const integrated = mapYouthCenterPolicy({
    plcyNo: "REGION-1",
    plcyNm: "통합특별시 청년 지원",
    plcyExplnCn: "청년 지원 정책",
    plcySprtCn: "지원금 신청",
    lclsfNm: "복지",
    zipCd: "12190",
    aplyYmd: "상시 모집",
  });
  assert.equal(integrated.policy?.region, "전남광주통합특별시");
  assert.deepEqual(integrated.policy?.regions, ["전남광주통합특별시"]);

  const alias = mapYouthCenterPolicy({
    plcyNo: "REGION-2",
    plcyNm: "통합특별시 청년 교육",
    plcyExplnCn: "청년 교육 정책",
    plcySprtCn: "교육비 신청",
    lclsfNm: "교육",
    polyBizSecd: "광주전남통합특별시",
    aplyYmd: "상시 모집",
  });
  assert.equal(alias.policy?.region, "전남광주통합특별시");
});

test("ongoing and invalid dates are not replaced with today", () => {
  const ongoing = normalizeApplicationPeriod("상시 모집", "0057002");
  assert.equal(ongoing.mode, "ongoing");
  assert.equal(ongoing.start, null);
  assert.equal(ongoing.end, null);

  const invalid = normalizeApplicationPeriod("2026-02-31 ~ 2026-13-01", null);
  assert.equal(invalid.start, null);
  assert.equal(invalid.end, null);
  assert.equal(invalid.parseFailed, true);
});

test("domain normalization follows the internal policy domain values", () => {
  assert.equal(normalizePolicyDomain("교육", null), "education_training");
  assert.equal(normalizePolicyDomain("복지문화", null), "finance_welfare_culture");
  assert.equal(normalizePolicyDomain(null, "023050"), "participation_infrastructure");
  assert.equal(normalizePolicyDomain(null, null), "unknown");
});

test("source status normalizes API date states", () => {
  assert.equal(normalizeYouthSourceStatus("open", "fixed"), "open");
  assert.equal(normalizeYouthSourceStatus("upcoming", "fixed"), "upcoming");
  assert.equal(normalizeYouthSourceStatus("ongoing", "ongoing"), "always");
  assert.equal(
    normalizeYouthSourceStatus("unknown", "until_budget_exhausted"),
    "always",
  );
  assert.equal(normalizeYouthSourceStatus("closed", "unknown"), "closed");
  assert.equal(normalizeYouthSourceStatus("unknown", "unknown"), "unknown");
});

test("missing API key returns a safe explicit error", () => {
  assert.throws(
    () => requireYouthCenterApiKey(undefined),
    /YOUTHCENTER_API_KEY 환경변수가 없습니다/,
  );
});
