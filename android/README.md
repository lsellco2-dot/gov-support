# 정부지원비서 — Android WebView 앱

Next.js 웹의 `/app` 경로를 감싸는 Kotlin WebView 앱입니다.
네이티브 기능은 **푸시(FCM)** 와 **공유 인텐트** 2개 (Google Play 최소기능 정책 대비).

## 구조

```
android/
  app/src/main/java/com/govsupport/app/
    MainActivity.kt          ← WebView + 뒤로가기 + Custom Tab + 알림 권한
    WebAppBridge.kt          ← JS 브릿지 전체 (Flutter 전환 시 이 파일의 계약만 재구현)
    fcm/AppMessagingService.kt ← FCM 수신 골격
  app/google-services.json   ← ★ Firebase 콘솔에서 받아 여기에 배치 (gitignore됨)
```

## 실행 (debug)

1. PC에서 웹 서버 실행: `npm run dev` (프로젝트 루트)
2. Android Studio로 `android/` 폴더 열기 → Gradle Sync
   - Gradle wrapper가 없다고 나오면 Android Studio가 생성해 주는 기본값 사용 (또는 `gradle wrapper --gradle-version 8.9`)
3. 에뮬레이터에서 Run — debug 빌드는 `http://10.0.2.2:3000/app` 로드
   (`10.0.2.2` = 에뮬레이터에서 보는 호스트 PC의 localhost)
   - **실기기**로 테스트하려면 PC IP로 BASE_URL을 바꾸고 `network_security_config.xml`에 해당 IP 추가

## BASE_URL

`app/build.gradle.kts`의 `buildConfigField`:

| 빌드 | BASE_URL |
|---|---|
| debug | `http://10.0.2.2:3000/app` |
| release | `https://REPLACE-WITH-PRODUCTION-DOMAIN.com/app` ← **배포 전 교체** |

## Firebase(FCM) 설정 순서

지금은 `google-services.json`이 없어도 빌드됩니다 (플러그인을 조건부 적용,
런타임에도 `FirebaseApp.getApps()` 확인 후 스킵). 푸시를 켜려면:

1. [Firebase 콘솔](https://console.firebase.google.com) → 프로젝트 추가 (Google 애널리틱스는 선택)
2. 프로젝트 개요 → **Android 앱 추가**
   - 패키지 이름: `com.govsupport.app` (`app/build.gradle.kts`의 `applicationId`와 **정확히 일치**해야 함.
     패키지명을 바꿀 예정이면 먼저 바꾸고 등록할 것)
3. **google-services.json 다운로드** → `android/app/google-services.json` 위치에 복사
4. Android Studio에서 Gradle Sync → 다시 빌드 (이제 google-services 플러그인이 자동 적용됨)
5. 앱 실행 → API 33+ 기기는 알림 권한 팝업 허용
6. 테스트 발송: Firebase 콘솔 → Messaging → 첫 번째 캠페인 → Firebase 알림 메시지
   - 또는 서버(FCM HTTP v1 API)에서 **data 메시지**로 발송 권장:
     ```json
     { "message": { "token": "<기기토큰>",
       "data": { "title": "마감 임박", "body": "스마트공장 지원사업 D-3", "path": "/app/announcements/1" } } }
     ```
   - `path`를 넣으면 알림 탭 시 해당 공고 상세로 이동

기기 토큰 확인: 웹 콘솔에서 `GovSupportNative.getFcmToken()` 실행 (아래 브릿지 계약 참고).

## JS 브릿지 계약 (WebAppBridge.kt)

웹 → 네이티브:
```js
// Android WebView 안에서만 존재. 웹은 항상 존재 여부를 확인하고 호출할 것.
if (window.GovSupportNative) {
  GovSupportNative.share("공고 제목", "https://.../announcements/1"); // 공유 시트
  GovSupportNative.openExternal("https://www.bizinfo.go.kr/...");     // Custom Tab
  const token = GovSupportNative.getFcmToken();                        // "" = 미발급
}
```

네이티브 → 웹:
```js
window.addEventListener("govsupport:fcmToken", (e) => {
  console.log("FCM token:", e.detail.token);
  // TODO: 서버에 토큰 등록
});
```

외부 링크 처리: 웹에서 브릿지를 호출하지 않아도, WebView 도메인 밖으로 나가는
모든 http(s) 내비게이션은 자동으로 Chrome Custom Tab으로 열립니다
(`MainActivity`의 `shouldOverrideUrlLoading`).

## 릴리즈 전 체크리스트

- [ ] `applicationId`를 실제 소유 도메인 기반으로 변경 (변경 시 Firebase 앱 재등록)
- [ ] release `BASE_URL`을 실서비스 도메인으로 교체
- [ ] 서명 키 생성 + `signingConfig` 설정
- [ ] 정식 런처 아이콘으로 교체 (현재는 임시 체크 아이콘)
- [ ] 웹 `/app` 상세 페이지에 공유 버튼 추가 (`GovSupportNative.share` 호출)
- [ ] Play Console 데이터 보안 섹션 작성 (수집 항목: 이름·연락처 — 개인정보처리방침 URL 필요)
