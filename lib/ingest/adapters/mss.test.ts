import assert from "node:assert/strict";
import test from "node:test";
import { isMssSupportAnnouncement, mss, mssFetchWindow } from "./mss";

test("maps MSS v2 fields and attachments", () => {
  const result = mss.normalize({
    itemId: "MSS-1",
    title: "2026년 중소기업 수출 지원사업 모집공고",
    dataContents: "<p>참여기업을 모집합니다.</p>",
    applicationStartDate: "20260701",
    applicationEndDate: "2026-07-31",
    viewUrl: "https://www.mss.go.kr/site/smba/ex/bbs/View.do?id=1",
    fileName: ["공고문.pdf", "신청서.hwp"],
    fileUrl: [
      "https://www.mss.go.kr/files/1",
      "https://evil.example/files/2",
    ],
  });

  assert.ok(result);
  assert.equal(result.sourceKey, "MSS-1");
  assert.equal(result.organization, "중소벤처기업부");
  assert.equal(result.summary, "참여기업을 모집합니다.");
  assert.equal(result.applyStart, "2026-07-01");
  assert.equal(result.applyEnd, "2026-07-31");
  assert.deepEqual(result.attachments, [
    { label: "공고문.pdf", url: "https://www.mss.go.kr/files/1" },
  ]);
});

test("keeps support announcements and excludes administrative notices", () => {
  assert.equal(
    isMssSupportAnnouncement("2026년 중소기업 기술개발 지원사업", null),
    true
  );
  assert.equal(
    isMssSupportAnnouncement("중소기업 관련 법령 개정 입법예고", "지원사업 안내"),
    false
  );
});

test("uses the current KST year and day for the fetch window", () => {
  assert.deepEqual(mssFetchWindow(new Date("2026-07-12T16:00:00.000Z")), {
    startDate: "2026-01-01",
    endDate: "2026-07-13",
  });
});
