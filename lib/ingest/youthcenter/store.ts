import { supabaseAdmin } from "@/lib/supabase/server";
import { sanitizeDisplayText } from "@/lib/text/sanitize";
import { mapCategories } from "../category";
import { contentHash } from "../hash";
import { createYouthCenterSourceFingerprint } from "./fingerprint";
import type {
  ExistingAnnouncementForDedup,
  YouthCenterPolicy,
} from "./types";

const SOURCE_CODE = "youthcenter";
const SOURCE_NAME = "온통청년";
const DB_PAGE_SIZE = 1_000;
const UPSERT_CHUNK_SIZE = 500;

export interface ExistingYouthCenterAnnouncement {
  sourceKey: string;
  applyStart: string | null;
  applyEnd: string | null;
}

export interface YouthCenterAnnouncementRow {
  source_id: number;
  source_key: string;
  title: string;
  organization: string | null;
  category_ids: number[];
  region: string | null;
  regions: string[] | null;
  target: string | null;
  support_type: string | null;
  summary: string | null;
  apply_start: string | null;
  apply_end: string | null;
  detail_url: string | null;
  detail_content: string | null;
  content_hash: string;
  raw_json: Record<string, unknown>;
  age_min: number | null;
  age_max: number | null;
  policy_domain: string | null;
  source_updated_at: string | null;
  source_status: YouthCenterPolicy["sourceStatus"];
  source_fingerprint: string;
  updated_at: string;
}

export interface YouthCenterClosedUpdate {
  sourceKey: string;
  values: Omit<YouthCenterAnnouncementRow, "source_id" | "source_key">;
}

export interface YouthCenterSyncPlan {
  activeUpserts: YouthCenterAnnouncementRow[];
  closedUpdates: YouthCenterClosedUpdate[];
  closedWithoutEndDate: string[];
  absentExistingRowsUntouched: number;
}

export interface YouthCenterStoreResult {
  sourceCreated: boolean;
  activeUpserted: number;
  closedUpdated: number;
  closedWithoutEndDate: number;
  absentExistingRowsUntouched: number;
  writeRequests: number;
}

export function buildYouthCenterSyncPlan(
  policies: YouthCenterPolicy[],
  existingRows: ExistingYouthCenterAnnouncement[],
  sourceId: number,
  now = new Date(),
): YouthCenterSyncPlan {
  const existingByKey = new Map(
    existingRows.map((row) => [row.sourceKey, row]),
  );
  const fetchedKeys = new Set(policies.map((policy) => policy.sourceExternalId));
  const activeUpserts = policies
    .filter((policy) => policy.included)
    .map((policy) => toYouthCenterAnnouncementRow(policy, sourceId, now));
  const closedUpdates: YouthCenterClosedUpdate[] = [];
  const closedWithoutEndDate: string[] = [];

  for (const policy of policies) {
    if (
      policy.sourceStatus !== "closed" ||
      !existingByKey.has(policy.sourceExternalId)
    ) {
      continue;
    }

    if (!policy.applyEnd) {
      closedWithoutEndDate.push(policy.sourceExternalId);
    }

    const row = toYouthCenterAnnouncementRow(policy, sourceId, now);
    const { source_id: _sourceId, source_key: sourceKey, ...values } = row;
    closedUpdates.push({ sourceKey, values });
  }

  return {
    activeUpserts,
    closedUpdates,
    closedWithoutEndDate,
    absentExistingRowsUntouched: existingRows.filter(
      (row) => !fetchedKeys.has(row.sourceKey),
    ).length,
  };
}

