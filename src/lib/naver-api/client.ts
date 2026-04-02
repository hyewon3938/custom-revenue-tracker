import { getAccessToken, clearTokenCache } from "./auth";

const BASE_URL = "https://api.commerce.naver.com/external/v1";
const MAX_RETRIES = 3;

/**
 * 네이버 커머스 API 요청 래퍼
 * - Bearer 토큰 자동 포함
 * - 실패 시 3회 재시도 (지수 백오프)
 */
export async function naverApi<T>(
  path: string,
  options: {
    method?: string;
    params?: Record<string, string>;
    body?: unknown;
  } = {}
): Promise<T> {
  const { method = "GET", params, body } = options;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const token = await getAccessToken();
      const url = new URL(`${BASE_URL}${path}`);

      if (params) {
        for (const [key, value] of Object.entries(params)) {
          url.searchParams.set(key, value);
        }
      }

      const response = await fetch(url.toString(), {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: body != null ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        if (response.status === 401) {
          clearTokenCache();
        }
        const text = await response.text();
        throw new Error(`네이버 API 에러 (${response.status}): ${text}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (attempt === MAX_RETRIES) throw error;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }

  throw new Error("unreachable");
}
