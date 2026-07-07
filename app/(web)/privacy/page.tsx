import type { Metadata } from "next";

// ⚠️ 초안: 법률 전문가 검토 전 임시 문서입니다.
// leads 폼 오픈 전 반드시 검토를 거쳐 사업자 정보(상호, 대표자, 연락처)와
// 개인정보 보호책임자를 실제 값으로 채워야 합니다.

export const metadata: Metadata = {
  title: "개인정보처리방침 — 지원사업 한곳에",
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
        &lsquo;지원사업 한곳에&rsquo;(이하 &ldquo;서비스&rdquo;)는 「개인정보 보호법」에 따라
        이용자의 개인정보를 보호하고 관련 고충을 신속하게 처리하기 위해 다음과 같이
        개인정보처리방침을 수립·공개합니다.
      </p>

      <Section title="1. 수집하는 개인정보 항목">
        <p>서비스는 전문가 상담 요청 폼을 통해 아래 항목을 수집합니다.</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <b>필수</b>: 이름, 연락처(휴대전화번호)
          </li>
          <li>
            <b>선택</b>: 지역, 문의 내용, 사업자등록 보유 여부
          </li>
        </ul>
        <p className="mt-2">
          공고 목록·상세 조회는 회원가입 없이 이용 가능하며, 이 과정에서 별도의 개인정보를
          수집하지 않습니다.
        </p>
      </Section>

      <Section title="2. 개인정보의 수집·이용 목적">
        <ul className="list-disc space-y-1 pl-5">
          <li>정부지원사업 관련 <b>전문가 상담 연결</b> 및 상담 진행을 위한 연락</li>
          <li>상담 요청 접수 확인 및 처리 결과 안내</li>
        </ul>
        <p className="mt-2">수집한 개인정보는 위 목적 외의 용도로 이용하지 않습니다.</p>
      </Section>

      <Section title="3. 개인정보의 보유 및 이용 기간">
        <p>
          수집일로부터 <b>상담 완료 시까지</b> 보유하며, 상담이 완료되면 지체 없이 파기합니다.
          단, 상담이 진행되지 않은 경우에도 수집일로부터 <b>90일</b>이 경과하면 파기합니다.
          관계 법령에 따라 보존할 필요가 있는 경우에는 해당 법령에서 정한 기간 동안 보관합니다.
        </p>
      </Section>

      <Section title="4. 개인정보의 파기 절차 및 방법">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>파기 절차</b>: 보유 기간이 경과하거나 처리 목적이 달성된 개인정보는 내부 방침에
            따라 파기 대상으로 선정하고, 개인정보 보호책임자의 확인을 거쳐 파기합니다.
          </li>
          <li>
            <b>파기 방법</b>: 전자적 파일 형태로 저장된 개인정보는 복구·재생이 불가능한
            기술적 방법으로 영구 삭제합니다.
          </li>
        </ul>
      </Section>

      <Section title="5. 개인정보의 제3자 제공">
        <p>
          서비스는 상담 연결을 위해 이용자가 상담을 요청한 경우에 한하여 아래와 같이
          개인정보를 제3자에게 제공합니다.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <b>제공받는 자</b>: 서비스와 제휴한 정부지원사업 <b>상담 전문가</b>(경영지도사,
            컨설턴트 등)
          </li>
          <li>
            <b>제공 항목</b>: 이름, 연락처, 지역, 문의 내용, 관심 공고 정보
          </li>
          <li>
            <b>제공 목적</b>: 요청하신 상담의 수행
          </li>
          <li>
            <b>보유 기간</b>: 상담 완료 후 지체 없이 파기
          </li>
        </ul>
        <p className="mt-2">
          위 제공은 이용자가 상담 요청 시 동의한 경우에만 이루어지며, 동의를 거부할 수
          있습니다. 다만 동의하지 않을 경우 상담 연결 서비스를 이용할 수 없습니다.
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
