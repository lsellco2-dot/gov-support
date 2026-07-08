import Link from "next/link";

// Android WebView가 로드하는 모바일 전용 레이아웃
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-md bg-[var(--bg)] pb-16">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex h-12 items-center justify-center">
          <Link href="/app" className="text-base font-bold text-primary">
            정부지원비서
          </Link>
        </div>
      </header>
      <main className="px-3 py-4">
        {children}
        <footer className="mt-8 pb-2 text-center text-[11px] text-slate-400">
          <Link href="/privacy" className="underline-offset-2 hover:underline">
            개인정보처리방침
          </Link>
          <span className="mx-2">·</span>
          <Link href="/terms" className="underline-offset-2 hover:underline">
            이용약관
          </Link>
        </footer>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex h-14 max-w-md items-stretch border-t border-slate-200 bg-white">
        <Link href="/app" className="flex flex-1 items-center justify-center text-sm font-semibold text-primary">
          공고
        </Link>
        <Link href="/app?status=open&sort=deadline" className="flex flex-1 items-center justify-center text-sm text-slate-500">
          마감임박
        </Link>
      </nav>
    </div>
  );
}
