import assert from "node:assert/strict";
import test from "node:test";
import {
  buildYouthCenterSyncPlan,
  resolvePublicAnnouncementStatus,
  toYouthCenterAnnouncementRow,
} from "./store";
import { analyzeYouthCenterDuplicates } from "./dedup";
import type {
  ExistingAnnouncementForDedup,
  YouthCenterPolicy,
} from "./types";

test("region storage follows nationwide, single, multiple, and unknown rules", () => {
  const now = new Date("2026-07-25T00:00:00.000Z");

  const nationwide = toYouthCenterAnnouncementRow(
    policy({ regionResolution: "nationwide", region: "전국", regions: ["전국"] }),
    42,
    now,
  );
  assert.equal(nationwide.region, "전국");
  assert.deepEqual(nationwide.regions, ["전국"]);

  const single = toYouthCenterAnnouncementRow(
    policy({ regionResolution: "single", region: "서울", regions: ["서울"] }),
    42,
    now,
  );
  assert.equal(single.region, "서울");
  assert.deepEqual(single.regions, ["서울"]);

  const multiple = toYouthCenterAnnouncementRow(
    policy({
      regionResolution: "multiple",
      region: null,
      regions: ["서울", "경기"],
    }),
    42,
    now,
  );
  assert.equal(multiple.region, null);
  assert.deepEqual(multiple.regions, ["서울", "경기"]);

  const unknown = toYouthCenterAnnouncementRow(
    policy({ regionResolution: "unknown", region: null, regions: [] }),
    42,
    now,
  );
  assert.equal(unknown.region, null);
  assert.equal(unknown.regions, null);
});

test("application URL is preferred and raw plus normalized data are retained", () => {
  const row = toYouthCenterAnnouncementRow(
    policy({
      applicationUrl: "https://example.com/apply",
      originalUrl: "https://example.com/reference",
    }),
    42,
    new Date("2026-07-25T00:00:00.000Z"),
  );
  assert.equal(row.detail_url, "https://example.com/apply");
  assert.equal(row.source_key, "P-1");
  assert.equal(row.raw_json.provider, "youthcenter");
  assert.equal(row.source_status, "open");
  assert.deepEqual(row.raw_json.original, { plcyNo: "P-1" });
  assert.equal(
    (row.raw_json.normalized as Record<string, unknown>).sourceExternalId,
    "P-1",
  );
});

test("sync plan upserts only active policies and updates all known closed rows", () => {
  const active = policy({ sourceExternalId: "ACTIVE", included: true });
  const closed = policy({
    sourceExternalId: "CLOSED",
    included: false,
    status: "closed",
    sourceStatus: "closed",
    applyEnd: "2026-07-20",
  });
  const closedWithoutEnd = policy({
    sourceExternalId: "NO-END",
    included: false,
    status: "closed",
    sourceStatus: "closed",
    applyEnd: null,
  });
  const newClosed = policy({
    sourceExternalId: "NEW-CLOSED",
    included: false,
    status: "closed",
    sourceStatus: "closed",
    applyEnd: "2026-07-20",
  });

  const plan = buildYouthCenterSyncPlan(
    [active, closed, closedWithoutEnd, newClosed],
    [
      { sourceKey: "CLOSED", applyStart: null, applyEnd: null },
      { sourceKey: "NO-END", applyStart: null, applyEnd: null },
      { sourceKey: "DISAPPEARED", applyStart: null, applyEnd: null },
    ],
    42,
    new Date("2026-07-25T00:00:00.000Z"),
  );

  assert.deepEqual(
    plan.activeUpserts.map((row) => row.source_key),
    ["ACTIVE"],
  );
  assert.deepEqual(
    plan.closedUpdates.map((row) => row.sourceKey),
    ["CLOSED", "NO-END"],
  );
  assert.equal(plan.closedUpdates[1].values.apply_end, null);
  assert.equal(plan.closedUpdates[1].values.source_status, "closed");
  assert.deepEqual(plan.closedWithoutEndDate, ["NO-END"]);
  assert.equal(plan.absentExistingRowsUntouched, 1);
});

