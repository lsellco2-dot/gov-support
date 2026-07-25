"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getUserConditionSettingsBridgeAvailability,
  openUserConditionSettings,
} from "@/lib/mobile/app-bridge";
import {
  clearWebUserCondition,
  INDUSTRY_OPTIONS,
  INTEREST_OPTIONS,
  readWebUserCondition,
  REGION_OPTIONS,
  saveWebUserCondition,
  STARTUP_YEAR_OPTIONS,
  USER_CONDITION_SCHEMA_VERSION,
  USER_TYPE_OPTIONS,
} from "@/lib/mobile/user-condition";

interface FormState {
  userType: string;
  region: string;
  industry: string;
  interests: string[];
  startupYears: string;
}

const EMPTY_FORM: FormState = {
  userType: "",
  region: "",
  industry: "",
  interests: [],
  startupYears: "",
};

export default function WebUserConditionForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [mode, setMode] = useState<"loading" | "web" | "native" | "outdated">(
    "loading",
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const availability = getUserConditionSettingsBridgeAvailability();
    if (availability !== "browser") {
      setMode(availability === "available" ? "native" : "outdated");
      return;
    }
    const stored = readWebUserCondition();
    if (stored) {
      setForm({
        userType: stored.user_type,
        region: stored.region,
        industry: stored.industry,
        interests: stored.interests,
        startupYears: stored.startup_years,
      });
    }
    setMode("web");
  }, []);

  const valid =
    form.userType &&
    form.region &&
    form.industry &&
    form.interests.length > 0 &&
    form.startupYears;

  function updateUserType(userType: string) {
    setForm((current) => ({
      ...current,
      userType,
      startupYears:
        userType === "job_seeker_worker" ? "not_applicable" : current.startupYears,
    }));
  }

  function toggleInterest(value: string) {
    setForm((current) => ({
      ...current,
      interests: current.interests.includes(value)
        ? current.interests.filter((item) => item !== value)
        : [...current.interests, value],
    }));
  }

  function save() {
    if (!valid || saving) return;
    setSaving(true);
    setMessage(null);
    const result = saveWebUserCondition({
      user_type: form.userType,
      region: form.region,
      industry: form.industry,
      interests: form.interests,
      startup_years: form.startupYears,
      onboarding_completed: true,
      schema_version: USER_CONDITION_SCHEMA_VERSION,
    });
    if (!result.success) {
      setMessage("내 정보를 저장하지 못했습니다. 브라우저 저장 설정을 확인해 주세요.");
      setSaving(false);
      return;
    }
    router.replace("/recommendations?saved=1");
  }

  function clear() {
    if (!window.confirm("저장된 내 정보를 삭제할까요?")) return;
    const result = clearWebUserCondition();
    if (!result.success) {
      setMessage("내 정보를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setForm(EMPTY_FORM);
    router.replace("/recommendations?cleared=1");
  }

  if (mode === "loading") {
    return (
      <div className="flex min-h-48 items-center justify-center" aria-live="polite">
        <LoaderCircle className="animate-spin text-primary" size={28} aria-hidden="true" />
        <span className="sr-only">저장된 내 정보를 불러오는 중입니다.</span>
      </div>
    );
  }

  if (mode !== "web") {
    return (
      <div className="rounded-lg border border-line bg-white px-5 py-10 text-center">
        <p className="text-sm leading-relaxed text-subtle">
          {mode === "native"
            ? "앱에 저장된 내 정보가 AI추천에 우선 적용됩니다."
            : "정부지원AI비서 앱을 최신 버전으로 업데이트하면 내 정보를 설정할 수 있습니다."}
        </p>
        {mode === "native" && (
          <button
            type="button"
            onClick={async () => {
              const result = await openUserConditionSettings();
              if (!result.success) {
                setMessage("앱의 내 정보 설정 화면을 열지 못했습니다.");
              }
            }}
            className="mt-5 h-12 rounded-md bg-primary px-6 text-sm font-semibold text-white"
          >
            앱에서 내 정보 설정
          </button>
        )}
        {message && (
          <p className="mt-3 text-sm text-urgent" role="alert">
            {message}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      className="rounded-lg border border-line bg-white p-5 sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <SelectField
        id="user-type"
        label="사용자 유형"
        value={form.userType}
        options={USER_TYPE_OPTIONS}
        onChange={updateUserType}
      />
      <SelectField
        id="region"
        label="지역"
        value={form.region}
        options={REGION_OPTIONS}
        onChange={(region) => setForm((current) => ({ ...current, region }))}
      />
      <SelectField
        id="industry"
        label="업종"
        value={form.industry}
        options={INDUSTRY_OPTIONS}
        onChange={(industry) => setForm((current) => ({ ...current, industry }))}
      />

      <fieldset className="mt-5">
        <legend className="text-sm font-bold text-ink">관심 분야</legend>
        <p className="mt-1 text-xs text-subtle">한 개 이상 선택해 주세요.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {INTEREST_OPTIONS.map(({ value, label }) => (
            <label
              key={value}
              className={`flex min-h-12 cursor-pointer items-center rounded-md border px-3 py-2 text-sm ${
                form.interests.includes(value)
                  ? "border-primary bg-primary-light font-semibold text-primary-dark"
                  : "border-line bg-white text-ink"
              }`}
            >
              <input
                type="checkbox"
                checked={form.interests.includes(value)}
                onChange={() => toggleInterest(value)}
                className="mr-2 h-5 w-5 accent-primary"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <SelectField
        id="startup-years"
        label="창업 연차"
        value={form.startupYears}
        options={STARTUP_YEAR_OPTIONS}
        disabled={form.userType === "job_seeker_worker"}
        onChange={(startupYears) =>
          setForm((current) => ({ ...current, startupYears }))
        }
      />

      {message && (
        <p
          className="mt-4 rounded-md border border-urgent bg-red-50 px-3 py-2 text-sm text-urgent"
          role="alert"
        >
          {message}
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={clear}
          className="flex h-12 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-semibold text-subtle"
        >
          <Trash2 className="mr-2" size={17} aria-hidden="true" />
          내 정보 삭제
        </button>
        <button
          type="submit"
          disabled={!valid || saving}
          className="flex h-12 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && (
            <LoaderCircle className="mr-2 animate-spin" size={18} aria-hidden="true" />
          )}
          저장
        </button>
      </div>
    </form>
  );
}

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-5 first:mt-0">
      <label htmlFor={id} className="text-sm font-bold text-ink">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink focus:border-primary disabled:bg-slate-100 disabled:text-subtle"
      >
        <option value="">선택해 주세요</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
