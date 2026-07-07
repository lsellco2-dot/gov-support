import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "지원사업 한곳에 — 정부지원사업 공고 통합조회",
  description:
    "중기부·창진원·행안부·과기부의 정부지원사업 공고를 한곳에서 검색하고 마감일 순으로 확인하세요.",
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
