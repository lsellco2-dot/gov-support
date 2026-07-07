# AGENTS.md — 작업 인수인계 (2026-07-07 기준)

정부지원사업 공고 통합 조회서비스 MVP "지원사업 한곳에".
Next.js 14 App Router + Supabase + Tailwind. `/` = PC 웹, `/app` = Android WebView 전용 UI.
전체 구조와 수집 파이프라인 설명은 `README.md`, Android 앱은 `android/README.md` 참고.

## 현재 상태 (여기서 이어갈 것)

- **앱은 mock 모드로 동작 중**: `.env.local`의 `NEXT_PUBLIC_USE_MOCK=true` →
  `lib/query/fixtures.ts`의 목업 40건으로 전체 UI가 돈다. Supabase 키 불필요.
- **Supabase 새 프로젝트 생성 완료** (리전을 오세아니아→싱가포르/서울로 옮기기 위해 재생성).
  `supabase/schema.sql` 실행까지 완료된 상태.
- **다음 단계 (우선순위 순)**:
  1. `.env.local`에 새 Supabase 프로젝트의 URL/anon/service_role 키 + `DATA_GO_KR_KEY` + `CRON_SECRET` 채우고
     `NEXT_PUBLIC_USE_MOCK=true` 줄 삭제 → dev 서버 재시작
  2. 수집 실행: `curl -X POST -H "Authorization: Bearer <CRON_SECRET>" "http://localhost:3000/api/ingest?source=bizinfo"`
  3. 수집 0건이거나 필드가 비면 **어댑터 필드 확정 작업** (README "배포 전 반드시 할 일" 절 —
     공공데이터포털 API는 문서와 실제 응답 필드명이 다른 경우가 많음.
     `lib/ingest/adapters/*.ts`의 ENDPOINT와 `pick()` 후보를 실제 응답 1페이지 받아서 확정)
  4. Android 첫 빌드: Android Studio로 `android/` 열기 → Gradle Sync (wrapper는 Studio가 생성)
  5. FCM 활성화: Firebase 콘솔에서 `google-services.json` 받아 `android/app/`에 배치 (`android/README.md` 6단계 절차)

## 완료된 작업 이력

### 1. Mock 모드 (DB 없이 UI 개발)
- `lib/query/fixtures.ts` — 목업 40건 (모집중 30·마감 10·상시 5, 9개 카테고리·17개 지역+전국 커버).
  `status`는 apply_end와 오늘 날짜(KST) 비교로 로드 시 자동 계산 → 날짜가 지나도 D-day 배지와 안 어긋남.
- `lib/query/announcements.ts` — `NEXT_PUBLIC_USE_MOCK === "true"`면 `listFromFixtures()`가
  DB 쿼리와 동일한 조건(제목 ilike, category contains, region+전국 포함, status, 마감임박/최신 정렬,
  페이지네이션)을 메모리로 처리. **listAnnouncements/getAnnouncement 시그니처·반환 타입은 DB 모드와 동일 — 변경 금지.**
- `lib/supabase/anon.ts`, `lib/supabase/server.ts` — Proxy 기반 lazy 초기화.
  env 없이 import해도 안 죽고, 실제 사용 시점에 키 없으면 한국어 에러. import하는 쪽은 무수정.
- `app/api/leads/route.ts` — mock 모드면 유효성 검사 후 insert 없이 `{ok:true}` (데모용).
- 로딩/에러 UI: `app/(web)/loading.tsx`·`error.tsx`, `app/app/loading.tsx`·`error.tsx` (스켈레톤 + 다시 시도 버튼).

### 2. 법적 페이지
- `app/(web)/privacy/page.tsx` — 개인정보처리방침 **초안** (수집항목/목적/보유기간/파기/제3자 제공-상담 전문가/권리/보호책임자).
- `app/(web)/terms/page.tsx` — 이용약관 **초안** 7개 조항.
- 둘 다 상단에 초안 배너. ⚠️ **정식 오픈 전 법률 검토 + 보호책임자·사업자 정보 실제 값 기입 필요** (TODO 주석 있음).
- `components/LeadForm.tsx` 동의 문구 → `/privacy` 새 탭 링크. PC 푸터(`app/(web)/layout.tsx`)와
  모바일 푸터(`app/app/layout.tsx`, 하단 탭바 위)에 두 페이지 링크.

### 3. Android WebView 앱 (`android/`)
- Kotlin, minSdk 26, 패키지 `com.govsupport.app` (⚠️ Play 배포 전 실도메인 기반으로 변경 + Firebase 재등록).
- BuildConfig.BASE_URL: debug=`http://10.0.2.2:3000/app`, release=placeholder (교체 필요).
  평문 HTTP는 `network_security_config.xml`로 10.0.2.2에만 허용.
- **JS 브릿지는 `WebAppBridge.kt` 한 파일에 격리** (Flutter 전환 대비, `FcmTokenStore` 포함):
  - 웹→네이티브: `window.GovSupportNative.share(title,url)` / `.openExternal(url)` / `.getFcmToken()`
  - 네이티브→웹: `window.dispatchEvent(new CustomEvent('govsupport:fcmToken', {detail:{token}}))`
  - **이 계약을 바꾸면 웹(components/ShareButton.tsx)과 네이티브 양쪽을 같이 바꿔야 함.**
- FCM: `fcm/AppMessagingService.kt`. `google-services.json` 없어도 빌드됨
  (Gradle에서 파일 존재 시에만 플러그인 적용 + 런타임 `FirebaseApp.getApps()` 가드).
  data 페이로드 `path`(예: `/app/announcements/123`)로 알림 탭→상세 딥링크.
- 뒤로가기=WebView back, 도메인 밖 http(s) 링크=Chrome Custom Tab, tel:/mailto:=시스템 앱.
- 아직 한 번도 빌드 안 됨 (이 PC에 gradle CLI 없음). 첫 빌드는 Android Studio에서.

### 4. 공유 버튼
- `components/ShareButton.tsx` — `/app` 상세 상단에 부착. 폴백 3단계:
  ① `GovSupportNative.share`(WebView) → ② `navigator.share` → ③ 클립보드 복사(+실패 시 prompt).

## 주의사항 / 컨벤션

- 주석·UI 텍스트·커뮤니케이션은 한국어.
- `DATA_GO_KR_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`은 서버 전용 — `NEXT_PUBLIC_` 금지.
- 사용자 화면 조회는 항상 `announcements_public` 뷰 (content_hash 중복 제거 뷰). 원본 테이블 직접 조회 금지.
- `expert_leads`/`announcement_events`는 RLS 정책 없음 = API Route(service_role) 경유로만 쓰기.
- git 저장소 아님 (`git init` 안 된 상태). 버전 관리 시작하려면 init부터.
- 타입 체크: `npx tsc --noEmit`. 테스트 코드는 아직 없음.

## 남은 일 (MVP 범위 밖, README에도 있음)

- [ ] privacy/terms 법률 검토 후 확정
- [ ] mois 어댑터 필터 통과율 로그 확인 후 활성화 판단
- [ ] 검색 품질 개선 (pg_trgm → 필요 시 형태소 검색)
- [ ] Android 릴리즈 체크리스트 (`android/README.md` 하단)
