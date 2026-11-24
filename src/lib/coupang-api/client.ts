import { generateHmacSignature } from "./auth";
import { getCoupangApiCredentials } from "@/lib/config";
import { fetchJsonWithRetry } from "@/lib/utils/fetch-with-retry";

/**
 * 쿠팡 Wing API 요청 래퍼
 * - HMAC-SHA256 인증 자동 포함
 * - 실패 시 3회 재시도 (지수 백오프)
 * - 시도마다 타임아웃 적용 (응답 없는 연결로 수집이 멈추는 것 방지)
 */
export async function coupangApi<T>(
  path: string,
  options: { method?: string; params?: Record<string, string> } = {},
): Promise<T> {
  const { method = "GET", params } = options;
  const { accessKey, secretKey } = getCoupangApiCredentials();
  if (!accessKey || !secretKey) {
    throw new Error(
      "COUPANG_ACCESS_KEY, COUPANG_SECRET_KEY 환경변수가 필요합니다.",
    );
  }

  let fullPath = path;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    fullPath += `?${qs}`;
  }

  return fetchJsonWithRetry<T>({
    label: "쿠팡",
    // 서명에 시각이 들어가므로 시도마다 다시 만든다
    buildRequest: () => {
      const { authorization, url } = generateHmacSignature(
        method,
        fullPath,
        secretKey,
        accessKey,
      );

      return {
        url,
        init: {
          method,
          headers: {
            Authorization: authorization,
            "Content-Type": "application/json",
          },
        },
      };
    },
  });
}
