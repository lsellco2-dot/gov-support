import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Database, FlaskConical, LogOut } from "lucide-react";
import AuthControl from "@/components/AuthControl";
import { requireAdminPage } from "@/lib/admin/auth";

export const metadata: Metadata = {
  title: "AISUP 관리자",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const access = await requireAdminPage("/admin");
  const user = {
    email: access.user.email,
    displayName: access.user.displayName,
  };
  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">정부지원AI비서</p>
            <h1 className="mt-1 text-2xl font-bold text-ink">AISUP 관리자</h1>
            <p className="mt-2 text-sm text-subtle">
              관리자 로그인 · 공급자 {access.user.provider === "google" ? "Google" : access.user.provider ?? "확인 필요"} · 역할 {access.role}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="flex h-10 items-center rounded-md border border-line bg-white px-3 text-sm font-semibold text-subtle">
              AISUP으로 돌아가기
            </Link>
            <AuthControl user={user} compact />
          </div>
        </header>
        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <AdminMenu href="/admin/ai-lab" icon={FlaskConical} title="AI 실험실" description="기존 추천 규칙의 후보와 점수를 실험합니다." />
          <AdminMenu icon={Database} title="데이터 현황" description="운영 현황 화면은 준비 중입니다." />
          <AdminMenu icon={Activity} title="수집 상태" description="수집 상태 화면은 준비 중입니다." />
        </section>
      </div>
    </main>
  );
}

function AdminMenu({ href, icon: Icon, title, description }: {
  href?: string;
  icon: typeof FlaskConical | typeof Database | typeof Activity | typeof LogOut;
  title: string;
  description: string;
}) {
  const content = (
    <>
      <Icon className="text-primary" size={22} aria-hidden="true" />
      <h2 className="mt-4 text-base font-bold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-subtle">{description}</p>
    </>
  );
  return href ? (
    <Link href={href} className="rounded-lg border border-line bg-white p-5 hover:border-primary">{content}</Link>
  ) : (
    <div className="rounded-lg border border-line bg-white p-5 opacity-70">{content}</div>
  );
}
