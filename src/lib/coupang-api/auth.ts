import crypto from "node:crypto";

const API_GATEWAY = "https://api-gateway.coupang.com";

/**
 * 쿠팡 Wing API HMAC-SHA256 서명 생성
 * - 메시지 = datetime + method + path + query
 * - Authorization: CEA algorithm=HmacSHA256, access-key=..., signed-date=..., signature=...
 */
export function generateHmacSignature(
  method: string,
  path: string,
  secretKey: string,
  accessKey: string
): { authorization: string; url: string } {
  const urlObj = new URL(`${API_GATEWAY}${path}`);
  const pathname = urlObj.pathname;
  const query = urlObj.search ? urlObj.search.slice(1) : "";

  // yyMMddTHHmmssZ (GMT)
  const now = new Date();
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const datetime =
    String(now.getUTCFullYear()).slice(2) +
    pad2(now.getUTCMonth() + 1) +
    pad2(now.getUTCDate()) +
    "T" +
    pad2(now.getUTCHours()) +
    pad2(now.getUTCMinutes()) +
    pad2(now.getUTCSeconds()) +
    "Z";

  const message = `${datetime}${method.toUpperCase()}${pathname}${query}`;
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(message)
    .digest("hex");

  const authorization =
    `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;

  return { authorization, url: urlObj.toString() };
}
