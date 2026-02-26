/**
 * 스크레이퍼 재시도 래퍼.
 * 동일 브라우저 세션 안에서 최대 1회 재시도 (총 2회 실행).
 */

export interface RetryResult<T> {
  data: T;
  /** 재시도 포함 최종 실패 여부 */
  failed: boolean;
  /** 재시도 발생 여부 (1차 실패 후 2차 시도) */
  retried: boolean;
  /** 최종 에러 메시지 (failed=true일 때) */
  error?: string;
}

/**
 * fn()을 실행하고, 예외 발생 시 delayMs 후 1회 재시도.
 * 재시도도 실패하면 fallback을 반환하고 failed=true.
 *
 * @param name     스크레이퍼 이름 (로그용)
 * @param fn       실행할 스크레이퍼 함수
 * @param fallback 양쪽 모두 실패 시 반환할 기본값
 * @param delayMs  재시도 전 대기 시간 (기본 3초)
 */
export async function withRetry<T>(
  name: string,
  fn: () => Promise<T>,
  fallback: T,
  delayMs = 3_000
): Promise<RetryResult<T>> {
  // 1차 시도
  try {
    const data = await fn();
    return { data, failed: false, retried: false };
  } catch (err1) {
    const firstMsg = err1 instanceof Error ? err1.message : String(err1);
    console.warn(`[${name}] 첫 번째 시도 실패: ${firstMsg}. ${delayMs}ms 후 재시도...`);

    await new Promise((r) => setTimeout(r, delayMs));

    // 2차 시도 (재시도)
    try {
      const data = await fn();
      console.log(`[${name}] 재시도 성공`);
      return { data, failed: false, retried: true };
    } catch (err2) {
      const finalMsg = err2 instanceof Error ? err2.message : String(err2);
      console.error(`[${name}] 재시도도 실패: ${finalMsg}`);
      return { data: fallback, failed: true, retried: true, error: finalMsg };
    }
  }
}
