export function canonicalPageUrl(
  basePath: string,
  params: Record<string, string | undefined>,
  page: number,
  total: number,
  size: number
) {
  if (!params.page) return null;

  const lastPage = Math.max(1, Math.ceil(total / size));
  const canonicalPage = Math.min(Math.max(page, 1), lastPage);
  const requestedPage = Number(params.page);
  if (
    Number.isInteger(requestedPage) &&
    requestedPage === canonicalPage &&
    page === canonicalPage
  ) {
    return null;
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  query.set("page", String(canonicalPage));
  return `${basePath}?${query.toString()}`;
}
