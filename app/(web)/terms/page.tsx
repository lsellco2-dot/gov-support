import type { Metadata } from "next";

// ⚠️ 초안: 법률 전문가 검토 전 임시 문서입니다.
// 정식 오픈 전 검토를 거쳐 사업자 정보와 분쟁 관할 등을 확정해야 합니다.

export const metadata: Metadata = {
  title: "이용약관 — 지원사업 한곳에",
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-6 sm:p-8">
      <h1 className="text-xl font-bold text-ink">이용약관</h1>

      <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
        ⚠️ 본 문서는 <b>초안</b>이며 법률 전문가의 검토를 거치지 않았습니다. 정식 서비스 오픈 전
        검토 후 확정본으로 교체됩니다.
      </p>

      <Section title="제1조 (목적)">
        <p>
          이 약관은 &lsquo;지원사업 한곳에&rsquo;(이하 &ldquo;서비스&rdquo;)가 제공하는
          정부지원사업 공고 통합 조회 및 전문가 상담 연결 서비스의 이용 조건과 절차, 서비스와
          이용자의 권리·의무를 규정함을 목적으로 합니다.
        </p>
      </Section>

      <Section title="제2조 (서비스의 내용)">
        <ul className="list-disc space-y-1 pl-5">
          <li>공공데이터포털 등 공개 API를 통해 수집한 정부지원사업 공고의 통합 조회</li>
          <li>공고 검색, 분야·지역·상태별 필터링</li>
          <li>희망 시 정부지원사업 상담 전문가 연결</li>
        </ul>
      </Section>

      <Section title="제3조 (공고 정보의 성격 및 면책)">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            서비스가 제공하는 공고 정보는 공공기관이 공개한 자료를 수집·가공한 것으로,{" "}
            <b>참고용</b>입니다. 수집·가공 과정에서 원문과 차이가 발생할 수 있습니다.
          </li>
          <li>
            지원사업 신청 전 반드시 <b>각 공고의 원문</b>을 확인해야 하며, 공고 내용의 정확성에
            대한 최종 판단 책임은 소관 기관의 원문 공고에 있습니다.
          </li>
          <li>
            서비스는 공고 정보의 오류·누락·지연으로 인해 발생한 손해에 대해 고의 또는 중대한
            과실이 없는 한 책임을 지지 않습니다.
          </li>
        </ul>
      </Section>

      <Section title="제4조 (전문가 상담 연결)">
        <ul className="list-disc space-y-1 pl-5">
          <li>전문가 상담 연결은 이용자의 요청이 있는 경우에만 진행됩니다.</li>
          <li>
            1차 상담은 무료이며, 이후 전문가와 이용자 간 별도 계약에 따른 유료 용역은 서비스와
            무관하게 당사자 간 체결됩니다.
          </li>
          <li>
            상담 연결 시 개인정보 처리에 관한 사항은{" "}
            <a href="/privacy" className="text-primary underline">
              개인정보처리방침
            </a>
            을 따릅니다.
          </li>
        </ul>
      </Section>

      <Section title="제5조 (이용자의 의무)">
        <ul className="list-disc space-y-1 pl-5">
          <li>타인의 정보를 도용하여 상담을 요청해서는 안 됩니다.</li>
          <li>서비스의 정상적인 운영을 방해하는 행위(자동화된 대량 조회 등)를 해서는 안 됩니다.</li>
        </ul>
      </Section>

      <Section title="제6조 (서비스의 변경 및 중단)">
        <p>
          서비스는 운영상·기술상 필요에 따라 제공하는 서비스의 전부 또는 일부를 변경하거나
          중단할 수 있습니다. 무료로 제공되는 서비스의 변경·중단에 대해서는 관련 법령에 특별한
          규정이 없는 한 별도의 보상을 하지 않습니다.
        </p>
      </Section>

      <Section title="제7조 (약관의 변경)">
        <p>
          이 약관을 변경하는 경우 적용일자와 변경 사유를 명시하여 적용일 7일 전부터 서비스
          내에 공지합니다.
        </p>
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
