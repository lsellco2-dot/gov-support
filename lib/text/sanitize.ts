const EMOJI_RE =
  /[\uD83C-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]\uFE0F?|\uFE0F|\u200D/g;

export function sanitizeDisplayText(value: string): string;
export function sanitizeDisplayText(value: string | null): string | null;
export function sanitizeDisplayText(value: string | null | undefined): string | null;
export function sanitizeDisplayText(value: string | null | undefined) {
  if (value === null || value === undefined) return null;

  const withoutHtml = decodeHtmlEntities(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  const withoutEmoji = withoutHtml
    .replace(EMOJI_RE, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .trim();

  return stripEdgeBrokenQuestionMarks(withoutEmoji);
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (entity, hex) => decodeCodePoint(entity, hex, 16))
    .replace(/&#(\d+);/g, (entity, decimal) => decodeCodePoint(entity, decimal, 10));
}

function decodeCodePoint(entity: string, value: string, radix: number) {
  const codePoint = Number.parseInt(value, radix);
  return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : entity;
}

function stripEdgeBrokenQuestionMarks(value: string) {
  let text = value;
  while (text.startsWith("?")) text = text.slice(1).trimStart();
  while (text.endsWith("?") && !isLikelyQuestionSentence(text)) {
    text = text.slice(0, -1).trimEnd();
  }
  return text;
}

function isLikelyQuestionSentence(value: string) {
  return /(까|나요|가요|까요|습니까|있나요|되나요|인가요|무엇|왜|어떻게|언제|어디|누가|가능)\?$/.test(value);
}

export function sanitizeDisplayRow<
  T extends {
    title: string;
    organization: string | null;
    region: string | null;
    target: string | null;
    support_type: string | null;
    summary: string | null;
  },
>(row: T): T {
  return {
    ...row,
    title: sanitizeDisplayText(row.title),
    organization: sanitizeDisplayText(row.organization),
    region: sanitizeDisplayText(row.region),
    target: sanitizeDisplayText(row.target),
    support_type: sanitizeDisplayText(row.support_type),
    summary: sanitizeDisplayText(row.summary),
  };
}
