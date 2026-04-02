import bcrypt from "bcrypt";

const TOKEN_URL =
  "https://api.commerce.naver.com/external/v1/oauth2/token";

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * 네이버 커머스 API 인증 토큰 발급
 * - OAuth 2.0 clientCredentials 방식
 * - bcrypt 서명: bcrypt.hash(clientId + "_" + timestamp, clientSecret)
 * - 토큰은 만료 1분 전까지 메모리 캐싱
 */
export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 환경변수가 필요합니다."
    );
  }

  const timestamp = String(Date.now() - 3000);
  const password = `${clientId}_${timestamp}`;
  const hashed = await bcrypt.hash(password, clientSecret);
  const clientSecretSign = Buffer.from(hashed).toString("base64");

  const params = new URLSearchParams({
    client_id: clientId,
    timestamp,
    client_secret_sign: clientSecretSign,
    grant_type: "client_credentials",
    type: "SELF",
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`네이버 토큰 발급 실패 (${response.status}): ${text}`);
  }

  const data = (await response.json()) as TokenResponse;
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

export function clearTokenCache(): void {
  cachedToken = null;
}