export function toYouthCenterAnnouncementRow(
  policy: YouthCenterPolicy,
  sourceId: number,
  now = new Date(),
): YouthCenterAnnouncementRow {
  const title = sanitizeDisplayText(policy.title);
  const organization = sanitizeNullable(policy.organization);
  const target = sanitizeNullable(policy.target);
  const supportType = sanitizeNullable(policy.supportType);
  const summary = sanitizeNullable(policy.summary);
  const regionStorage = regionValues(policy);
  const normalized = {
    sourceExternalId: policy.sourceExternalId,
    title,
    summary,
    detailContent: policy.detailContent,
    organization,
    managingOrganization: policy.managingOrganization,
    region: regionStorage.region,
    regions: regionStorage.regions,
    target,
    supportType,
    applyStart: policy.applyStart,
    applyEnd: policy.applyEnd,
    dateMode: policy.dateMode,
    status: policy.status,
    sourceStatus: policy.sourceStatus,
    originalUrl: policy.originalUrl,
    applicationUrl: policy.applicationUrl,
    ageMin: policy.ageMin,
    ageMax: policy.ageMax,
    incomeCondition: policy.incomeCondition,
    educationCondition: policy.educationCondition,
    employmentCondition: policy.employmentCondition,
    majorCondition: policy.majorCondition,
    specialtyCondition: policy.specialtyCondition,
    policyDomain: policy.policyDomain,
    sourceUpdatedAt: policy.sourceUpdatedAt,
    included: policy.included,
    inclusionReason: policy.inclusionReason,
  };

  return {
    source_id: sourceId,
    source_key: policy.sourceExternalId,
    title,
    organization,
    category_ids: mapCategories({
      title,
      target,
      supportType,
      summary,
    }),
    region: regionStorage.region,
    regions: regionStorage.regions,
    target,
    support_type: supportType,
    summary,
    apply_start: policy.applyStart,
    apply_end: policy.applyEnd,
    detail_url: policy.applicationUrl ?? policy.originalUrl,
    detail_content: policy.detailContent,
    content_hash: contentHash({
      title,
      organization,
      applyEnd: policy.applyEnd,
    }),
    raw_json: {
      provider: SOURCE_CODE,
      original: policy.raw,
      normalized,
    },
    age_min: policy.ageMin,
    age_max: policy.ageMax,
    policy_domain:
      policy.policyDomain === "unknown" ? null : policy.policyDomain,
    source_updated_at: policy.sourceUpdatedAt,
    source_status: policy.sourceStatus,
    source_fingerprint: createYouthCenterSourceFingerprint({
      title,
      organization,
      regions: regionStorage.regions,
      applyStart: policy.applyStart,
      applyEnd: policy.applyEnd,
      summary,
      target,
    }),
    updated_at: now.toISOString(),
  };
}

export async function assertYouthCenterSchemaReady() {
  const { error } = await supabaseAdmin
    .from("announcements")
    .select(
      "regions,age_min,age_max,policy_domain,source_updated_at,source_status,source_fingerprint",
      { head: true },
    )
    .limit(1);

  if (error) {
    throw new Error(
      "온통청년 DB migration이 아직 적용되지 않았습니다. " +
        "migration 적용 후 실제 수집을 실행하세요.",
    );
  }
}

export async function ensureYouthCenterSource() {
  const existing = await findYouthCenterSource();
  if (existing !== null) {
    return { sourceId: existing, created: false };
  }

  const { error } = await supabaseAdmin.rpc("ensure_source_by_code", {
    p_code: SOURCE_CODE,
    p_name: SOURCE_NAME,
  });
  if (error) {
    throw new Error(`온통청년 출처 등록 실패: ${error.message}`);
  }

  // 함수 반환값을 ID로 신뢰하지 않고 code 고유키로 실제 저장된 행을 다시 조회한다.
  const sourceId = await findYouthCenterSource();
  if (sourceId === null) {
    throw new Error("온통청년 출처 등록 후 source_id를 확인할 수 없습니다.");
  }
  return { sourceId, created: true };
}

export function resolvePublicAnnouncementStatus(input: {
  sourceCode: string;
  sourceStatus: YouthCenterPolicy["sourceStatus"] | null;
  applyEnd: string | null;
  today: string;
}) {
  if (input.sourceCode === SOURCE_CODE) {
    if (input.sourceStatus === "closed") return "closed";
    if (input.sourceStatus === "upcoming") return "upcoming";
    if (
      input.sourceStatus === "open" ||
      input.sourceStatus === "always"
    ) {
      return "open";
    }
  }
  return !input.applyEnd || input.applyEnd >= input.today
    ? "open"
    : "closed";
}

export async function loadExistingYouthCenterAnnouncements(sourceId: number) {
  const rows: ExistingYouthCenterAnnouncement[] = [];
  for (let from = 0; ; from += DB_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("announcements")
      .select("source_key,apply_start,apply_end")
      .eq("source_id", sourceId)
      .order("id", { ascending: true })
      .range(from, from + DB_PAGE_SIZE - 1);
    if (error) {
      throw new Error(`기존 온통청년 정책 조회 실패: ${error.message}`);
    }

    const page = (data ?? []).map((row) => ({
      sourceKey: String(row.source_key),
      applyStart: nullableString(row.apply_start),
      applyEnd: nullableString(row.apply_end),
    }));
    rows.push(...page);
    if (page.length < DB_PAGE_SIZE) break;
  }
  return rows;
}

