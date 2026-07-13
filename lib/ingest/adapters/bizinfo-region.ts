export const BIZINFO_REGIONS = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
] as const;

export type BizinfoRegion = (typeof BIZINFO_REGIONS)[number];
export type BizinfoRegionValue = BizinfoRegion | "전국" | "미확인";
export type BizinfoRegionEvidenceField =
  | "target"
  | "detail_content"
  | "title"
  | "summary"
  | null;

export interface BizinfoRegionInput {
  title: string | null;
  target: string | null;
  summary: string | null;
  detailContent?: string | null;
}

export interface BizinfoRegionResult {
  region: BizinfoRegionValue;
  reason: "single_region" | "nationwide" | "conflict_or_multiple" | "no_evidence";
  evidenceField: BizinfoRegionEvidenceField;
  evidenceSnippet: string | null;
  candidates: BizinfoRegion[];
  hasNationwideEvidence: boolean;
}

interface RegionDefinition {
  region: BizinfoRegion;
  aliases: string[];
  municipalities: string[];
}

const DEFINITIONS: RegionDefinition[] = [
  {
    region: "서울",
    aliases: ["서울특별시", "서울시", "서울"],
    municipalities: [
      "종로구", "용산구", "성동구", "광진구", "동대문구", "중랑구", "성북구",
      "강북구", "도봉구", "노원구", "은평구", "서대문구", "마포구", "양천구",
      "구로구", "금천구", "영등포구", "동작구", "관악구", "서초구", "강남구",
      "송파구", "강동구",
    ],
  },
  {
    region: "부산",
    aliases: ["부산광역시", "부산시", "부산"],
    municipalities: ["기장군", "부산진구", "해운대구", "금정구", "연제구", "수영구", "사상구"],
  },
  {
    region: "대구",
    aliases: ["대구광역시", "대구시", "대구"],
    municipalities: ["달성군", "군위군", "수성구", "달서구"],
  },
  {
    region: "인천",
    aliases: ["인천광역시", "인천시", "인천"],
    municipalities: ["강화군", "옹진군", "미추홀구", "연수구", "남동구", "부평구", "계양구"],
  },
  {
    region: "광주",
    aliases: ["광주광역시", "광주"],
    municipalities: ["광산구"],
  },
  {
    region: "대전",
    aliases: ["대전광역시", "대전시", "대전"],
    municipalities: ["유성구", "대덕구"],
  },
  {
    region: "울산",
    aliases: ["울산광역시", "울산시", "울산"],
    municipalities: ["울주군"],
  },
  {
    region: "세종",
    aliases: ["세종특별자치시", "세종시", "세종"],
    municipalities: [],
  },
  {
    region: "경기",
    aliases: ["경기도", "경기"],
    municipalities: [
      "수원시", "고양시", "용인시", "성남시", "부천시", "화성시", "안산시",
      "남양주시", "안양시", "평택시", "시흥시", "파주시", "의정부시", "김포시",
      "광주시", "광명시", "군포시", "하남시", "오산시", "양주시", "이천시",
      "구리시", "안성시", "포천시", "의왕시", "여주시", "동두천시", "과천시",
      "양평군", "가평군", "연천군",
    ],
  },
  {
    region: "강원",
    aliases: ["강원특별자치도", "강원도", "강원"],
    municipalities: [
      "춘천시", "원주시", "강릉시", "동해시", "태백시", "속초시", "삼척시",
      "홍천군", "횡성군", "영월군", "평창군", "정선군", "철원군", "화천군",
      "양구군", "인제군", "양양군",
    ],
  },
  {
    region: "충북",
    aliases: ["충청북도", "충북도", "충북"],
    municipalities: [
      "청주시", "충주시", "제천시", "보은군", "옥천군", "영동군", "증평군",
      "진천군", "괴산군", "음성군", "단양군",
    ],
  },
  {
    region: "충남",
    aliases: ["충청남도", "충남도", "충남"],
    municipalities: [
      "천안시", "공주시", "보령시", "아산시", "서산시", "논산시", "계룡시",
      "당진시", "금산군", "부여군", "서천군", "청양군", "홍성군", "예산군", "태안군",
    ],
  },
  {
    region: "전북",
    aliases: ["전북특별자치도", "전라북도", "전북도", "전북"],
    municipalities: [
      "전주시", "군산시", "익산시", "정읍시", "남원시", "김제시", "완주군",
      "진안군", "무주군", "장수군", "임실군", "순창군", "고창군", "부안군",
    ],
  },
  {
    region: "전남",
    aliases: ["전라남도", "전남도", "전남"],
    municipalities: [
      "목포시", "여수시", "순천시", "나주시", "광양시", "담양군", "곡성군",
      "구례군", "고흥군", "보성군", "화순군", "장흥군", "강진군", "해남군",
      "영암군", "무안군", "함평군", "영광군", "장성군", "완도군", "진도군", "신안군",
    ],
  },
  {
    region: "경북",
    aliases: ["경상북도", "경북도", "경북"],
    municipalities: [
      "포항시", "경주시", "김천시", "안동시", "구미시", "영주시", "영천시",
      "상주시", "문경시", "경산시", "의성군", "청송군", "영양군", "영덕군",
      "청도군", "고령군", "성주군", "칠곡군", "예천군", "봉화군", "울진군", "울릉군",
    ],
  },
  {
    region: "경남",
    aliases: ["경상남도", "경남도", "경남"],
    municipalities: [
      "창원시", "진주시", "통영시", "사천시", "김해시", "밀양시", "거제시",
      "양산시", "의령군", "함안군", "창녕군", "남해군", "하동군", "산청군",
      "함양군", "거창군", "합천군",
    ],
  },
  {
    region: "제주",
    aliases: ["제주특별자치도", "제주도", "제주"],
    municipalities: ["제주시", "서귀포시"],
  },
];

