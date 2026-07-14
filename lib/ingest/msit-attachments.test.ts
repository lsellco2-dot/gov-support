import assert from "node:assert/strict";
import test from "node:test";
import { load } from "cheerio";
import {
  buildMsitSessionDownloadUrl,
  extractMsitAttachments,
  extractMsitSessionId,
  normalizeMsitAttachmentProxyUrl,
  pageContainsMsitAttachment,
  parseMsitDownloadInvocation,
} from "./msit-attachments";

const SAMPLE_HTML = `
  <ul class="down_file">
    <li>
      <a class="ico_file_hwpx">첨부1. 2026년 AI중심대학 공고문.hwpx</a>
      <span class="down_btn">
        <a href="javascript:void(0);" onclick="fn_download('54411', '1', 'hwpx')">다운로드</a>
      </span>
    </li>
    <li>
      <a class="ico_file_hwpx">첨부2. 신청안내서.hwpx</a>
      <span class="down_btn">
        <a href="javascript:void(0);" onclick="fn_download('54411','2','hwpx')">바로보기</a>
      </span>
    </li>
  </ul>
`;

test("extractMsitAttachments converts MSIT JavaScript downloads to safe proxy links", () => {
  const $ = load(SAMPLE_HTML);
  const links = extractMsitAttachments(
    $,
    new URL("https://www.msit.go.kr/bbs/view.do?nttSeqNo=3186813")
  );

  assert.deepEqual(links, [
    {
      label: "첨부1. 2026년 AI중심대학 공고문.hwpx",
      url: "/api/attachments/msit?nttSeqNo=3186813&atchFileNo=54411&fileOrd=1",
    },
    {
      label: "첨부2. 신청안내서.hwpx",
      url: "/api/attachments/msit?nttSeqNo=3186813&atchFileNo=54411&fileOrd=2",
    },
  ]);
});

test("MSIT attachment inputs reject malformed or external values", () => {
  assert.equal(parseMsitDownloadInvocation("alert('x')"), null);
  assert.equal(
    normalizeMsitAttachmentProxyUrl(
      "/api/attachments/msit?nttSeqNo=3186813&atchFileNo=54411&fileOrd=1"
    ),
    "/api/attachments/msit?nttSeqNo=3186813&atchFileNo=54411&fileOrd=1"
  );
  assert.equal(
    normalizeMsitAttachmentProxyUrl(
      "/api/attachments/msit?nttSeqNo=bad&atchFileNo=54411&fileOrd=1"
    ),
    null
  );
  assert.equal(normalizeMsitAttachmentProxyUrl("https://example.com/file"), null);
});

test("MSIT download redirect is limited to an attachment present on the detail page", () => {
  assert.equal(pageContainsMsitAttachment(SAMPLE_HTML, "54411", "2"), true);
  assert.equal(pageContainsMsitAttachment(SAMPLE_HTML, "54411", "9"), false);
  assert.equal(
    extractMsitSessionId("JSESSIONID=ABCDEF12-3456; Path=/; Secure", ""),
    "ABCDEF12-3456"
  );

  const url = buildMsitSessionDownloadUrl("ABCDEF12-3456", "54411", "2");
  assert.equal(url.hostname, "www.msit.go.kr");
  assert.equal(url.pathname, "/ssm/file/fileDown.do;jsessionid=ABCDEF12-3456");
  assert.equal(url.searchParams.get("atchFileNo"), "54411");
  assert.equal(url.searchParams.get("fileOrd"), "2");
  assert.equal(url.searchParams.get("fileBtn"), "A");
});
