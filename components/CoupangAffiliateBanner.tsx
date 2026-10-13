export default function CoupangAffiliateBanner() {
  return (
    <aside aria-label="쿠팡 파트너스 제휴 광고" className="mt-10 border-t border-line pt-6">
      <p className="text-xs font-semibold text-subtle">광고 · 쿠팡 파트너스</p>
      <p className="mt-2 text-xs leading-6 text-subtle">
        이 페이지는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
      </p>
      <div className="mt-4 flex justify-center">
        <a href="https://link.coupang.com/a/hOepCNAyGa" target="_blank"
          rel="sponsored noopener" referrerPolicy="strict-origin-when-cross-origin"
          aria-label="쿠팡 제휴 광고 (새 창)" className="block max-w-full focus-visible:outline-primary">
          {/* 공식 배너를 사용하며 사용자 조건을 전달하지 않는다. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://ads-partners.coupang.com/banners/1038568?trackingCode=AF0797897&subId=&traceId=V0-301-879dd1202e5c73b2-I1038568&w=320&h=100"
            alt="쿠팡" width={320} height={100} loading="lazy" decoding="async"
            referrerPolicy="strict-origin-when-cross-origin" className="h-auto max-w-full"
          />
        </a>
      </div>
    </aside>
  );
}