const FIELD_PRIORITY: Array<Exclude<BizinfoRegionEvidenceField, null>> = [
  "target",
  "detail_content",
  "title",
  "summary",
];

const LOCATION_CONTEXT =
  /소재|거주|사업장|본사|주사무소|공장|관내|도내|시내|지역\s*내|지역.{0,15}(?:기업|업체|소상공인|사업자|주민|청년)/;
const RELATIVE_LOCATION = /도내|관내|시내/;
const CONTACT_CONTEXT = /문의처|접수처|담당자|담당부서|전화|오시는\s*길|기관\s*주소/;
const ELIGIBILITY_CONTEXT =
  /☞|지원\s*대상|신청\s*대상|참여\s*대상|신청\s*자격|지원\s*자격|자격\s*요건|소재|거주|사업장|관내|도내|시내/;
const NATIONWIDE_CONTEXT =
  /전국\s*소재|전국\s*대상|전국(?:의)?\s+.{0,20}(?:기업|소상공인|사업자|사업장|기관|대학)|지역\s*제한\s*(?:없음|없)|소재지\s*제한\s*(?:없음|없)|전국\s*어디서나/;
const DETAIL_STOP_MARKERS = [
  "사업신청 방법",
  "사업신청방법",
  "사업신청 사이트",
  "문의처",
  "접수처",
  "담당부서",
  "첨부파일",
];

interface FieldEvidence {
  field: Exclude<BizinfoRegionEvidenceField, null>;
  regions: Map<BizinfoRegion, string>;
  nationwideSnippet: string | null;
}

export function inferBizinfoRegion(input: BizinfoRegionInput): BizinfoRegionResult {
  const titleText = normalizeText(input.title);
  const titleRegions = findTitleRegions(titleText);
  const fields: FieldEvidence[] = [
    analyzeEligibilityField("target", normalizeText(input.target), titleRegions),
    analyzeEligibilityField(
      "detail_content",
      extractDetailEligibilityText(input.detailContent),
      titleRegions
    ),
    analyzeTitle(titleText),
    analyzeEligibilityField("summary", normalizeText(input.summary), titleRegions),
  ];

  const candidates = uniqueRegions(fields.flatMap((field) => [...field.regions.keys()]));
  const hasNationwideEvidence = fields.some((field) => field.nationwideSnippet !== null);

  if (candidates.length > 1 || (candidates.length > 0 && hasNationwideEvidence)) {
    return {
      region: "미확인",
      reason: "conflict_or_multiple",
      evidenceField: null,
      evidenceSnippet: null,
      candidates,
      hasNationwideEvidence,
    };
  }

  if (candidates.length === 1) {
    const region = candidates[0];
    const evidence = fields.find((field) => field.regions.has(region));
    return {
      region,
      reason: "single_region",
      evidenceField: evidence?.field ?? null,
      evidenceSnippet: evidence?.regions.get(region) ?? null,
      candidates,
      hasNationwideEvidence: false,
    };
  }

  if (hasNationwideEvidence) {
    const evidence = fields.find((field) => field.nationwideSnippet !== null);
    return {
      region: "전국",
      reason: "nationwide",
      evidenceField: evidence?.field ?? null,
      evidenceSnippet: evidence?.nationwideSnippet ?? null,
      candidates: [],
      hasNationwideEvidence: true,
    };
  }

  return {
    region: "미확인",
    reason: "no_evidence",
    evidenceField: null,
    evidenceSnippet: null,
    candidates: [],
    hasNationwideEvidence: false,
  };
}

