import assert from "node:assert/strict";
import test from "node:test";
import { parseXmlItems } from "./util";

test("parses XML CDATA and preserves repeated attachment tags", () => {
  const items = parseXmlItems(`
    <response><body><items><item>
      <itemId>123</itemId>
      <title><![CDATA[2026년 지원사업 &amp; 모집]]></title>
      <dataContents><![CDATA[<p>지원 <strong>내용</strong></p>]]></dataContents>
      <fileName><![CDATA[안내문.pdf]]></fileName>
      <fileUrl><![CDATA[https://www.mss.go.kr/files/1]]></fileUrl>
      <fileName><![CDATA[신청서.hwp]]></fileName>
      <fileUrl><![CDATA[https://www.mss.go.kr/files/2]]></fileUrl>
    </item></items></body></response>
  `);

  assert.equal(items.length, 1);
  assert.equal(items[0].title, "2026년 지원사업 & 모집");
  assert.equal(items[0].dataContents, "<p>지원 <strong>내용</strong></p>");
  assert.deepEqual(items[0].fileName, ["안내문.pdf", "신청서.hwp"]);
  assert.deepEqual(items[0].fileUrl, [
    "https://www.mss.go.kr/files/1",
    "https://www.mss.go.kr/files/2",
  ]);
});
