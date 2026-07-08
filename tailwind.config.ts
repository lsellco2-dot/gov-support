import type { Config } from "tailwindcss";

// 색상 팔레트는 KRDS(디지털 정부서비스 UI/UX 가이드라인) 토큰을 참고해 재구성.
// KRDS 코드를 직접 가져오지 않고, 색상 값만 본 프로젝트 토큰 이름에 매핑했다.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 본문 텍스트 (KRDS gray-90)
        ink: "#1E2124",
        // 정부 블루 = "행동의 색" (KRDS primary). action/hover/subtle bg
        primary: {
          DEFAULT: "#256EF4",
          dark: "#0B50D0",
          light: "#ECF2FE",
        },
        // semantic
        urgent: "#DE3412", // danger
        open: "#228738", // success
        info: "#0B78CB",
        point: "#D63D4A", // 강조 포인트(뱃지 등)
        // 경계/보조 텍스트 (KRDS gray)
        line: "#D2D5D9",
        subtle: "#464C53",
      },
      borderRadius: {
        // KRDS: 버튼 6 / 입력·카드 8 / 뱃지 4 / 모달 12
        badge: "4px",
      },
    },
  },
  plugins: [],
};
export default config;
