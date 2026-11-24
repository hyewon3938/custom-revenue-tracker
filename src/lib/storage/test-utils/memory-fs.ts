/**
 * 테스트 전용 인메모리 fs/promises 대체물.
 * 실제 data/ 디렉터리를 건드리지 않도록 storage 테스트에서 vi.mock 으로 주입한다.
 */
import path from "path";

/** 경로 → 파일 내용 */
export const files = new Map<string, string>();

function enoent(target: string): NodeJS.ErrnoException {
  const err: NodeJS.ErrnoException = new Error(
    `ENOENT: no such file or directory, '${target}'`,
  );
  err.code = "ENOENT";
  return err;
}

function read(target: string): string {
  const content = files.get(target);
  if (content === undefined) throw enoent(target);
  return content;
}

export const memoryFs = {
  async mkdir(): Promise<void> {},
  async readFile(target: string): Promise<string> {
    return read(target);
  },
  async writeFile(target: string, content: string): Promise<void> {
    files.set(target, content);
  },
  async access(target: string): Promise<void> {
    read(target);
  },
  async copyFile(src: string, dest: string): Promise<void> {
    files.set(dest, read(src));
  },
  async readdir(dir: string): Promise<string[]> {
    return [...files.keys()]
      .filter((f) => path.dirname(f) === dir)
      .map((f) => path.basename(f));
  },
  async stat(target: string): Promise<{ size: number }> {
    return { size: read(target).length };
  },
  async unlink(target: string): Promise<void> {
    if (!files.delete(target)) throw enoent(target);
  },
};

/** vi.mock("fs/promises") 팩토리 반환값 */
export function createFsMock() {
  return { default: memoryFs, ...memoryFs };
}
