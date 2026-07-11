import Link from "next/link";

export default function WebLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold text-primary">
            <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm text-white">정</span>
            정부지원AI비서
          </Link>
          <span className="hidden text-xs text-subtle sm:inline">
            중기부 · 창진원 · 행안부 · 과기부 공고 통합조회
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      <footer className="mt-10 border-t border-line bg-white py-6 text-center text-xs text-slate-400">
        <p>본 서비스의 공고 정보는 공공데이터포털(data.go.kr) 공개 API를 통해 수집되었습니다.</p>
        <p className="mt-1">정확한 내용은 반드시 각 공고의 원문을 확인하세요.</p>
        <p className="mt-3 space-x-3">
          <Link href="/privacy" className="text-subtle underline-offset-2 hover:underline">
            개인정보처리방침
          </Link>
          <Link href="/terms" className="text-subtle underline-offset-2 hover:underline">
            이용약관
          </Link>
        </p>
      </footer>
    </div>
  );
}
