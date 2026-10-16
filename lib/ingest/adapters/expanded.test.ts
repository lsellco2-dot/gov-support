import assert from "node:assert/strict";
import test from "node:test";
import { bokjiCentral, bokjiLocal } from "./bokji";
import { enara } from "./enara";
import { culture, parseCultureList } from "./culture";
import { explicitRegion, parseServiceXml } from "./public-service";
import { runIngest, toRow } from "../run";
import { moisBenefit } from "./mois-benefit";

test("복지로 목록은 생애주기를 신청자격이나 모집기간으로 단정하지 않는다", () => {
  const item = bokjiCentral.normalize({ servId: "test", servNm: "교육비 지원", lifeArray: "청년", servDgst: "교육 지원", jurMnofNm: "교육부", servDtlLink: "https://www.bokjiro.go.kr/test", enfcEndYmd: "20261231" });
  assert.equal(item?.target, null);
  assert.equal(item?.region, "미확인");
  assert.equal(item?.applyEnd, null);
  assert.equal(item?.detailUrl, "https://www.bokjiro.go.kr/test");
});

test("재수집 목록은 상세 API로 확보한 지원대상·본문을 덮어쓰지 않는다", () => {
  const item = bokjiCentral.normalize({ servId: "test", servNm: "교육비 지원" })!;
  const row = toRow(item, 99);
  assert.equal(Object.hasOwn(row, "target"), false);
  assert.equal(Object.hasOwn(row, "detail_content"), false);
  assert.equal(row.source_id, 99);
});

test("정부24 API 상세를 기존 DB 상세 칼럼으로 저장한다", () => {
  const item = moisBenefit.normalize({ 서비스ID: "test", 서비스명: "돌봄 지원", 지원내용: "방문 돌봄 서비스", 신청방법: "주민센터 방문", 전화문의: "공식 상담센터" })!;
  const row = toRow(item, 4);
  assert.match(row.detail_content ?? "", /방문 돌봄/);
  assert.equal(row.apply_method, "주민센터 방문");
  assert.equal(row.detail_fetch_status, "success");
  assert.ok(row.detail_source_hash);
});
test("복지로 지자체의 명시적 시도와 잘못된 링크 처리", () => {
  const item = bokjiLocal.normalize({ servId: "test", servNm: "주민 돌봄 지원", ctpvNm: "경상북도", servDtlLink: "javascript:alert(1)" });
  assert.equal(item?.region, "경북");
  assert.equal(item?.detailUrl, null);
  assert.equal(explicitRegion("전남광주통합특별시"), "전남광주통합특별시");
  assert.equal(explicitRegion("광주시"), "미확인");
});
test("XML API 오류와 구조 변경은 빈 성공으로 처리하지 않는다", () => {
  assert.throws(() => parseServiceXml("<resultCode>30</resultCode>", "servList"));
  assert.throws(() => parseServiceXml("<html>서비스 점검</html>", "servList"));
  const parsed = parseServiceXml("<wantedList><resultCode>0</resultCode><totalCount>1</totalCount><servList><servId>A1</servId><servNm><![CDATA[교육 & 복지]]></servNm></servList></wantedList>", "servList");
  assert.equal(parsed.total, 1);
  assert.equal(parsed.items[0].servNm, "교육 & 복지");
});
test("e나라도움의 이스케이프된 CDATA도 제목·날짜·원문 URL로 정규화한다", () => {
  const xml = `<response><resultCode>00</resultCode><totalCount>1</totalCount><item><PBLANC_NM>&lt;![CDATA[주민 동아리 공모]]&gt;</PBLANC_NM><PBLANC_POPUP_URL>&lt;![CDATA[https://www.bojo.go.kr/call?id=test]]&gt;</PBLANC_POPUP_URL><RCEPT_END_DE>&lt;![CDATA[20261101]]&gt;</RCEPT_END_DE></item></response>`;
  const item = enara.normalize(parseServiceXml(xml, "item").items[0]);
  assert.equal(item?.title, "주민 동아리 공모");
  assert.equal(item?.applyEnd, "2026-11-01");
  assert.equal(item?.detailUrl, "https://www.bojo.go.kr/call?id=test");
});

