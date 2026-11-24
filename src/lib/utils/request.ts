/** API 라우트가 실패 시 돌려주는 응답 본문 형태 */
interface ErrorBody {
  error?: string;
}

/**
 * fetch로 JSON API를 호출하고 본문을 파싱해 반환합니다.
 *
 * 응답이 실패(`!res.ok`)면 본문의 `error` 필드를 메시지로 하는 Error를 던지고,
 * `error` 필드가 없으면 `fallbackMessage`를 씁니다.
 * 본문 JSON 파싱 실패나 네트워크·타임아웃 오류는 가공하지 않고 그대로 전파합니다.
 *
 * @param url - 요청 URL
 * @param init - fetch 옵션 (method, headers, body, signal 등)
 * @param fallbackMessage - 실패 응답에 `error` 필드가 없을 때 쓸 메시지
 */
export async function requestJson<T>(
  url: string,
  init: RequestInit | undefined,
  fallbackMessage: string,
): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const data: ErrorBody = await res.json();
    throw new Error(data.error ?? fallbackMessage);
  }
  const data: T = await res.json();
  return data;
}
