import assert from "node:assert/strict";
import test from "node:test";
import {
  ageConditionLabel,
  announcementRegionLabel,
  detailSection,
  normalizePresentationFields,
  policyDomainLabel,
  safeExternalHttpUrl,
  youthCenterDetailFields,
} from "./announcement-presentation";

test("formats nationwide, single, multiple and unresolved policy regions", () => {
  assert.equal(announcementRegionLabel("전국", ["전국"]), "전국");
  assert.equal(announcementRegionLabel("서울", ["서울"]), "서울");
  assert.equal(
    announcementRegionLabel(null, ["서울", "경기", "인천"]),
    "서울, 경기 외 1개",
  );
  assert.equal(announcementRegionLabel(null, null), "지역 확인 필요");
  assert.equal(
    announcementRegionLabel(
      "전남광주통합특별시",
      ["전남광주통합특별시"],
    ),
    "전남광주통합특별시",
  );
});

test("formats bounded and one-sided ages while hiding sentinel values", () => {
  assert.equal(ageConditionLabel(19, 34), "만 19~34세");
  assert.equal(ageConditionLabel(19, null), "만 19세 이상");
  assert.equal(ageConditionLabel(null, 39), "만 39세 이하");
  assert.equal(ageConditionLabel(24, 24), "만 24세");
  assert.equal(ageConditionLabel(0, 999), null);
  assert.equal(ageConditionLabel(40, 20), null);
});

test("maps only known policy domains to Korean labels", () => {
  assert.equal(policyDomainLabel("employment_startup"), "취업·창업");
  assert.equal(policyDomainLabel("housing"), "주거");
  assert.equal(policyDomainLabel("education_training"), "교육·직업훈련");
  assert.equal(
    policyDomainLabel("finance_welfare_culture"),
    "금융·복지·문화",
  );
  assert.equal(
    policyDomainLabel("participation_infrastructure"),
    "참여·기반",
  );
  assert.equal(policyDomainLabel("unknown"), null);
  assert.equal(policyDomainLabel(null), null);
});

test("normalizes safe structured presentation fields", () => {
  assert.deepEqual(
    normalizePresentationFields(
      {
        regions: ["서울", " 경기 ", "서울"],
        age_min: 19,
        age_max: 39,
        policy_domain: "housing",
        source_status: "upcoming",
      },
      { code: "youthcenter", name: "온통청년" },
    ),
    {
      source_code: "youthcenter",
      source_name: "온통청년",
      regions: ["서울", "경기"],
      age_min: 19,
      age_max: 39,
      policy_domain: "housing",
      source_status: "upcoming",
    },
  );
});

test("extracts only normalized youth detail fields and uses the official source URL", () => {
  const fields = youthCenterDetailFields(
    {
      provider: "youthcenter",
      original: { openApiVlak: "must-not-leak" },
      normalized: {
        managingOrganization: "서울청년센터",
        incomeCondition: "중위소득 150% 이하",
        applicationUrl: "https://example.go.kr/apply",
        originalUrl: "javascript:alert(1)",
      },
    },
    "20260725005400000001",
  );
  assert.equal(fields.managing_organization, "서울청년센터");
  assert.equal(fields.income_condition, "중위소득 150% 이하");
  assert.equal(fields.application_url, "https://example.go.kr/apply");
  assert.equal(
    fields.original_url,
    "https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch/ythPlcyDetail/20260725005400000001",
  );
  assert.equal("original" in fields, false);
  assert.equal(safeExternalHttpUrl("data:text/plain,test"), null);
});

test("extracts named youth policy sections without returning adjacent sections", () => {
  const content =
    "[정책 설명]\n설명\n\n[지원 내용]\n교육비 지원\n\n[신청 방법]\n온라인 접수";
  assert.equal(detailSection(content, "지원 내용"), "교육비 지원");
  assert.equal(detailSection(content, "신청 방법"), "온라인 접수");
  assert.equal(detailSection(content, "없는 항목"), null);
});
