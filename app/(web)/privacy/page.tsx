import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "개인정보처리방침 — 정부지원AI비서",
  description: "AISUP 웹사이트와 정부지원AI비서 앱의 개인정보 처리, 저장 및 삭제 방법을 안내합니다.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl break-words text-ink">
      <p className="text-sm font-semibold text-primary">정부지원AI비서 · AISUP</p>
      <h1 className="mt-2 text-2xl font-bold">개인정보처리방침</h1>
      <p className="mt-3 text-sm text-subtle">최종 개정일: 2026년 10월 19일</p>
      <p className="mt-5 text-sm leading-7 text-subtle">
        이 방침은 모루덕 게임즈(대표자 김경덕)가 운영하는 정부지원AI비서의
        aisup.co.kr 웹사이트와 Android 앱
        (kr.co.govsupport.assistant)에 적용됩니다. 같은 도메인에 게시된 포켓메이트 등
        다른 서비스의 방침과는 별개입니다. 공고 조회는 로그인 없이 이용할 수 있으며,
        선택한 기능에 따라 처리하는 정보가 달라집니다.
      </p>
      <Section title="1. 처리하는 정보와 목적">
        <ul className="list-disc space-y-3 pl-5">
          <li><strong>Google 로그인:</strong> Google에서 제공하는 계정 식별정보, 이메일,
            표시 이름과 프로필 이미지, 로그인 공급자, 계정 생성·로그인 기록을
            Supabase Auth를 통해 처리합니다. 계정 식별과 로그인 상태 유지에 사용하며,
            Google 비밀번호는 서비스에서 입력받거나 저장하지 않습니다.</li>
          <li><strong>맞춤 공고 설정:</strong> 사용자 유형, 시·도 지역, 업종, 창업연차,
            관심분야를 맞춤 공고 선별에 사용합니다. 웹에서는 브라우저 저장공간(localStorage),
            앱에서는 기기 내 저장공간을 사용합니다. 후보 조회 시 지역과 관심분야에 해당하는
            검색 조건이 서버로 전달됩니다. 현재 이 설정을 Google 로그인 계정에 자동 동기화하지 않습니다.</li>
          <li><strong>나이 필터(선택):</strong> 공고 검색 시 입력한 만 나이와
            ‘연령 미확인 공고 제외’ 선택값을 공고의 연령 조건과 비교하는 데 사용합니다.
            입력하지 않아도 공고를 조회할 수 있으며, 이 필터를 위해 생년월일이나
            신분증을 받지 않습니다. 입력값은 검색 URL의 쿼리 매개변수로 서버에 전달되며,
            회원 프로필 항목으로 별도 저장하지 않습니다. 다만 검색 URL은 브라우저·앱의
            방문 기록과 호스팅 접속 로그에 남을 수 있으므로 URL 공유 시 나이 값이
            포함되어 있는지 확인해 주세요.</li>
          <li><strong>앱 즐겨찾기와 알림:</strong> 즐겨찾기 공고와 알림 설정·발송 이력은
            앱의 기기 내 저장공간에서 처리합니다. 기기별 공고 알림 API를 사용하는 기능은
            설치 식별자, 인증 토큰의 해시, 플랫폼, 앱 버전, 최근 접속 시각,
            저장한 공고 ID와 저장 시각을 서버에 보관합니다. 인증 토큰 원문은 서버 DB에
            저장하지 않습니다. 설치 식별자는 전화번호나 IMEI가 아닙니다.</li>
          <li><strong>서비스 제공·보안:</strong> 검색어와 검색 조건, 요청한 페이지,
            IP 주소, 브라우저·기기 정보, 접속 시각, 오류 정보가 네트워크 요청과
            호스팅·인증 서비스의 운영 로그에서 처리될 수 있습니다.
            공고 조회, 장애 대응, 부정 이용 방지에 사용합니다.</li>
          <li><strong>문의:</strong> 직접 보내는 발신 이메일 주소, 문의 내용과 첨부파일을
            답변과 권리 요청 처리에 사용합니다. 주민등록번호, 신분증 전체 사본,
            금융정보 등 문의에 불필요한 정보는 보내지 마세요.</li>
        </ul>
      </Section>
      <Section title="2. 저장 위치와 보관·삭제">
        <ul className="list-disc space-y-3 pl-5">
          <li>웹 맞춤조건과 추천 캐시는 해당 브라우저에 저장됩니다. 브라우저의 사이트
            데이터 삭제로 지울 수 있습니다. 추천 캐시는 7일이 지나면 재사용하지 않지만,
            브라우저 저장공간의 즉시 삭제를 의미하지는 않습니다.</li>
          <li>나이 필터를 비우고 다시 검색하면 이후 검색 요청에서 해당 나이 조건을
            사용하지 않습니다. 이전 검색 URL은 브라우저·앱의 방문 기록에서 별도로
            삭제해야 하며, 이미 생성된 서버 로그까지 함께 삭제되는 것은 아닙니다.
            로그의 보관·삭제는 아래 운영 로그 안내와 문의 절차를 따릅니다.</li>
          <li>앱 로컬 정보는 해당 기능 해제 또는 Android의 앱 데이터 삭제·앱 제거로
            삭제할 수 있습니다. 기기 데이터 삭제나 로그아웃만으로 서버의 계정·기기별
            알림 기록까지 삭제되는 것은 아닙니다.</li>
          <li>로그인 계정은 계정 삭제 요청이 처리될 때까지 로그인 기능 제공을 위해
            보관합니다. 서버에 저장된 공고 알림은 해당 공고의 알림 해제로 삭제할 수
            있습니다. 설치 기록 등 나머지 서버 정보의 삭제는 아래 문의처로 요청할 수
            있으며, 앱 제거만으로 자동 삭제되는 것으로 안내하지 않습니다.</li>
          <li>문의 정보는 문의·요청 처리에 필요한 동안 보관하고 목적 달성 후 삭제합니다.
            법령에 따라 별도 보관이 필요한 경우 해당 근거와 기간을 적용합니다.
            외부 서비스의 운영 로그·백업은 제공업체의 정책과 적용 설정에 따라 처리되어
            즉시 소거되지 않을 수 있습니다.</li>
          <li>삭제 대상 전자정보는 복구가 어렵도록 삭제하며, 별도 보관이 필요한 정보는
            다른 목적으로 사용하지 않습니다.</li>
        </ul>
      </Section>
      <Section title="3. 외부 서비스 이용">
        <p>서비스 운영에는 다음 제공업체를 이용합니다. 사용자 정보를 공개 공고에
          붙이거나 광고주에게 제공하는 기능은 운영하지 않습니다.</p>
        <ul className="mt-3 list-disc space-y-3 pl-5">
          <li><strong>Supabase:</strong> 로그인 인증과 계정, 기기별 알림 데이터의 저장·보안
            처리를 담당합니다. 현재 서비스 DB의 설정 지역은 서울입니다.
            <PolicyLink href="https://supabase.com/privacy">Supabase 개인정보처리방침</PolicyLink></li>
          <li><strong>Vercel:</strong> 웹페이지·서버 API 제공과 접속·오류 로그 등
            호스팅 운영을 담당합니다.
            <PolicyLink href="https://vercel.com/legal/privacy-notice">Vercel 개인정보처리방침</PolicyLink></li>
          <li><strong>Google:</strong> 선택한 Google 로그인과 고객지원 이메일 전달 과정에서
            정보를 처리합니다.
            <PolicyLink href="https://policies.google.com/privacy?hl=ko">Google 개인정보처리방침</PolicyLink></li>
        </ul>
        <p className="mt-3">이들 사업자는 국외 사업자이며 인증, 지원, 보안 및 글로벌
          네트워크 운영 과정에서 국외 처리가 수반될 수 있습니다. DB가 서울에 있다는
          사실이 모든 인증·접속 정보의 국내 처리만을 의미하지는 않습니다.
          국외 처리와 삭제에 관한 구체적인 문의는 아래 문의처로 요청할 수 있습니다.</p>
      </Section>
      <Section title="4. 쿠키와 기기 저장공간">
        <p>로그인 세션 유지에는 쿠키를, 맞춤 설정과 추천 결과 재사용에는 브라우저·앱
          저장공간을 사용합니다. 브라우저에서 쿠키를 차단하거나 사이트 데이터를 삭제하면
          로그인 유지나 저장한 설정이 초기화될 수 있습니다. 공용 기기에서는 이용 후
          로그아웃하고 필요한 경우 사이트 데이터도 삭제하세요.</p>
      </Section>
      <Section title="5. 광고와 제휴 링크">
        <p><strong>쿠팡 파트너스:</strong> 일반 웹 화면에 제휴 광고가 표시될 수 있습니다.
          광고 표시와 수수료 안내를 함께 제공합니다. 배너를 불러올 때 광고 제공 서버가
          IP 주소, 브라우저 정보, 접속 경로 등 기본 요청 정보를 처리할 수 있고,
          제휴 링크 이용 시 쿠팡이 방문·구매 성과를 쿠키 등으로 측정할 수 있습니다.
          AISUP의 로그인 이메일, 맞춤조건, 알림 목록을 제휴 링크에 넣지 않습니다.</p>
        <p className="mt-3">제휴 링크를 통해 구매가 이루어지면 운영자가 일정액의 수수료를
          제공받을 수 있습니다. 광고와 판매 상품은 정부 공고·공식 추천이 아니며,
          광고 이용 여부는 공고 조회나 지원사업 선정과 관계가 없습니다.
          <PolicyLink href="https://privacy.coupang.com/ko/center/coupang/">쿠팡 개인정보처리방침</PolicyLink></p>
        <p className="mt-3"><strong>Android 앱 Google AdMob:</strong> 광고가 활성화된 앱
          버전의 홈, 공고 목록, AI추천, 즐겨찾기 화면에서 배너가 표시될 수 있습니다.
          화면 콘텐츠와 앱 상태에 따라 노출 여부가 달라지며, 로그인·설정 입력 화면,
          공고 상세·외부 신청 화면에는 해당 배너를 배치하지 않습니다. Google 광고 SDK는 광고 제공,
          측정 및 부정 이용 방지를 위해 IP 주소와 이를 통한 대략적 위치, 광고 ID 등
          기기 식별자, 앱·광고 상호작용 및 진단 정보를 처리하고 공유할 수 있습니다.
          필요한 지역에서는 동의 화면을 제공하며, 앱 설정의 광고 개인정보 선택에서
          제공되는 선택지를 다시 확인할 수 있습니다. 광고 ID는 Android 설정에서도
          관리할 수 있습니다. 광고 동의 조회나 로딩이 실패해도 공고 조회는 이용할 수 있습니다.</p>
        <p className="mt-3"><strong>웹 AdSense:</strong> 2026년 10월 19일 확인 기준,
          aisup.co.kr의 사이트 승인 상태는 ‘준비 중’이며 ads.txt 상태는 ‘승인됨’입니다.
          ads.txt 인증은 사이트 광고 게재 승인과 별개입니다. 현재 웹 AdSense 광고 코드는
          활성화하지 않았습니다. 향후 활성화 전에 광고 관련 정보 처리와 필요한 선택
          기능을 이 방침에 안내합니다. Android 앱의 AdMob 광고 및 쿠팡 제휴 광고와는
          별개의 서비스입니다.</p>
        <p className="mt-3">사용자가 입력한 지원조건과 나이 필터 값을 광고 맞춤 타기팅에
          사용하지 않으며, 이를 광고 요청의 맞춤 타기팅 항목으로 넣지 않습니다.
          Google의 정보 처리와 선택 방법은
          <PolicyLink href="https://policies.google.com/technologies/partner-sites?hl=ko">Google 파트너 사이트 안내</PolicyLink>와
          <PolicyLink href="https://myadcenter.google.com/">내 광고 센터</PolicyLink>에서 확인할 수 있습니다.</p>
      </Section>
      <Section title="6. AI 추천과 외부 공고 사이트">
        <p>현재 일반 사용자 맞춤 공고 추천은 저장한 조건과 공고 데이터를 비교하는
          규칙형 기능입니다. 이 기능에서 Google 로그인 정보나 일반 사용자의 맞춤조건을
          외부 생성형 AI로 전송하지 않습니다. 관리자 실험실의 별도 AI 기술실험과
          일반 사용자 추천은 구분됩니다. 사용자 대상 외부 AI 분석을 도입할 때에는
          전송 항목과 처리 방식을 먼저 안내합니다.</p>
        <p className="mt-3">공식 원문·신청·첨부파일 링크로 다른 기관의 사이트를 열면
          해당 사이트의 개인정보처리방침이 적용됩니다. 서비스는 해당 기관의 신청서나
          제출서류를 대신 접수하지 않습니다.</p>
      </Section>
      <Section title="7. 이용자의 권리와 안전조치">
        <p>본인 정보의 열람, 정정, 삭제, 처리정지 및 계정 삭제를 아래 문의처로 요청할 수
          있습니다. 요청 처리 시 본인 확인에 필요한 최소한의 정보만 확인합니다.
          Google 계정 자체 삭제와 AISUP 계정 삭제는 별개입니다.
          서비스 내 즉시 탈퇴 버튼이 없는 경우 이메일로 요청해 주세요.</p>
        <p className="mt-3">HTTPS, 서버 접근 권한 제한, 사용자·기기 인증 확인, 서버 비밀키
          분리 등의 조치를 적용합니다. 앱 알림 권한은 Android 설정에서 철회할 수 있습니다.
          이 서비스는 만 14세 미만 아동을 주 대상으로 설계하지 않았으며,
          아동의 정보 처리에 관한 요청은 보호자가 문의할 수 있습니다.</p>
      </Section>
      <Section title="8. 개인정보 문의 및 변경 안내">
        <p>개인정보 문의 담당: <strong>정부지원AI비서 운영팀</strong></p>
        <p className="mt-1">이메일: <a className="text-primary underline underline-offset-2"
          href="mailto:mucsiroc@gmail.com">mucsiroc@gmail.com</a></p>
        <p className="mt-3">처리하는 정보나 기능이 변경되면 이 페이지의 내용과 개정일을
          갱신하고, 이용자에게 중요한 변경은 서비스 내 안내 등으로 고지합니다.
          필요한 경우 별도의 동의를 받습니다.</p>
      </Section>
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

function PolicyLink({ href, children }: { href: string; children: ReactNode }) {
  return <> <a href={href} target="_blank" rel="noopener noreferrer"
    className="text-primary underline underline-offset-2">{children}</a> </>;
}