export async function loadExistingAnnouncementsForDedup() {
  const { data: sourceRows, error: sourceError } = await supabaseAdmin
    .from("sources")
    .select("id,code");
  if (sourceError) {
    throw new Error(`기존 출처 읽기 실패: ${sourceError.message}`);
  }
  const sourceCodes = new Map(
    (sourceRows ?? []).map((row) => [Number(row.id), String(row.code)]),
  );
  const rows: ExistingAnnouncementForDedup[] = [];
  for (let from = 0; ; from += DB_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("announcements")
      .select(
        "id,source_id,source_key,title,organization,region,target,support_type,summary,apply_start,apply_end",
      )
      .order("id", { ascending: true })
      .range(from, from + DB_PAGE_SIZE - 1);
    if (error) throw new Error(`기존 공고 읽기 실패: ${error.message}`);

    const page = (data ?? []).map((row) => ({
      id: Number(row.id),
      sourceId: Number(row.source_id),
      sourceCode: sourceCodes.get(Number(row.source_id)) ?? null,
      sourceKey: String(row.source_key),
      title: String(row.title),
      organization: nullableString(row.organization),
      region: nullableString(row.region),
      target: nullableString(row.target),
      supportType: nullableString(row.support_type),
      summary: nullableString(row.summary),
      applyStart: nullableString(row.apply_start),
      applyEnd: nullableString(row.apply_end),
    }));
    rows.push(...page);
    if (page.length < DB_PAGE_SIZE) break;
  }
  return rows;
}

export async function storeYouthCenterPlan(
  sourceId: number,
  sourceCreated: boolean,
  plan: YouthCenterSyncPlan,
): Promise<YouthCenterStoreResult> {
  let activeUpserted = 0;
  let writeRequests = 0;
  for (let index = 0; index < plan.activeUpserts.length; index += UPSERT_CHUNK_SIZE) {
    const chunk = plan.activeUpserts.slice(index, index + UPSERT_CHUNK_SIZE);
    writeRequests++;
    const { error } = await supabaseAdmin
      .from("announcements")
      .upsert(chunk, { onConflict: "source_id,source_key" });
    if (error) {
      throw new Error(`온통청년 정책 upsert 실패: ${error.message}`);
    }
    activeUpserted += chunk.length;
  }

  let closedUpdated = 0;
  for (const update of plan.closedUpdates) {
    writeRequests++;
    const { data, error } = await supabaseAdmin
      .from("announcements")
      .update(update.values)
      .eq("source_id", sourceId)
      .eq("source_key", update.sourceKey)
      .select("id");
    if (error) {
      throw new Error(`온통청년 마감 동기화 실패: ${error.message}`);
    }
    closedUpdated += data?.length ?? 0;
  }

  writeRequests++;
  const { error: fetchedAtError } = await supabaseAdmin
    .from("sources")
    .update({ last_fetched_at: new Date().toISOString() })
    .eq("code", SOURCE_CODE);
  if (fetchedAtError) {
    throw new Error(
      `온통청년 최종 수집 시각 갱신 실패: ${fetchedAtError.message}`,
    );
  }

  return {
    sourceCreated,
    activeUpserted,
    closedUpdated,
    closedWithoutEndDate: plan.closedWithoutEndDate.length,
    absentExistingRowsUntouched: plan.absentExistingRowsUntouched,
    writeRequests,
  };
}

async function findYouthCenterSource() {
  const { data, error } = await supabaseAdmin
    .from("sources")
    .select("id")
    .eq("code", SOURCE_CODE)
    .maybeSingle();
  if (error) {
    throw new Error(`온통청년 출처 조회 실패: ${error.message}`);
  }
  return data ? Number(data.id) : null;
}

function regionValues(policy: YouthCenterPolicy) {
  if (policy.regionResolution === "nationwide") {
    return { region: "전국", regions: ["전국"] };
  }
  if (policy.regionResolution === "single" && policy.region) {
    return { region: policy.region, regions: [policy.region] };
  }
  if (policy.regionResolution === "multiple") {
    return {
      region: null,
      regions: policy.regions.length > 0 ? policy.regions : null,
    };
  }
  return { region: null, regions: null };
}

function sanitizeNullable(value: string | null) {
  const sanitized = sanitizeDisplayText(value);
  return sanitized || null;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}
