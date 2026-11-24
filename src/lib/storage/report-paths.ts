import fs from "fs/promises";
import path from "path";
import { pad } from "@/lib/utils/format";

/** 월별 레포트와 백업 버전이 함께 저장되는 디렉터리 */
export const DATA_DIR = path.join(process.cwd(), "data", "reports");

export function getReportPath(year: number, month: number): string {
  return path.join(DATA_DIR, `${year}-${pad(month)}.json`);
}

export async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}
