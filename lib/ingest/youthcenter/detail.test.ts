import assert from "node:assert/strict";
import test from "node:test";
import {
  parseYouthCenterDetailPayload,
  youthCenterDetailSourceHash,
} from "./detail";

const SOURCE_KEY = "20260725005400219999";

test("official YouthCenter payload becomes full visible detail text", () => {
  const detail = parseYouthCenterDetailPayload(
    SOURCE_KEY,
    {
      result: {
        plcy: {
          plcyNo: SOURCE_KEY,
          plcyAprvSttsCd: "0044002",
          plcyExplnCn: "청년의 취업 준비를 지원합니다.",
          plcySprtCn: "교육비와 면접 준비 비용을 지원합니다.<br>전문 상담 포함",
          bizPrdSeCd: "0056001",
          bizPrdBgngYmd: "20260701",
          bizPrdEndYmd: "20261231",
          aplyPrdSeCd: "0057001",
          aplyPrdBgngYmd: "20260710",
          aplyPrdEndYmd: "20260810",
          sprtSclLmtYn: "N",
          sprtSclCnt: 100,
          sprtArvlSeqYn: "Y",
          sprtTrgtAgeLmtYn: "N",
          sprtTrgtMinAge: 19,
          sprtTrgtMaxAge: 39,
          mrgSttsCd: "0055003",
          habRgnList: [
            {
              stdgCtpvCdNm: "서울특별시",
              stdgSggCdNm: "마포구",
            },
          ],
          earnCndSeCd: "0043001",
          qlfcAcbgList: [{ qlfcAcbgCdNm: "제한없음" }],
          mjrCndList: [{ mjrCndCdNm: "제한없음" }],
          empmSttsList: [{ empmSttsCdNm: "미취업자" }],
          spclFldList: [{ spclFldCdNm: "제한없음" }],
          addAplyQlfcCndCn: "서울 거주 청년",
          ptcpPrpTrgtCn: "동일 사업 참여자",
          plcyAplyMthdCn: "온라인 신청",
          srngMthdCn: "서류 심사",
          sbmsnDcmntCn: "신청서, 주민등록초본",
          etcMttrCn: "세부 일정은 운영기관 안내를 따릅니다.",
          sprvsnInstCdNm: "서울특별시",
          sprvsnInstPicTelno: "02-0000-0000",
          operInstCdNm: "서울청년센터",
          refUrlAddr1: "https://example.go.kr/policy",
          frstRegDt: "2026-07-01 09:00:00",
          lastMdfcnDt: "2026-07-25 12:30:00",
        },
      },
    },
    {
      result: {
        atchFileDetList: [
          {
            atchFileMngSn: "20457",
            atchFileSn: "1009476",
            exsFileNm: "공고문.pdf",
          },
        ],
      },
    },
  );

  assert.match(detail.detailContent, /\[정책 설명\]/);
  assert.match(detail.detailContent, /\[지원 내용\]/);
  assert.match(detail.detailContent, /전문 상담 포함/);
  assert.match(detail.detailContent, /\[신청 자격\]/);
  assert.match(detail.detailContent, /거주 지역: 서울특별시 마포구/);
  assert.match(detail.detailContent, /\[신청 방법\]\n온라인 신청/);
  assert.match(detail.detailContent, /\[제출 서류\]\n신청서, 주민등록초본/);
  assert.equal(detail.applyMethod, "온라인 신청");
  assert.equal(detail.documents, "신청서, 주민등록초본");
  assert.equal(detail.attachments.length, 1);
  assert.equal(
    detail.attachments[0].url,
    "https://www.youthcenter.go.kr/sur/com/atchFile/atchFileDetInfo/20457/1009476",
  );
});

test("YouthCenter source hash is stable and parser-versioned", () => {
  assert.equal(
    youthCenterDetailSourceHash({ b: 2, a: 1 }),
    youthCenterDetailSourceHash({ a: 1, b: 2 }),
  );
  assert.notEqual(
    youthCenterDetailSourceHash({ a: 1 }),
    youthCenterDetailSourceHash({ a: 2 }),
  );
});

test("mismatched official policy identifiers are rejected", () => {
  assert.throws(
    () =>
      parseYouthCenterDetailPayload(SOURCE_KEY, {
        result: {
          plcy: {
            plcyNo: "different-policy",
            plcyAprvSttsCd: "0044002",
            plcySprtCn: "지원 내용",
          },
        },
      }),
    /did not match/,
  );
});
