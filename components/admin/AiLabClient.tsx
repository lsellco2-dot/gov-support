"use client";

import Link from "next/link";
import {
  ArrowDown,
  ExternalLink,
  FlaskConical,
  LoaderCircle,
  Search,
  Sparkles,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import {
  AI_LAB_CANDIDATE_LIMITS,
  type AiLabSearchInput,
  type AiLabSearchResponse,
} from "@/lib/admin/ai-lab-types";
import {
  INDUSTRY_OPTIONS,
  INTEREST_OPTIONS,
  REGION_OPTIONS,
  STARTUP_YEAR_OPTIONS,
  USER_CONDITION_SCHEMA_VERSION,
  USER_TYPE_OPTIONS,
} from "@/lib/mobile/user-condition";
import { POLICY_DOMAIN_OPTIONS } from "@/lib/query/announcement-presentation";

type FormState = AiLabSearchInput;

const INITIAL_FORM: FormState = {
  profile: {
    user_type: "pre_startup",
    region: "seoul",
    industry: "all",
    interests: ["startup_support"],
    startup_years: "pre_startup",
    onboarding_completed: true,
    schema_version: USER_CONDITION_SCHEMA_VERSION,
    birth_year: null,
    employment_status: "",
    youth_policy_interests: [],
    business_item_description: "",
    needed_support: "",
  },
  include_nationwide: false,
  candidate_limit: 20,
  sort: "score",
};

export default function AiLabClient() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [result, setResult] = useState<AiLabSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateProfile<K extends keyof FormState["profile"]>(
    key: K,
    value: FormState["profile"][K],
  ) {
    setForm((current) => ({
      ...current,
      profile: { ...current.profile, [key]: value },
    }));
  }

  function updateUserType(userType: string) {
    setForm((current) => ({
      ...current,
      profile: {
        ...current.profile,
        user_type: userType,
        startup_years:
          userType === "job_seeker_worker"
            ? "not_applicable"
            : current.profile.startup_years === "not_applicable"
              ? "pre_startup"
              : current.profile.startup_years,
      },
    }));
  }

  function toggleInterest(value: string) {
    const interests = form.profile.interests.includes(value)
      ? form.profile.interests.filter((item) => item !== value)
      : [...form.profile.interests, value];
    updateProfile("interests", interests);
  }

  function toggleYouthInterest(value: (typeof POLICY_DOMAIN_OPTIONS)[number]["value"]) {
    const interests = form.profile.youth_policy_interests.includes(value)
      ? form.profile.youth_policy_interests.filter((item) => item !== value)
      : [...form.profile.youth_policy_interests, value];
    updateProfile("youth_policy_interests", interests);
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || form.profile.interests.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/ai-lab/search", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json().catch(() => null)) as
        | AiLabSearchResponse
        | { error?: string }
        | null;
      if (!response.ok || !payload || !("candidates" in payload)) {
        throw new Error(payload && "error" in payload ? payload.error : undefined);
      }
      setResult(payload);
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "정밀검색을 실행하지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={search} className="border-y border-line bg-white py-5 sm:rounded-lg sm:border sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-light text-primary">
            <FlaskConical size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-ink">테스트 프로필</h2>
            <p className="mt-1 text-sm leading-relaxed text-subtle">
              운영 추천 규칙으로 후보를 계산합니다. 입력값과 결과는 DB에 저장하지 않습니다.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField
            id="ai-lab-user-type"
            label="사용자 유형"
            value={form.profile.user_type}
            options={USER_TYPE_OPTIONS}
            onChange={updateUserType}
          />
          <SelectField
            id="ai-lab-region"
            label="지역"
            value={form.profile.region}
            options={REGION_OPTIONS}
            onChange={(value) => updateProfile("region", value)}
          />
          <SelectField
            id="ai-lab-industry"
            label="업종"
            value={form.profile.industry}
            options={INDUSTRY_OPTIONS}
            onChange={(value) => updateProfile("industry", value)}
          />
          <SelectField
            id="ai-lab-startup-years"
            label="창업 연차"
            value={form.profile.startup_years}
            options={STARTUP_YEAR_OPTIONS}
            disabled={form.profile.user_type === "job_seeker_worker"}
            onChange={(value) => updateProfile("startup_years", value)}
          />
        </div>

        <fieldset className="mt-6">
          <legend className="text-sm font-bold text-ink">관심 분야</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {INTEREST_OPTIONS.map(({ value, label }) => (
              <CheckField
                key={value}
                checked={form.profile.interests.includes(value)}
                label={label}
                onChange={() => toggleInterest(value)}
              />
            ))}
          </div>
          {form.profile.interests.length === 0 && (
            <p className="mt-2 text-xs text-urgent">관심 분야를 한 개 이상 선택해 주세요.</p>
          )}
        </fieldset>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <TextField
            id="ai-lab-birth-year"
            label="출생연도 (선택)"
            inputMode="numeric"
            value={form.profile.birth_year?.toString() ?? ""}
            placeholder="예: 1992"
            onChange={(value) =>
              updateProfile("birth_year", value ? Number(value) : null)
            }
          />
          <TextField
            id="ai-lab-employment-status"
            label="취업상태 (선택)"
            value={form.profile.employment_status}
            placeholder="예: 취업준비생, 재직자"
            onChange={(value) => updateProfile("employment_status", value)}
          />
        </div>

        <fieldset className="mt-6">
          <legend className="text-sm font-bold text-ink">청년정책 관심분야 (선택)</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {POLICY_DOMAIN_OPTIONS.map(({ value, label }) => (
              <CheckField
                key={value}
                compact
                checked={form.profile.youth_policy_interests.includes(value)}
                label={label}
                onChange={() => toggleYouthInterest(value)}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-subtle">
            이번 버전에서는 기록만 하며 후보 순위에는 반영하지 않습니다.
          </p>
        </fieldset>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <TextAreaField
            id="ai-lab-business-description"
            label="사업 아이템 설명"
            value={form.profile.business_item_description}
            placeholder="예: 지역 농산물을 활용한 간편식 브랜드"
            onChange={(value) => updateProfile("business_item_description", value)}
          />
          <TextAreaField
            id="ai-lab-needed-support"
            label="필요한 지원"
            value={form.profile.needed_support}
            placeholder="예: 사업화자금 / R&D / 입주공간 / 판로"
            onChange={(value) => updateProfile("needed_support", value)}
          />
        </div>

        <div className="mt-7 border-t border-line pt-6">
          <h3 className="text-sm font-bold text-ink">검색 설정</h3>
          <div className="mt-3 grid gap-5 lg:grid-cols-3">
            <SegmentedField
              label="전국 공고"
              options={[
                { value: "false", label: "제외" },
                { value: "true", label: "포함" },
              ]}
              value={String(form.include_nationwide)}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  include_nationwide: value === "true",
                }))
              }
            />
            <SegmentedField
              label="최종 후보"
              options={AI_LAB_CANDIDATE_LIMITS.map((value) => ({
                value: String(value),
                label: `${value}건`,
              }))}
              value={String(form.candidate_limit)}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  candidate_limit: Number(value) as FormState["candidate_limit"],
                }))
              }
            />
            <SegmentedField
              label="결과 정렬"
              options={[
                { value: "score", label: "점수순" },
                { value: "deadline", label: "마감순" },
              ]}
              value={form.sort}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  sort: value as FormState["sort"],
                }))
              }
            />
          </div>
        </div>

        {error && (
          <p className="mt-5 rounded-md border border-urgent bg-red-50 px-3 py-2 text-sm text-urgent" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled
            title="LLM 연결 후 사용 가능"
            className="flex h-12 items-center justify-center rounded-md border border-line bg-slate-100 px-5 text-sm font-semibold text-subtle opacity-70"
          >
            <Sparkles className="mr-2" size={18} aria-hidden="true" />
            AI 심층분석 · LLM 연결 후 사용 가능
          </button>
          <button
            type="submit"
            disabled={loading || form.profile.interests.length === 0}
            className="flex h-12 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <LoaderCircle className="mr-2 animate-spin" size={18} aria-hidden="true" />
            ) : (
              <Search className="mr-2" size={18} aria-hidden="true" />
            )}
            {loading ? "후보 계산 중" : "정밀검색 실행"}
          </button>
        </div>
      </form>

      {result && <SearchResults result={result} />}
    </div>
  );
}

