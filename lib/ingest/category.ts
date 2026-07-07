import type { NormalizedAnnouncement } from "./types";

/** 카테고리 id ↔ 키워드 룰. 룰은 여기만 고치면 됨. */
const RULES: Array<{ id: number; keywords: string[] }> = [
  { id: 1, keywords: ["창업", "예비창업", "스타트업", "초기기업", "창업기업"] },
  { id: 2, keywords: ["소상공인", "자영업", "전통시장", "골목상권"] },
  { id: 3, keywords: ["융자", "대출", "보증", "자금지원", "이차보전", "정책자금"] },
  { id: 4, keywords: ["판로", "마케팅", "홍보", "입점", "라이브커머스", "브랜딩", "온라인판매"] },
  { id: 5, keywords: ["고용", "인건비", "채용", "일자리", "두루누리", "청년내일"] },
  { id: 6, keywords: ["R&D", "기술개발", "연구개발", "특허", "시제품", "기술혁신"] },
  { id: 7, keywords: ["수출", "해외진출", "글로벌", "해외마케팅", "무역"] },
  { id: 8, keywords: ["교육", "컨설팅", "멘토링", "아카데미", "역량강화"] },
  { id: 9, keywords: ["스마트공장", "스마트상점", "디지털전환", "시설", "장비", "키오스크", "스마트화"] },
];

/** 제목+대상+지원형태+요약 텍스트에서 다중 카테고리 매핑. 없으면 [] (미분류) */
export function mapCategories(a: NormalizedAnnouncement): number[] {
  const text = [a.title, a.target, a.supportType, a.summary]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const ids = RULES.filter((r) =>
    r.keywords.some((k) => text.includes(k.toLowerCase()))
  ).map((r) => r.id);
  return Array.from(new Set(ids));
}
