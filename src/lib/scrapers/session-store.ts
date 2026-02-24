import fs from "fs/promises";
import path from "path";
import { BrowserContext } from "playwright";

const SESSIONS_DIR = path.join(process.cwd(), ".browser-session");

/**
 * 세션 유효기간.
 * SESSION_TTL_DAYS 환경변수로 조정 가능 (기본값: 30일).
 */
function getSessionTtlMs(): number {
  const days = parseInt(process.env.SESSION_TTL_DAYS ?? "30") || 30;
  return days * 24 * 60 * 60 * 1_000;
}

function sessionFilePath(platform: "naver" | "coupang"): string {
  return path.join(SESSIONS_DIR, `${platform}.json`);
}

/**
 * 세션 파일이 존재하고 TTL 이내면 파일 경로를 반환.
 * 만료됐거나 없으면 null 반환.
 */
export async function getValidSessionPath(
  platform: "naver" | "coupang"
): Promise<string | null> {
  const filePath = sessionFilePath(platform);
  try {
    const stat = await fs.stat(filePath);
    const ageMs = Date.now() - stat.mtimeMs;
    const ttlMs = getSessionTtlMs();
    if (ageMs > ttlMs) {
      const ageDays = (ageMs / 86_400_000).toFixed(1);
      const ttlDays = ttlMs / 86_400_000;
      console.log(
        `[세션] ${platform} 세션 만료 (${ageDays}일 경과, TTL: ${ttlDays}일) — 재로그인 필요`
      );
      await fs.unlink(filePath).catch(() => {});
      return null;
    }
    return filePath;
  } catch {
    return null;
  }
}

/** 로그인 완료 후 현재 컨텍스트 상태를 파일에 저장 */
export async function saveSession(
  context: BrowserContext,
  platform: "naver" | "coupang"
): Promise<void> {
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
  await context.storageState({ path: sessionFilePath(platform) });
  console.log(`[세션] ${platform} 세션 저장 완료`);
}
