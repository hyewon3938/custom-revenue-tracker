/**
 * unknown 타입의 에러에서 메시지를 안전하게 추출합니다.
 *
 * @param error - catch 블록의 에러 객체
 * @param fallback - Error 인스턴스가 아닐 때 사용할 기본 메시지
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
