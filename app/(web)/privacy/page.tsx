import type { Metadata } from "next";

// ⚠️ 초안: 법률 전문가 검토 전 임시 문서입니다.
// 상담 기능 오픈 전 반드시 검토를 거쳐 사업자 정보(상호, 대표자, 연락처)와
// 개인정보 보호책임자를 실제 값으로 채우고 수집·제공 내용을 다시 고지해야 합니다.

export const metadata: Metadata = {
  title: "개인정보처리방침 — 정부지원AI비서",
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-6 sm:p-8">
      <h1 className="text-xl font-bold text-ink">개인정보처리방침</h1>

      <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
        ⚠️ 본 문서는 <b>초안</b>이며 법률 전문가의 검토를 거치지 않았습니다. 정식 서비스 오픈 전
        검토 후 확정본으로 교체됩니다.
      </p>

      <p className="mt-5 text-sm leading-relaxed text-slate-600">
        &lsquo;정부지원AI비서&rsquo;(이하 &ldquo;서비스&rdquo;)는 「개인정보 보호법」에 따라
        이용자의 개인정보를 보호하고 관련 고충을 신속하게 처리하기 위해 다음과 같이
        개인정보처리방침을 수립·공개합니다.
      </p>

      <Section title="1. 수집하는 개인정보 항목">
        <p>
          현재 서비스는 회원가입과 전문가 상담 요청 기능을 제공하지 않으며, 공고 목록·상세
          조회 과정에서 이름이나 연락처 등 개인정보를 직접 수집하지 않습니다.
        </p>
      </Section>

      <Section title="2. 개인정보의 수집·이용 목적">
        <p>
          현재 직접 수집하는 개인정보가 없습니다. 향후 상담 기능을 제공할 경우 수집 항목,
          이용 목적 및 동의 절차를 사전에 고지한 뒤 별도의 동의를 받겠습니다.
        </p>
      </Section>

      <Section title="3. 개인정보의 보유 및 이용 기간">
        <p>현재 서비스가 직접 수집·보유하는 개인정보는 없습니다.</p>
      </Section>

      <Section title="4. 개인정보의 파기 절차 및 방법">
        <p>
          향후 개인정보를 수집하게 되면 보유 기간 경과 또는 처리 목적 달성 시 복구할 수 없는
          방법으로 지체 없이 파기하겠습니다.
        </p>
      </Section>

      <Section title="5. 개인정보의 제3자 제공">
        <p>
          현재 개인정보를 제3자에게 제공하지 않습니다. 향후 제공이 필요한 기능을 도입할
          경우 제공받는 자, 목적, 항목과 보유 기간을 고지하고 별도 동의를 받겠습니다.
        </p>
      </Section>

      <Section title="6. 이용자의 권리">
        <p>
          이용자는 언제든지 자신의 개인정보에 대한 열람·정정·삭제·처리정지를 요구할 수
          있습니다. 요청은 아래 개인정보 보호책임자에게 연락 주시면 지체 없이
          처리하겠습니다.
        </p>
      </Section>

      <Section title="7. 개인정보 보호책임자">
        {/* TODO: 정식 오픈 전 실제 값으로 교체 */}
        <ul className="list-disc space-y-1 pl-5">
          <li>성명: (추후 기재)</li>
          <li>연락처: (추후 기재)</li>
        </ul>
      </Section>

      <p className="mt-8 text-xs text-slate-400">시행일: 2026년 7월 7일 (초안)</p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-base font-bold text-ink">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}
