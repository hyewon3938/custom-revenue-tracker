// 파일별 쓰기 잠금 — 동시 PATCH 요청으로 인한 JSON 손상 방지
// 잠금 Map 은 이 모듈에만 둔다 (여러 모듈에 나뉘면 직렬화가 깨진다).
const writeLocks = new Map<string, Promise<void>>();

/** 같은 key(파일 경로)의 작업을 호출 순서대로 하나씩 실행 */
export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = writeLocks.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  writeLocks.set(
    key,
    next.then(
      () => {},
      () => {},
    ),
  );
  return next;
}
