import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://aisup.co.kr"),
  title: {
    default: "정부지원AI비서 — 정부지원사업 공고 통합조회",
    template: "%s | 정부지원AI비서",
  },
  description:
    "K-Startup, 기업마당, 정부24, 온통청년 등 정부지원사업 공고를 한곳에서 검색하고 맞춤 추천으로 확인하세요.",
  verification: {
    google: "tZoiehWyGSoO18p45gTO4SNGiYgswyinua8KcLyFwB4",
    other: {
      "naver-site-verification": "eba4874cdaffbf802ae8aa98d26fc09cc2228c78",
    },
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "정부지원AI비서",
    title: "정부지원AI비서 — 정부지원사업 공고 통합조회",
    description:
      "정부지원사업 공고를 통합 검색하고 나에게 맞는 공고를 추천받으세요.",
    url: "/",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
