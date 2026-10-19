import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import OperatorInfo from "@/components/OperatorInfo";
import PreviousTerms from "@/components/PreviousTerms";

export const metadata: Metadata = {
  title: "이용약관 — 정부지원AI비서",
  description: "AISUP 웹사이트와 정부지원AI비서 앱의 이용 조건과 운영 문의처를 안내합니다.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl break-words text-ink">
      <p className="text-sm font-semibold text-primary">정부지원AI비서 · AISUP</p>
      <h1 className="mt-2 text-2xl font-bold">이용약관</h1>
      <p className="mt-3 text-sm text-subtle">최종 수정일: 2026년 10월 19일</p>
      <aside aria-label="이용약관 개정 안내" className="mt-5 border-l-4 border-primary bg-primary-light p-4 text-sm leading-7 text-subtle">
        <p className="font-semibold text-ink">개정 안내 · 적용일: 2026년 11월 18일</p>
        <p>운영자 정보와 현재 제공하는 로그인·맞춤 추천·알림·광고 기능을 안내하고,
          계정 삭제, 이용 제한, 책임 및 변경 고지 기준을 명확히 하기 위해 약관을 개정합니다.
          아래는 개정 약관이며, 적용일 전에는 하단의 개정 전 약관이 적용됩니다.
          의견이나 계정 삭제 요청은 운영 문의 이메일로 보내실 수 있습니다.</p>
        <a href="#previous-terms" className="text-primary underline underline-offset-2">개정 전 약관 보기</a>
      </aside>

      <Section title="제1조 (목적과 운영 안내)">
        <p>이 약관은 모루덕 게임즈(대표자 김경덕, 이하 “운영자”)가 운영하는
          정부지원AI비서(이하 “서비스”)의 AISUP 웹사이트와 Android 앱을
          이용할 때 적용되는 조건과 이용자 및 운영자의 권리·의무를 정합니다.
          서비스는 공공기관의 공식 서비스가 아니며, 지원사업의 접수·심사·선정을 담당하지 않습니다.</p>
        <div className="mt-3"><OperatorInfo /></div>
      </Section>

      <Section title="제2조 (제공하는 기능)">
        <ul className="list-disc space-y-2 pl-5">
          <li>공개된 정부지원사업·복지서비스 등 공고의 통합 조회와 검색·필터</li>
          <li>입력한 조건과 공고 정보를 비교하는 규칙 기반 맞춤 추천</li>
          <li>지원되는 화면과 앱 버전에서 제공하는 즐겨찾기 및 맞춤 공고 알림</li>
          <li>Google 계정을 통한 선택적 로그인과 공식 원문·신청 사이트 연결</li>
        </ul>
        <p className="mt-3">기본 공고 조회는 로그인 없이 이용할 수 있습니다. 전문가 상담 연결은
          현재 제공하지 않습니다. 별도 유료 기능을 도입할 경우 요금·이용 조건을 사전에 안내하고
          필요한 동의와 결제 절차를 제공합니다.</p>
      </Section>

      <Section title="제3조 (로그인과 계정 관리)">
        <p>이용자는 본인이 사용할 권한이 있는 Google 계정으로 로그인해야 합니다.
          다른 사람을 사칭하거나 다른 사람의 계정을 무단 사용해서는 안 됩니다.
          서비스는 Google 비밀번호를 직접 입력받거나 저장하지 않습니다.</p>
        <p className="mt-3">계정 삭제는 운영 문의 이메일로 요청할 수 있으며, 본인 확인 후 처리합니다.
          AISUP 계정 삭제는 Google 계정 자체의 삭제가 아닙니다. 로그아웃·앱 제거만으로
          서버 계정이 삭제되지는 않습니다. 공용 기기에서는 이용 후 로그아웃해 주세요.</p>
      </Section>

      <Section title="제4조 (공고·추천·알림의 이용)">
        <p>공고와 추천 결과는 참고 정보이며 지원자격 충족, 지원금 수령 또는 선정 가능성을
          보장하지 않습니다. 수집·갱신 지연, 원천 자료의 변경, 누락이나 분류 오류가 있을 수
          있습니다. 신청 전 공식 원문에서 지원대상·접수기간·신청방법을 확인하고,
          불명확한 조건은 해당 사업 담당 기관에 문의해 주세요.</p>
        <p className="mt-3">알림은 이용자의 설정, 기기 권한, 네트워크 및 운영체제 상태에 따라
          지연되거나 전달되지 않을 수 있습니다. 알림 수신 여부와 관계없이 신청 마감은
          공식 공고를 기준으로 직접 확인해 주세요.</p>
      </Section>

      <Section title="제5조 (저장된 정보와 개인정보)">
        <p>맞춤조건·즐겨찾기 등 기기에 저장되는 정보는 브라우저나 앱 데이터 삭제 시 사라질 수
          있으며, 로그인만으로 모든 기기의 데이터가 자동 동기화되는 것은 아닙니다.
          서버에 저장되는 계정·알림 정보와 삭제 방법 등은 별도로 안내합니다.</p>
        <p className="mt-3">처리하는 개인정보와 이용자의 권리는{" "}
          <Link href="/privacy" className="text-primary underline underline-offset-2">개인정보처리방침</Link>에서
          확인할 수 있습니다. 이용약관 동의가 별도로 필요한 개인정보 동의를 대신하지 않습니다.</p>
      </Section>

      <Section title="제6조 (광고·제휴 링크와 외부 서비스)">
        <p>서비스에는 광고와 제휴 링크가 표시될 수 있으며, 제휴 링크를 통한 구매 등에 따라
          운영자가 수수료를 받을 수 있습니다. 광고는 정부 공고나 정부기관의 추천이 아니며,
          광고 이용 여부는 지원사업 신청·선정과 관계가 없습니다.</p>
        <p className="mt-3">외부 사이트에서 이루어지는 신청·거래에는 해당 제공자의 조건이 적용됩니다.
          AISUP은 공고 신청이나 광고 상품의 판매를 대신하지 않으며, 법령에 따라 부담하는
          운영자의 책임을 이 조항으로 배제하지 않습니다.</p>
      </Section>

      <Section title="제7조 (이용자의 의무와 이용 제한)">
        <p>계정 도용, 비정상적인 대량 요청을 통한 서비스 방해, 보안 우회,
          타인의 개인정보 침해 및 위법한 이용을 금지합니다.
          이러한 행위가 확인되면 필요한 범위에서 이용을 제한할 수 있으며,
          가능한 경우 사유를 안내하고 문의처를 통한 이의 제기를 받습니다.
          긴급한 보안 조치가 필요한 경우 먼저 제한한 뒤 안내할 수 있습니다.</p>
      </Section>

      <Section title="제8조 (서비스 변경·중단과 책임)">
        <p>점검, 장애, 원천 데이터 제공 중단 또는 운영상 사유로 기능이 변경되거나
          일시 중단될 수 있습니다. 예정된 중요한 변경이나 중단은 사전에 안내하고,
          긴급한 장애 등 사전 안내가 어려운 경우에는 가능한 때에 안내합니다.</p>
        <p className="mt-3">운영자와 이용자의 손해배상 책임은 관련 법령에 따릅니다.
          무료 서비스라는 이유만으로 운영자의 법률상 책임을 일괄 면제하지 않습니다.</p>
      </Section>

      <Section title="제9조 (약관 변경)">
        <p>약관을 변경할 때에는 변경 내용·사유와 적용일을 서비스 내에 안내합니다.
          일반적인 변경은 적용일 7일 전, 이용자에게 불리하거나 중요한 변경은
          30일 전부터 안내합니다. 관계 법령상 별도 통지나 동의가 필요한 경우 해당 절차를
          따릅니다. 동의하지 않는 이용자는 이용을 중단하고 계정 삭제를 요청할 수 있으며,
          이의를 제기하지 않았다는 이유만으로 필요한 동의를 받은 것으로 처리하지 않습니다.</p>
      </Section>

      <Section title="제10조 (문의와 분쟁 해결)">
        <p>서비스 이용, 오류 정정, 계정 삭제 및 약관 관련 문의는 위 운영 문의처로
          접수할 수 있습니다. 분쟁에는 대한민국 법령을 적용하며,
          소송의 관할은 관련 법령에 따릅니다.</p>
      </Section>
      <PreviousTerms />
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 border-t border-line pt-6">
      <h2 className="text-base font-bold">{title}</h2>
      <div className="mt-3 text-sm leading-7 text-subtle">{children}</div>
    </section>
  );
}
