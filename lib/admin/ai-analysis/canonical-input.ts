import "server-only";

import type { AiLabCandidate } from "@/lib/admin/ai-lab-types";
import type { GrantAnalysisCandidate } from "@/lib/admin/ai-analysis/types";
import { youthCenterDetailFields } from "@/lib/query/announcement-presentation";
import { supabaseAnon } from "@/lib/supabase/anon";
import { sanitizeDisplayText } from "@/lib/text/sanitize";

const MAX_FIELD_LENGTH = {
  target: 2_000,
  supportType: 1_000,
  summary: 3_000,
  detailContent: 12_000,
  applyMethod: 3_000,
  documents: 3_000,
} as const;

type DetailRow = {
  id: number;
  target: string | null;
  support_type: string | null;
  summary: string | null;
  detail_content: string | null;
  apply_method: string | null;
  documents: string | null;
  age_min: number | null;
  age_max: number | null;
  raw_json: unknown;
};

export async function loadCanonicalGrantAnalysisCandidates(
  candidates: AiLabCandidate[],
): Promise<GrantAnalysisCandidate[]> {
  const ids = candidates.map(({ id }) => id);
  const { data, error } = await supabaseAnon
    .from("announcements")
    .select(
      "id,target,support_type,summary,detail_content,apply_method,documents,age_min,age_max,raw_json",
    )
    .in("id", ids);

  if (error) throw new Error("GRANT_ANALYSIS_DETAIL_QUERY_FAILED");
  const detailById = new Map(
    ((data ?? []) as unknown as DetailRow[]).map((row) => [row.id, row]),
  );
  if (detailById.size !== candidates.length) {
    throw new Error("GRANT_ANALYSIS_DETAIL_MISSING");
  }

  return candidates.map((candidate) => {
    const detail = detailById.get(candidate.id);
    if (!detail) throw new Error("GRANT_ANALYSIS_DETAIL_MISSING");

    const target = limitedText(detail.target, MAX_FIELD_LENGTH.target);
    const supportType = limitedText(
      detail.support_type,
      MAX_FIELD_LENGTH.supportType,
    );
    const summary = limitedText(detail.summary, MAX_FIELD_LENGTH.summary);
    const detailContent = limitedText(
      detail.detail_content,
      MAX_FIELD_LENGTH.detailContent,
    );
    const applyMethod = limitedText(
      detail.apply_method,
      MAX_FIELD_LENGTH.applyMethod,
    );
    const documents = limitedText(
      detail.documents,
      MAX_FIELD_LENGTH.documents,
    );
    const youthConditions = youthCenterDetailFields(detail.raw_json);

    return {
      ...candidate,
      target: target.value,
      supportType: supportType.value,
      summary: summary.value,
      detailContent: detailContent.value,
      applyMethod: applyMethod.value,
      documents: documents.value,
      age_min: detail.age_min,
      age_max: detail.age_max,
      educationCondition: youthConditions.education_condition,
      employmentCondition: youthConditions.employment_condition,
      majorCondition: youthConditions.major_condition,
      contentTruncated:
        target.truncated ||
        supportType.truncated ||
        summary.truncated ||
        detailContent.truncated ||
        applyMethod.truncated ||
        documents.truncated,
    };
  });
}

function limitedText(value: string | null, maxLength: number) {
  const text = sanitizeDisplayText(value)?.trim() || null;
  if (!text) return { value: null, truncated: false };
  return {
    value: text.slice(0, maxLength),
    truncated: text.length > maxLength,
  };
}
