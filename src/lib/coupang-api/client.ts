import { generateHmacSignature } from "./auth";

const MAX_RETRIES = 3;

/**
 * 쿠팡 Wing API 요청 래퍼
 * - HMAC-SHA256 인증 자동 포함
 * - 실패 시 3회 재시도 (지수 백오프)
 */
export async function coupangApi<T>(
  path: string,
  options: { method?: string; params?: Record<string, string> } = {}
): Promise<T> {
  const { method = "GET", params } = options;
  const accessKey = process.env.COUPANG_ACCESS_KEY;
  const secretKey = process.env.COUPANG_SECRET_KEY;
  if (!accessKey || !secretKey) {
    throw new Error(
      "COUPANG_ACCESS_KEY, COUPANG_SECRET_KEY 환경변수가 필요합니다."
    );
  }

  let fullPath = path;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    fullPath += `?${qs}`;
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { authorization, url } = generateHmacSignature(
        method, fullPath, secretKey, accessKey
      );

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`쿠팡 API 에러 (${response.status}): ${text}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (attempt === MAX_RETRIES) throw error;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }

  throw new Error("unreachable");
}
