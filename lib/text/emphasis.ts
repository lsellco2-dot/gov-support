/*
  원문 상세의 강조(빨간 글씨·굵은 글씨)를 보존하기 위한 경량 마커.
  - 수집기(detail.ts)가 원문 DOM에서 강조 요소를 감지해 텍스트에 마커를 심는다.
  - HTML을 저장·주입하지 않고 이 마커만 사용하므로 XSS 위험이 없다.
  - 렌더러(DetailContentBody)가 마커를 파싱해 스타일 span으로 표시한다.
*/

export const EM_OPEN = "[[em]]";
export const EM_CLOSE = "[[/em]]";
export const B_OPEN = "[[b]]";
export const B_CLOSE = "[[/b]]";

const TOKEN_RE = /(\[\[em\]\]|\[\[\/em\]\]|\[\[b\]\]|\[\[\/b\]\])/g;

export function stripEmphasisMarkers(value: string) {
  return value.replace(TOKEN_RE, "");
}

/** 줄 사이로 이어지는 강조 상태(여러 줄에 걸친 빨간 블록 등)를 추적한다. */
export interface EmphasisState {
  red: number;
  bold: number;
}

export interface EmphasisSegment {
  text: string;
  red: boolean;
  bold: boolean;
}

export function createEmphasisState(): EmphasisState {
  return { red: 0, bold: 0 };
}

/**
 * 한 줄을 마커 기준 세그먼트로 분해한다. state는 호출 순서대로 이어 쓰며
 * (여러 줄에 걸친 강조 지원), 인접한 같은 스타일 세그먼트는 병합한다.
 */
export function tokenizeEmphasisLine(line: string, state: EmphasisState): EmphasisSegment[] {
  const segments: EmphasisSegment[] = [];

  for (const part of line.split(TOKEN_RE)) {
    if (part === EM_OPEN) state.red += 1;
    else if (part === EM_CLOSE) state.red = Math.max(0, state.red - 1);
    else if (part === B_OPEN) state.bold += 1;
    else if (part === B_CLOSE) state.bold = Math.max(0, state.bold - 1);
    else if (part) segments.push({ text: part, red: state.red > 0, bold: state.bold > 0 });
  }

  return segments.reduce<EmphasisSegment[]>((merged, segment) => {
    const last = merged[merged.length - 1];
    if (last && last.red === segment.red && last.bold === segment.bold) {
      last.text += segment.text;
    } else {
      merged.push({ ...segment });
    }
    return merged;
  }, []);
}

/** 세그먼트 앞머리에서 목록 기호(□, -, ※ 등)를 제거한다. */
export function stripLeadingMarker(segments: EmphasisSegment[], markerRe: RegExp): EmphasisSegment[] {
  const result = segments.map((segment) => ({ ...segment }));
  for (const segment of result) {
    if (!segment.text.trim()) continue;
    segment.text = segment.text.replace(markerRe, "");
    break;
  }
  return result.filter((segment) => segment.text.length > 0);
}

export function segmentsToText(segments: EmphasisSegment[]) {
  return segments.map((segment) => segment.text).join("");
}