test("an always policy can transition to closed without an end date", () => {
  const always = toYouthCenterAnnouncementRow(
    policy({
      sourceExternalId: "ALWAYS",
      applyStart: null,
      applyEnd: null,
      dateMode: "ongoing",
      status: "ongoing",
      sourceStatus: "always",
    }),
    42,
  );
  assert.equal(always.source_status, "always");

  const plan = buildYouthCenterSyncPlan(
    [
      policy({
        sourceExternalId: "ALWAYS",
        included: false,
        applyStart: null,
        applyEnd: null,
        status: "closed",
        sourceStatus: "closed",
      }),
    ],
    [{ sourceKey: "ALWAYS", applyStart: null, applyEnd: null }],
    42,
  );
  assert.equal(plan.closedUpdates.length, 1);
  assert.equal(plan.closedUpdates[0].values.source_status, "closed");
});

test("public status uses source status only for youthcenter", () => {
  assert.equal(
    resolvePublicAnnouncementStatus({
      sourceCode: "youthcenter",
      sourceStatus: "closed",
      applyEnd: null,
      today: "2026-07-25",
    }),
    "closed",
  );
  assert.equal(
    resolvePublicAnnouncementStatus({
      sourceCode: "youthcenter",
      sourceStatus: "always",
      applyEnd: null,
      today: "2026-07-25",
    }),
    "open",
  );
  assert.equal(
    resolvePublicAnnouncementStatus({
      sourceCode: "youthcenter",
      sourceStatus: "upcoming",
      applyEnd: "2026-08-01",
      today: "2026-07-25",
    }),
    "upcoming",
  );
  assert.equal(
    resolvePublicAnnouncementStatus({
      sourceCode: "bizinfo",
      sourceStatus: "closed",
      applyEnd: null,
      today: "2026-07-25",
    }),
    "open",
  );
  assert.equal(
    resolvePublicAnnouncementStatus({
      sourceCode: "kstartup",
      sourceStatus: "open",
      applyEnd: "2026-07-20",
      today: "2026-07-25",
    }),
    "closed",
  );
});

test("duplicate analysis excludes only the same youthcenter source key", () => {
  const input = policy();
  assert.equal(
    analyzeYouthCenterDuplicates(
      [input],
      [existingAnnouncement({ sourceCode: "youthcenter", sourceKey: "P-1" })],
    ).strongCount,
    0,
  );
  assert.equal(
    analyzeYouthCenterDuplicates(
      [input],
      [
        existingAnnouncement({
          sourceCode: "youthcenter",
          sourceKey: "OTHER",
        }),
      ],
    ).strongCount,
    1,
  );
  assert.equal(
    analyzeYouthCenterDuplicates(
      [input],
      [existingAnnouncement({ sourceCode: "bizinfo", sourceKey: "P-1" })],
    ).strongCount,
    1,
  );
});

function existingAnnouncement(
  overrides: Partial<ExistingAnnouncementForDedup> = {},
): ExistingAnnouncementForDedup {
  return {
    id: 1,
    sourceId: 6,
    sourceCode: "youthcenter",
    sourceKey: "P-1",
    title: "서울 청년 면접비 지원",
    organization: "서울특별시",
    region: "서울",
    target: "만 19세~39세",
    supportType: "일자리·취업·창업",
    summary: "청년 구직자에게 면접비를 지원합니다.",
    applyStart: "2026-07-01",
    applyEnd: "2026-08-31",
    ...overrides,
  };
}

function policy(
  overrides: Partial<YouthCenterPolicy> = {},
): YouthCenterPolicy {
  return {
    sourceExternalId: "P-1",
    title: "서울 청년 면접비 지원",
    summary: "청년 구직자에게 면접비를 지원합니다.",
    detailContent: "신청 가능한 청년 지원 정책입니다.",
    organization: "서울특별시",
    managingOrganization: "서울청년센터",
    region: "서울",
    regions: ["서울"],
    regionResolution: "single",
    target: "만 19세~39세",
    supportType: "일자리·취업·창업",
    applyStart: "2026-07-01",
    applyEnd: "2026-08-31",
    dateMode: "fixed",
    status: "open",
    sourceStatus: "open",
    originalUrl: "https://example.com/reference",
    applicationUrl: null,
    ageMin: 19,
    ageMax: 39,
    incomeCondition: null,
    educationCondition: null,
    employmentCondition: "미취업자",
    majorCondition: null,
    specialtyCondition: null,
    policyDomain: "employment_startup",
    sourceUpdatedAt: "2026-07-24T00:00:00.000Z",
    included: true,
    inclusionReason: "정책 분류와 신청·지원 내용 확인",
    raw: { plcyNo: "P-1" },
    ...overrides,
  };
}
