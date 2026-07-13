import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalTitle,
  createDuplicateIndex,
  isPreferredSourceDuplicate,
} from "./cross-source-dedup";

test("normalizes punctuation and 년도 variants for exact duplicate matching", () => {
  const index = createDuplicateIndex([
    { title: "[서울] 2026년도 창업 지원사업 모집", applyEnd: "2026-08-01" },
  ]);
  assert.equal(canonicalTitle("서울 2026년 창업지원사업 모집"), "서울2026년창업지원사업모집");
  assert.equal(
    isPreferredSourceDuplicate(
      { title: "서울 2026년 창업지원사업 모집", applyEnd: null },
      index
    ),
    true
  );
});

test("matches conservative fuzzy duplicates but protects different rounds", () => {
  const index = createDuplicateIndex([
    {
      title: "2026년 스마트공장 구축 지원사업 참여기업 모집 공고",
      applyEnd: "2026-08-01",
    },
  ]);

  assert.equal(
    isPreferredSourceDuplicate(
      {
        title: "2026년 스마트공장 구축지원 사업 참여기업 모집",
        applyEnd: "2026-08-01",
      },
      index
    ),
    true
  );
  assert.equal(
    isPreferredSourceDuplicate(
      { title: "2026년 2차 스마트공장 구축 지원사업 참여기업 모집", applyEnd: null },
      index
    ),
    false
  );
});

test("does not fuzzy-match conflicting deadlines or short generic titles", () => {
  const index = createDuplicateIndex([
    { title: "2026년 창업기업 판로지원 참여기업 모집", applyEnd: "2026-08-01" },
    { title: "지원사업 안내", applyEnd: null },
  ]);
  assert.equal(
    isPreferredSourceDuplicate(
      { title: "2026년 창업기업 판로 지원 참여기업 모집 공고", applyEnd: "2026-09-01" },
      index
    ),
    false
  );
  assert.equal(
    isPreferredSourceDuplicate({ title: "지원사업 안내", applyEnd: null }, index),
    false
  );
});
