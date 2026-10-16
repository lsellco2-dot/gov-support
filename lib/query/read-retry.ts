/** DB가 일시적으로 혼잡해 취소한 읽기만 한 번 재시도한다. 다른 오류는 그대로 반환한다. */
export async function readWithTimeoutRetry<T extends { error: { code?: string } | null }>(
  read: () => PromiseLike<T>,
): Promise<T> {
  const result = await read();
  if (result.error?.code !== "57014") return result;
  await new Promise((resolve) => setTimeout(resolve, 250));
  return read();
}
