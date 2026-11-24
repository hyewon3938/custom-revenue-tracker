import {
  API_MAX_RETRIES,
  API_REQUEST_TIMEOUT_MS,
  API_RETRY_BACKOFF_MS,
} from "@/lib/config";

/** 시도 1회에 쓸 요청. signal은 fetchJsonWithRetry가 붙인다. */
export interface RetryableRequest {
  url: string;
  init: Omit<RequestInit, "signal">;
}

export interface FetchJsonWithRetryOptions {
  /** 에러 메시지 접두어 (예: "네이버" → "네이버 API 에러 (500): ...") */
  label: string;
  /**
   * 시도마다 호출되는 요청 생성 함수.
   * 토큰 발급·서명처럼 시도마다 새로 해야 하는 작업을 여기서 한다.
   * 여기서 던진 에러도 재시도 대상이다.
   */
  buildRequest: () => RetryableRequest | Promise<RetryableRequest>;
  /** 응답이 ok가 아닐 때 본문을 읽기 전에 호출 (예: 401이면 토큰 캐시 비우기) */
  onErrorStatus?: (status: number) => void;
  /** 최대 시도 횟수 (첫 시도 포함) */
  maxRetries?: number;
  /** n번째 시도 실패 후 대기 시간 = backoffMs × n */
  backoffMs?: number;
  /** 시도 1회당 타임아웃 (ms) */
  timeoutMs?: number;
}

/**
 * JSON API 요청 + 재시도 래퍼 (네이버·쿠팡 API 클라이언트 공용)
 * - 실패(네트워크 에러, ok가 아닌 응답, 타임아웃) 시 대기 후 재시도
 * - 시도마다 타임아웃 적용 (응답 없는 연결로 수집이 멈추는 것 방지)
 * - 마지막 시도가 타임아웃이면 안내 메시지로 바꿔 던지고, 그 외에는 마지막 에러를 그대로 던진다
 */
export async function fetchJsonWithRetry<T>(
  options: FetchJsonWithRetryOptions,
): Promise<T> {
  const {
    label,
    buildRequest,
    onErrorStatus,
    maxRetries = API_MAX_RETRIES,
    backoffMs = API_RETRY_BACKOFF_MS,
    timeoutMs = API_REQUEST_TIMEOUT_MS,
  } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { url, init } = await buildRequest();

      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        onErrorStatus?.(response.status);
        const text = await response.text();
        throw new Error(`${label} API 에러 (${response.status}): ${text}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (attempt === maxRetries) {
        if (error instanceof Error && error.name === "TimeoutError") {
          throw new Error(
            `${label} API 응답 없음 (${timeoutMs}ms 초과, ${maxRetries}회 시도)`,
          );
        }
        throw error;
      }
      await new Promise((r) => setTimeout(r, backoffMs * attempt));
    }
  }

  throw new Error("unreachable");
}