function analyzeEligibilityField(
  field: Exclude<BizinfoRegionEvidenceField, null>,
  text: string,
  titleRegions: BizinfoRegion[]
): FieldEvidence {
  const regions = new Map<BizinfoRegion, string>();
  if (text) {
    for (const occurrence of findRegionOccurrences(text, titleRegions)) {
      const snippet = contextSnippet(text, occurrence.index, occurrence.term.length);
      if (
        LOCATION_CONTEXT.test(snippet) &&
        ELIGIBILITY_CONTEXT.test(snippet) &&
        (!CONTACT_CONTEXT.test(snippet) || /☞|지원\s*대상|신청\s*대상|자격/.test(snippet))
      ) {
        regions.set(occurrence.region, snippet);
      }
    }
    if (regions.size === 0 && titleRegions.length === 1 && RELATIVE_LOCATION.test(text)) {
      const relativeIndex = text.search(RELATIVE_LOCATION);
      regions.set(titleRegions[0], contextSnippet(text, relativeIndex, 2));
    }
  }
  return {
    field,
    regions,
    nationwideSnippet: findNationwideSnippet(text),
  };
}

function analyzeTitle(text: string): FieldEvidence {
  const regions = new Map<BizinfoRegion, string>();
  for (const occurrence of findRegionOccurrences(text)) {
    const prefix = text.slice(0, occurrence.index);
    const isBracketPrefix = occurrence.index <= 3 && /^[\s[\](（【]*$/.test(prefix);
    if (isBracketPrefix || occurrence.isMunicipality || LOCATION_CONTEXT.test(text)) {
      regions.set(
        occurrence.region,
        contextSnippet(text, occurrence.index, occurrence.term.length)
      );
    }
  }
  return {
    field: "title",
    regions,
    nationwideSnippet: findNationwideSnippet(text),
  };
}

function findTitleRegions(text: string) {
  return uniqueRegions([...analyzeTitle(text).regions.keys()]);
}

function extractDetailEligibilityText(value: string | null | undefined) {
  const text = normalizeText(value);
  let end = text.length;
  for (const marker of DETAIL_STOP_MARKERS) {
    const index = text.indexOf(marker);
    if (index >= 0) end = Math.min(end, index);
  }
  return text.slice(0, end);
}

function findNationwideSnippet(text: string) {
  if (!text) return null;
  const match = NATIONWIDE_CONTEXT.exec(text);
  NATIONWIDE_CONTEXT.lastIndex = 0;
  return match ? contextSnippet(text, match.index, match[0].length) : null;
}

function findRegionOccurrences(text: string, contextualRegions: BizinfoRegion[] = []) {
  const occurrences: Array<{
    region: BizinfoRegion;
    index: number;
    term: string;
    isMunicipality: boolean;
  }> = [];
  for (const definition of DEFINITIONS) {
    for (const term of definition.aliases) {
      for (const index of findTermIndexes(text, term, term.length <= 2)) {
        occurrences.push({ region: definition.region, index, term, isMunicipality: false });
      }
    }
    for (const term of definition.municipalities) {
      for (const index of findTermIndexes(text, term, false)) {
        const region =
          term === "광주시" &&
          (contextualRegions.includes("광주") ||
            text.includes("광주광역시") ||
            /^\s*[[(（【]\s*광주[\])）】]/.test(text))
            ? "광주"
            : definition.region;
        occurrences.push({ region, index, term, isMunicipality: true });
      }
    }
  }
  return occurrences.sort((a, b) => a.index - b.index || b.term.length - a.term.length);
}

function findTermIndexes(text: string, term: string, strictBoundary: boolean) {
  const indexes: number[] = [];
  let start = 0;
  while (start < text.length) {
    const index = text.indexOf(term, start);
    if (index < 0) break;
    const before = text[index - 1] ?? "";
    const after = text[index + term.length] ?? "";
    if (
      !strictBoundary ||
      (!isKoreanSyllable(before) && !isKoreanSyllable(after))
    ) {
      indexes.push(index);
    }
    start = index + Math.max(1, term.length);
  }
  return indexes;
}

function isKoreanSyllable(value: string) {
  return /[가-힣]/.test(value);
}

function contextSnippet(text: string, index: number, length: number) {
  if (index < 0) return "";
  const snippet = text.slice(Math.max(0, index - 55), Math.min(text.length, index + length + 75));
  return snippet.length > 140 ? `${snippet.slice(0, 137)}...` : snippet;
}

function uniqueRegions(values: BizinfoRegion[]) {
  return [...new Set(values)];
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}
