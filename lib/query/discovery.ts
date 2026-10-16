export const SUPPORT_TOPICS = [
  { value: "workspace", label: "사무실·입주공간" },
  { value: "welfare", label: "복지·생활지원" },
  { value: "public-interest", label: "공익·사회공헌" },
  { value: "education", label: "교육·평생학습" },
  { value: "sports-culture", label: "생활체육·문화" },
] as const;

export type SupportTopic = (typeof SUPPORT_TOPICS)[number]["value"];

const TOPIC_KEYWORDS: Record<SupportTopic, readonly string[]> = {
  workspace: ["사무실", "입주기업", "입주공간", "창업공간", "창업보육", "공유오피스", "업무공간", "입주 기업", "입주 공간", "입주자", "입주 모집", "활동공간", "활동 공간", "공유공간", "공유 공간", "공간 지원", "공간지원", "공간 대관"],
  welfare: ["복지", "생계", "돌봄", "주거", "의료비", "장애인", "기초생활", "한부모", "노숙인", "노숙자", "취약계층"],
  "public-interest": ["공익", "비영리", "사회공헌", "자원봉사", "사회서비스", "마을공동체", "시민단체"],
  education: ["교육", "평생학습", "평생교육", "학습동아리", "문해", "장학", "수강료", "직업훈련"],
  "sports-culture": ["생활체육", "체육동호회", "스포츠클럽", "테니스", "문화예술", "생활문화", "체육 활동", "체육활동"],
};

export function normalizeSupportTopic(value?: string): SupportTopic | undefined {
  return SUPPORT_TOPICS.find((topic) => topic.value === value)?.value;
}

export function topicKeywords(value?: string): readonly string[] {
  const topic = normalizeSupportTopic(value);
  return topic ? TOPIC_KEYWORDS[topic] : [];
}

export function searchTerms(value?: string): readonly string[] {
  const term = value?.trim().replace(/[,%()]/g, " ").trim();
  if (!term) return [];
  // 이용자가 부르는 '사무실 지원'과 원문에서 쓰는 '입주기업 모집'을 함께 검색한다.
  if (/^(사무실|사무공간|입주공간|창업공간)(지원)?$/.test(term.replace(/\s/g, ""))) {
    return TOPIC_KEYWORDS.workspace;
  }
  return [term];
}

export function matchesTerms(text: string, terms: readonly string[]) {
  return terms.length === 0 || terms.some((term) => text.toLowerCase().includes(term.toLowerCase()));
}

// Fixed keyword alternatives share one regex pass per field instead of many ILIKE scans.
export function keywordFilters(terms: readonly string[], fields: readonly string[]) {
  const pattern = terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return fields.map(field => `${field}.imatch.${JSON.stringify(pattern)}`);
}
