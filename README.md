# 정부지원AI비서 — 정부지원사업 공고 통합 조회서비스 (MVP)

Next.js 14(App Router) + Supabase + Vercel. Android WebView는 `/app` 경로를 로드합니다.

## 구조

```
lib/ingest/adapters/   ← 소스별 수집기 (fetch + normalize만 담당)
lib/ingest/run.ts      ← 공통 저장: 카테고리 매핑 → content_hash → upsert
lib/query/             ← DB 조회 (announcements_public 뷰 = 중복 제거된 목록)
app/(web)/             ← PC 홈페이지 (/)
app/app/               ← 모바일 WebView 전용 UI (/app)
app/api/               ← ingest(수집), announcements(조회), leads, events
supabase/schema.sql    ← Supabase SQL Editor에서 실행
android/               ← Kotlin WebView 앱 (FCM·공유 네이티브, android/README.md 참고)
```

## 시작하기

> **DB 없이 UI만 개발하려면**: `.env.local`에 `NEXT_PUBLIC_USE_MOCK=true`만 있으면
> `lib/query/fixtures.ts`의 목업 40건으로 전체 UI가 동작합니다 (Supabase 키 불필요).
> Supabase 연결 후에는 `false`로 바꾸거나 줄을 삭제하세요.

1. **Supabase**: 프로젝트 생성 → SQL Editor에서 `supabase/schema.sql` 전체 실행
2. **환경변수**: `.env.example`을 `.env.local`로 복사 후 값 채우기
   - `DATA_GO_KR_KEY`는 공공데이터포털 **Decoding 키** 사용 (URL 인코딩은 코드가 처리)
3. `npm install && npm run dev`
4. **수집 실행**:
   ```bash
   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
     "http://localhost:3000/api/ingest?source=bizinfo"
   ```
5. http://localhost:3000 (PC) / http://localhost:3000/app (모바일)

## ⚠️ 배포 전 반드시 할 일: 어댑터 필드 확정

공공데이터포털 API는 **문서와 실제 응답 필드명이 다른 경우가 많습니다.**
각 어댑터의 엔드포인트/필드명은 후보값으로 작성되어 있으므로, API별로 아래처럼
실제 응답 1페이지를 받아 확인 후 어댑터 상단의 ENDPOINT와 `pick()` 후보 목록을 확정하세요.

```bash
curl "https://apis.data.go.kr/.../오퍼레이션?serviceKey=키&pageNo=1&numOfRows=3&type=json"
```

- 엔드포인트는 `.env.local`의 `BIZINFO_ENDPOINT` 등으로 코드 수정 없이 교체 가능
- `raw_json`에 원본이 통째로 저장되므로 매핑이 틀려도 데이터 유실 없이 재파싱 가능

## 수집 파이프라인

- 소스 내 중복: `(source_id, source_key)` unique 제약 + upsert
- 소스 간 중복: `content_hash`(정규화된 제목+기관+마감일 sha256)로 탐지,
  삭제하지 않고 `announcements_public` 뷰에서 대표 1건만 노출 (source_id 오름차순 우선)
- 상세 원문: 목록 upsert 후 신규·API payload 변경 공고만 공식 원문 페이지를 추가 호출
  - 소스별 기본 8건, 동시 3건, 요청 15초·응답 2MB·본문 20만 자 제한
  - 본문 텍스트는 `detail_content`, 첨부파일은 본체가 아닌 `label/url`만 저장
  - `DETAIL_FETCH_LIMIT_PER_SOURCE`로 0~20 범위 조정 가능
  - 상세 컬럼이 아직 없으면 상세 단계만 건너뛰므로 기존 목록 수집은 중단되지 않음
- 행안부(mois) 어댑터는 개인 혜택 제외: 기업 키워드 미포함 항목은 normalize에서 스킵
- Vercel Cron: 매일 KST 06:00 (`vercel.json`). Hobby 플랜은 실행시간 제한이 있으므로
  느리면 `?source=bizinfo`처럼 소스별 분할 호출로 전환

## 보안

- `DATA_GO_KR_KEY`, `BIZINFO_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`은 서버 전용 (NEXT_PUBLIC_ 금지)
- 클라이언트는 anon 키만 사용, RLS로 announcements/categories SELECT만 허용
- `expert_leads`/`announcement_events`는 RLS 정책 없음 = API Route(service_role) 경유로만 쓰기
- 전문가 상담은 `EXPERT_CONSULTATION_ENABLED=true`일 때만 UI와 API가 열리며 기본값은 비활성화

## 상세 원문 저장 적용

배포 전에 Supabase SQL Editor에서
`supabase/migrations/20260712_add_announcement_details.sql`을 한 번 실행합니다.
마이그레이션 후 다음 Cron부터 신규·변경 공고 상세가 점진적으로 백필됩니다.

## 남은 일 (MVP 범위 밖)

- [x] 개인정보처리방침 페이지 (`/privacy`, `/terms`) — ⚠️ 초안, 법률 검토 필요
- [x] Android WebView 래핑 + FCM 브릿지 골격 (`android/`)
- [ ] mois 어댑터 필터 통과율 로그 확인 후 활성화 판단
- [ ] 검색 품질 개선 (pg_trgm → 필요 시 형태소 검색)
