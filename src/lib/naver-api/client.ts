import { getAccessToken, clearTokenCache } from "./auth";
import { fetchJsonWithRetry } from "@/lib/utils/fetch-with-retry";

const BASE_URL = "https://api.commerce.naver.com/external/v1";
const HTTP_UNAUTHORIZED = 401;

/**
 * 네이버 커머스 API 요청 래퍼
 * - Bearer 토큰 자동 포함
 * - 실패 시 3회 재시도 (지수 백오프)
 * - 시도마다 타임아웃 적용 (응답 없는 연결로 수집이 멈추는 것 방지)
 */
export async function naverApi<T>(
  path: string,
  options: {
    method?: string;
    params?: Record<string, string>;
    body?: unknown;
  } = {},
): Promise<T> {
  const { method = "GET", params, body } = options;

  return fetchJsonWithRetry<T>({
    label: "네이버",
    // 토큰 발급 실패도 재시도 대상이므로 시도마다 다시 받는다
    buildRequest: async () => {
      const token = await getAccessToken();
      const url = new URL(`${BASE_URL}${path}`);

      if (params) {
        for (const [key, value] of Object.entries(params)) {
          url.searchParams.set(key, value);
        }
      }

      return {
        url: url.toString(),
        init: {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: body != null ? JSON.stringify(body) : undefined,
        },
      };
    },
    onErrorStatus: (status) => {
      if (status === HTTP_UNAUTHORIZED) {
        clearTokenCache();
      }
    },
  });
}