function SearchResults({ result }: { result: AiLabSearchResponse }) {
  const { metrics, candidates } = result;
  return (
    <section aria-live="polite">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-ink">검색 결과</h2>
          <p className="mt-1 text-sm text-subtle">기존 AISUP 규칙 점수와 추천 사유를 표시합니다.</p>
        </div>
        <p className="text-xs text-subtle">
          DB {metrics.db_ms}ms · 추천 {metrics.recommendation_ms}ms · 전체 {metrics.total_ms}ms
        </p>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">
        <Metric label="전체 공개 공고" value={metrics.total_public} />
        <ArrowDown className="rotate-[-90deg] text-slate-400 sm:rotate-0" size={18} aria-hidden="true" />
        <Metric label="규칙 조건 통과" value={metrics.rule_candidates} />
        <ArrowDown className="rotate-[-90deg] text-slate-400 sm:rotate-0" size={18} aria-hidden="true" />
        <Metric label="최종 후보" value={metrics.final_candidates} />
      </div>

      {candidates.length === 0 ? (
        <div className="mt-5 border-y border-dashed border-line bg-white px-4 py-10 text-center sm:rounded-lg sm:border">
          <p className="text-sm font-semibold text-ink">조건에 맞는 후보가 없습니다.</p>
          <p className="mt-1 text-xs text-subtle">관심 분야나 지역, 전국 공고 포함 조건을 바꿔보세요.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {candidates.map((candidate, index) => (
            <article key={candidate.id} className="rounded-lg border border-line bg-white p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-primary">#{index + 1} · {candidate.source_name}</p>
                  <h3 className="mt-1 break-words text-base font-bold leading-snug text-ink">
                    {candidate.title}
                  </h3>
                </div>
                <span className="shrink-0 rounded-badge bg-primary-light px-2.5 py-1.5 text-sm font-bold text-primary-dark">
                  {candidate.score}점
                </span>
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
                <Meta label="기관" value={candidate.agency ?? "정보 없음"} />
                <Meta label="지역" value={regionText(candidate.region, candidate.regions)} />
                <Meta label="신청기간" value={periodText(candidate.apply_start, candidate.apply_end)} />
                <Meta label="상태" value={candidate.status === "upcoming" ? "접수예정" : "모집중"} />
              </dl>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {candidate.category_names.map((name) => (
                  <span key={name} className="rounded-badge bg-slate-100 px-2 py-1 text-[11px] font-semibold text-subtle">
                    {name}
                  </span>
                ))}
                {candidate.policy_domain_label && (
                  <span className="rounded-badge bg-green-50 px-2 py-1 text-[11px] font-semibold text-open">
                    온통청년 · {candidate.policy_domain_label}
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {candidate.reasons.map((reason) => (
                  <span key={reason} className="rounded-badge bg-primary-light px-2 py-1 text-[11px] font-semibold text-primary-dark">
                    {reason}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Link
                  href={candidate.detail_url}
                  className="flex h-11 items-center justify-center rounded-md border border-primary px-4 text-sm font-semibold text-primary"
                >
                  상세 페이지
                </Link>
                {candidate.original_url && (
                  <a
                    href={candidate.original_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-white"
                  >
                    원문 보기
                    <ExternalLink className="ml-2" size={16} aria-hidden="true" />
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function SelectField({ id, label, value, options, onChange, disabled = false }: {
  id: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-bold text-ink">{label}</label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink focus:border-primary disabled:bg-slate-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

function TextField({ id, label, value, placeholder, inputMode, onChange }: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  inputMode?: "numeric";
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-bold text-ink">{label}</label>
      <input
        id={id}
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-md border border-line px-3 text-sm text-ink placeholder:text-slate-400 focus:border-primary"
      />
    </div>
  );
}

function TextAreaField({ id, label, value, placeholder, onChange }: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-bold text-ink">{label}</label>
      <textarea
        id={id}
        value={value}
        rows={4}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full resize-y rounded-md border border-line p-3 text-sm leading-relaxed text-ink placeholder:text-slate-400 focus:border-primary"
      />
    </div>
  );
}

function CheckField({ checked, label, onChange, compact = false }: {
  checked: boolean;
  label: string;
  onChange: () => void;
  compact?: boolean;
}) {
  return (
    <label className={`flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm ${compact ? "min-h-10" : "min-h-12"} ${checked ? "border-primary bg-primary-light font-semibold text-primary-dark" : "border-line bg-white text-ink"}`}>
      <input type="checkbox" checked={checked} onChange={onChange} className="mr-2 h-5 w-5 accent-primary" />
      {label}
    </label>
  );
}

function SegmentedField({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold text-subtle">{label}</legend>
      <div className="mt-2 flex overflow-x-auto rounded-md border border-line bg-white p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`h-10 min-w-14 flex-1 whitespace-nowrap rounded px-2 text-xs font-semibold ${value === option.value ? "bg-primary text-white" : "text-subtle"}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-white px-2 py-3 text-center sm:px-4">
      <p className="truncate text-[11px] text-subtle sm:text-xs">{label}</p>
      <p className="mt-1 text-lg font-bold text-ink">{value.toLocaleString()}<span className="ml-0.5 text-xs font-normal text-subtle">건</span></p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 gap-2">
      <dt className="shrink-0 font-semibold text-subtle">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{value}</dd>
    </div>
  );
}

function regionText(region: string | null, regions: string[] | null) {
  if (regions?.length) return regions.join(", ");
  return region ?? "지역 확인 필요";
}

function periodText(start: string | null, end: string | null) {
  if (!start && !end) return "상시/미정";
  return `${start ?? "시작일 미정"} ~ ${end ?? "종료일 미정"}`;
}
