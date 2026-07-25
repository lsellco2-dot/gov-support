export function isCronAuthorized(
  request: Request,
  secret = process.env.CRON_SECRET,
) {
  const expected = secret?.trim();
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}
