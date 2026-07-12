import { Fragment } from "react";

/*
  저장된 원문 텍스트(detail_content 등)를 KRDS 톤의 위계로 렌더링한다.
  - 원문을 요약·재배열하지 않고 줄 순서 그대로, 스타일만 입힌다.
  - 감지 규칙(화이트리스트 아님 — 어떤 줄도 누락되지 않는다):
    · 빈 줄 뒤의 짧은 명사형 줄 → 섹션 제목
    · 섹션 제목 바로 아래의 짧은 줄 → 소제목(또는 라벨의 값)
    · □ ■ ○ ▶ 시작 → 항목 제목 / - · • ㆍ 시작 → 목록 / ※ ☞ 시작 → 비고
    · 그 외 → 본문 문단 (URL은 링크로)
*/

type LineNode = {
  kind: "heading" | "subheading" | "item" | "bullet" | "note" | "paragraph";
  text: string;
};

const TITLE_MAX_LENGTH = 22;

function isTitleCandidate(line: string) {
  if (line.length < 2 || line.length > TITLE_MAX_LENGTH) return false;
  if (/[.:,?!~]$/.test(line)) return false;
  if (/(습니다|합니다|주세요|바랍니다|하세요)$/.test(line)) return false;
  if (/^(해당\s*없음|없음|상시|무료)$/.test(line)) return false;
  if (/https?:\/\//i.test(line)) return false;
  if (/\d{4}[.\-/]\d{1,2}/.test(line)) return false;
  return true;
}

function parseLines(text: string): LineNode[] {
  const lines = text.replace(/[​﻿]/g, "").split("\n");
  const nodes: LineNode[] = [];
  let previousWasEmpty = true;
  let previousKind: LineNode["kind"] | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      previousWasEmpty = true;
      continue;
    }

    let node: LineNode;

    if (/^[※☞]/.test(line)) {
      node = { kind: "note", text: line.replace(/^[※☞]\s*/, "") };
    } else if (/^[□■◎○▶]/.test(line)) {
      node = { kind: "item", text: line.replace(/^[□■◎○▶]\s*/, "") };
    } else if (/^[-·•◦ㆍ]/.test(line)) {
      node = { kind: "bullet", text: line.replace(/^[-·•◦ㆍ]\s*/, "") };
    } else if (isTitleCandidate(line)) {
      const followsTitleDirectly =
        !previousWasEmpty && (previousKind === "heading" || previousKind === "subheading");

      if (previousKind === "item") {
        // □ 항목 바로 아래 나열되는 줄들은 목록 내용으로 본다.
        node = { kind: "paragraph", text: line };
      } else if (followsTitleDirectly) {
        // 제목 바로 아랫줄의 짧은 줄: 소제목이거나 라벨의 값(기관명 등)
        node = { kind: "subheading", text: line };
      } else if (previousWasEmpty && previousKind === "heading") {
        // 제목 → (빈 줄) → 짧은 줄: 라벨-값 구조의 값
        node = { kind: "subheading", text: line };
      } else if (previousWasEmpty || previousKind === null) {
        node = { kind: "heading", text: line };
      } else {
        node = { kind: "paragraph", text: line };
      }
    } else {
      node = { kind: "paragraph", text: line };
    }

    nodes.push(node);
    previousKind = node.kind;
    previousWasEmpty = false;
  }

  return nodes;
}

function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s"'<>]+)/g);
  return (
    <>
      {parts.map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-primary underline underline-offset-2 hover:text-primary-dark"
          >
            {part}
          </a>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        )
      )}
    </>
  );
}

export default function DetailContentBody({ text }: { text: string }) {
  const nodes = parseLines(text);
  if (nodes.length === 0) return null;

  return (
    <div className="text-sm leading-relaxed text-ink">
      {nodes.map((node, index) => {
        if (node.kind === "heading") {
          return (
            <div
              key={index}
              className="mt-6 flex items-center gap-2 border-t border-line pt-5 first:mt-0 first:border-t-0 first:pt-0"
            >
              <span aria-hidden className="h-4 w-[3px] shrink-0 rounded-full bg-primary" />
              <h3 className="text-[15px] font-bold text-ink">{node.text}</h3>
            </div>
          );
        }
        if (node.kind === "subheading") {
          return (
            <p key={index} className="mt-3 font-semibold text-ink">
              {node.text}
            </p>
          );
        }
        if (node.kind === "item") {
          return (
            <p key={index} className="mt-4 flex items-start gap-2 font-semibold text-ink">
              <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-[2px] bg-primary/70" />
              <span>
                <LinkifiedText text={node.text} />
              </span>
            </p>
          );
        }
        if (node.kind === "bullet") {
          return (
            <p key={index} className="mt-1 flex items-start gap-2 pl-1">
              <span aria-hidden className="mt-[9px] h-[3px] w-[7px] shrink-0 rounded-full bg-line" />
              <span className="min-w-0">
                <LinkifiedText text={node.text} />
              </span>
            </p>
          );
        }
        if (node.kind === "note") {
          return (
            <p key={index} className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-[13px] text-subtle">
              ※ <LinkifiedText text={node.text} />
            </p>
          );
        }
        return (
          <p key={index} className="mt-1 break-words">
            <LinkifiedText text={node.text} />
          </p>
        );
      })}
    </div>
  );
}
