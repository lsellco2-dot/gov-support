type BannerPath = "/app" | "/app/announcements" | "/app/recommendations" | "/app/favorites";

// 화면 경로와 콘텐츠 상태만 전달한다. 사용자 조건이나 공고 데이터는 광고 SDK로 보내지 않는다.
export function nativeBannerAttributes(path: BannerPath, state: string, itemCount = 1) {
  const minimum = path === "/app/announcements" ? 4 : 1;
  return {
    "data-native-banner-path": path,
    "data-native-banner-ready": state === "ready" && itemCount >= minimum ? "true" : "false",
  } as const;
}