test("e나라도움 공고명 필터와 동일 공고 중복 제거", async t => {
  const urls: URL[] = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    urls.push(new URL(String(input)));
    const item = `<item><PBLANC_NM>공모</PBLANC_NM><PBLANC_POPUP_URL>https://www.bojo.go.kr/call?id=test</PBLANC_POPUP_URL></item>`;
    return new Response(`<response><resultCode>00</resultCode><totalCount>2</totalCount>${item}${item}</response>`);
  });
  let count = 0;
  for await (const page of enara.fetchPages({ serviceKey: "fixture" })) count += page.length;
  assert.equal(count, 1);
  assert.equal(urls.length, 2);
  for (const url of urls) assert.equal(url.searchParams.get("pblanc_nm"), "%");
});
const grant = {
  PBLANC_NM: "비영리단체 공익활동 공모", PBLANC_POPUP_URL: "https://www.bojo.go.kr/call?id=example",
  DLVPL_NM: "서울 소재 기관", CTPRVN_NM: "서울특별시", RCEPT_BEGIN_DE: "20261001", RCEPT_END_DE: "20261101",
  BSNS_END_DE: "20271231", SPORT_TRGET_CN: "비영리 민간단체", SPORT_CN_DC: "공익활동 지원",
  REQST_RCEPT_MTH_CN: "공식 홈페이지 신청",
};
test("e나라도움은 접수기간만 사용하고 기관 소재지는 지원지역으로 단정하지 않는다", () => {
  const item = enara.normalize(grant);
  assert.equal(item?.region, "미확인");
  assert.equal(item?.applyStart, "2026-10-01");
  assert.equal(item?.applyEnd, "2026-11-01");
  assert.match(item?.detail?.detailContent ?? "", /비영리 민간단체/);
  assert.equal(item?.detail?.applyMethod, "공식 홈페이지 신청");
  assert.equal(enara.normalize({ ...grant, PBLANC_NM: "" }), null);
  assert.equal(enara.normalize({ ...grant, PBLANC_POPUP_URL: "https://example.com" }), null);
  assert.equal(enara.normalize({ ...grant, SPORT_CN_DC: "내용 갱신" })?.sourceKey, item?.sourceKey);
});

test("신규 출처 저장 계약: 동적 ID, 상세 보존, 중복 방지, 삭제 없음", async t => {
  const env = { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "fixture", DATA_GO_KR_KEY: "fixture", INGEST_ENARA_ENABLED: "true", DETAIL_FETCH_LIMIT_PER_SOURCE: "0" };
  const before = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  const writes: { path: string; body: any }[] = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.notEqual(init?.method, "DELETE");
    if (url.hostname === "apis.data.go.kr") {
      const xml = Object.entries({ ...grant, RCEPT_END_DE: "20991231" }).map(([key, value]) => `<${key}><![CDATA[${value}]]></${key}>`).join("");
      return new Response(`<response><resultCode>00</resultCode><totalCount>1</totalCount><item>${xml}</item></response>`);
    }
    assert.equal(url.hostname, "example.supabase.co");
    if (init?.method === "POST" || init?.method === "PATCH") {
      writes.push({ path: url.pathname, body: JSON.parse(String(init.body)) });
      return url.pathname.endsWith("ensure_source_by_code") ? new Response("90") : new Response(null, { status: 204 });
    }
    return new Response("[]");
  });
  try {
    const [result] = await runIngest(["enara"]);
    assert.equal(result.error, undefined);
    assert.equal(result.upserted, 1);
    assert.equal(result.failed, 0);
    const allocation = writes.find(write => write.path.endsWith("ensure_source_by_code"));
    assert.equal(allocation?.body.p_code, "enara");
    const row = writes.find(write => write.path.endsWith("/announcements"))?.body[0];
    assert.equal(row.source_id, 90);
    assert.equal(row.region, "미확인");
    assert.equal(row.apply_method, "공식 홈페이지 신청");
    assert.ok(row.detail_content);
    assert.equal(row.detail_fetch_status, "success");
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
test("문화포털은 공고 목록의 사실 필드와 원문 링크만 수집한다", () => {
  const html = `<div id="result_rcrtinfo"><ul><li><a class="logo">문화재단</a><a class="tit" href="/portal/cltBnf/cltSup/view.do?rcrtSn=123&viewTp=2"><span class="tit__title">생활문화 동아리 지원</span><span class="support-txt">기업·단체</span></a><div class="badge-box">공간지원</div><div class="d-day"><span class="num">2026-11-01</span></div></li></ul></div><div class="pagination-set"><a href="javascript:fnSearch(3)">3</a></div>`;
  const parsed = parseCultureList(html);
  assert.equal(parsed.lastVisiblePage, 3);
  assert.equal(parsed.items.length, 1);
  const item = culture.normalize(parsed.items[0]);
  assert.equal(item?.applyEnd, "2026-11-01");
  assert.equal(item?.region, "미확인");
  assert.equal(item?.detail, undefined);
  assert.match(item?.detailUrl ?? "", /rcrtSn=123/);
  assert.throws(() => parseCultureList("<html>점검중</html>"));
});
test("복지로 상세조회는 지원대상을 보존하고 시행종료일을 접수마감일로 쓰지 않는다", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response(`<root><resultCode>0</resultCode><servId>test</servId><sprtTrgtCn>주민 동아리</sprtTrgtCn><alwServCn>공간 제공</alwServCn><aplyMtdCn>주민센터 신청</aplyMtdCn><enfcEndYmd>20261231</enfcEndYmd></root>`));
  const before = process.env.BOKJI_LOCAL_API_KEY;
  process.env.BOKJI_LOCAL_API_KEY = "fixture-not-a-real-key";
  try {
    const item = bokjiLocal.normalize({ servId: "test", servNm: "공간 지원" })!;
    const detail = await bokjiLocal.fetchDetail!(item);
    assert.equal(detail.target, "주민 동아리");
    assert.equal(detail.applyMethod, "주민센터 신청");
    assert.equal(item.applyEnd, null);
  } finally {
    if (before === undefined) delete process.env.BOKJI_LOCAL_API_KEY;
    else process.env.BOKJI_LOCAL_API_KEY = before;
  }
});
