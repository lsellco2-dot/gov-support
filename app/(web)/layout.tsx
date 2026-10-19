import AuthControl from "@/components/AuthControl";
import OperatorInfo from "@/components/OperatorInfo";
import { getCurrentAdminAccess } from "@/lib/admin/auth";
import Link from "next/link";

export default async function WebLayout({ children }: { children: React.ReactNode }) {
  const adminAccess = await getCurrentAdminAccess();
  const user = adminAccess.user
    ? {
        email: adminAccess.user.email,
        displayName: adminAccess.user.displayName,
      }
    : null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold text-primary">
            <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm text-white">정</span>
            정부지원AI비서
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-subtle lg:inline">
              중기부 · 창진원 · 행안부 · 과기부 공고 통합조회
            </span>
            <AuthControl
              user={user}
              isAdmin={adminAccess.status === "authorized"}
            />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      <footer className="mt-10 border-t border-line bg-white px-4 py-6 text-center text-xs leading-6 text-subtle">
        <OperatorInfo />
        <p className="mt-3">공공데이터포털 및 각 제공기관의 공개 자료를 수집·가공해 안내합니다.</p>
        <p className="mt-1">정확한 내용은 반드시 각 공고의 원문을 확인하세요.</p>
        <p className="mt-3 space-x-3">
          <Link href="/privacy" className="text-subtle underline-offset-2 hover:underline">
            개인정보처리방침
          </Link>
          <Link href="/terms" className="text-subtle underline-offset-2 hover:underline">
            이용약관
          </Link>
        </p>
        <p className="mt-2"><Link href="/terms" className="underline underline-offset-2">이용약관 개정 안내 · 2026.11.18 적용</Link></p>
      </footer>
    </div>
  );
}
