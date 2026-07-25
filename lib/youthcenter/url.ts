const YOUTHCENTER_POLICY_DETAIL_BASE_URL =
  "https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch/ythPlcyDetail";

const SAFE_POLICY_ID = /^[A-Za-z0-9_-]{1,100}$/;

export function buildYouthCenterPolicyDetailUrl(policyId: unknown) {
  if (typeof policyId !== "string") return null;
  const normalizedId = policyId.trim();
  if (!SAFE_POLICY_ID.test(normalizedId)) return null;
  return `${YOUTHCENTER_POLICY_DETAIL_BASE_URL}/${encodeURIComponent(normalizedId)}`;
}
