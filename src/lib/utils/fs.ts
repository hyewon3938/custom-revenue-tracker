/** 파일·디렉터리가 없어서 난 에러(ENOENT)인지 판별 */
export function isEnoent(err: unknown): boolean {
  return (err as NodeJS.ErrnoException).code === "ENOENT";
}
