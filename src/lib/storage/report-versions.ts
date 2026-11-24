import fs from "fs/promises";
import path from "path";
import { MonthlyReport } from "@/lib/types";
import { pad } from "@/lib/utils/format";
import { withLock } from "@/lib/storage/report-lock";
import { migrateReport } from "@/lib/storage/report-migration";
import {
  DATA_DIR,
  getReportPath,
  ensureDataDir,
} from "@/lib/storage/report-paths";

// ─── 버전 관리 상수 ─────────────────────────────────────────────────────
const MAX_VERSIONS = 5;
const VERSION_REGEX = /^(\d{4})-(\d{2})\.v(\d+)\.json$/;

function getVersionPath(
  year: number,
  month: number,
  timestamp: number,
): string {
  return path.join(DATA_DIR, `${year}-${pad(month)}.v${timestamp}.json`);
}

// ─── 버전 관리 내부 헬퍼 ────────────────────────────────────────────────

/** 오래된 백업 자동 삭제 (MAX_VERSIONS 초과분) */
async function deleteOldVersions(year: number, month: number): Promise<void> {
  const versions = await listVersions(year, month);
  if (versions.length <= MAX_VERSIONS) return;
  const toDelete = versions.slice(MAX_VERSIONS);
  for (const v of toDelete) {
    await fs.unlink(getVersionPath(year, month, v.timestamp)).catch(() => {});
  }
}

/** 현재 레포트를 타임스탬프 백업 파일로 복사 */
export async function createBackup(
  year: number,
  month: number,
): Promise<number | null> {
  const filePath = getReportPath(year, month);
  try {
    await fs.access(filePath);
  } catch {
    return null; // 기존 파일 없으면 백업할 것 없음
  }
  const timestamp = Date.now();
  await fs.copyFile(filePath, getVersionPath(year, month, timestamp));
  await deleteOldVersions(year, month);
  return timestamp;
}

// ─── 버전 관리 export 함수 ──────────────────────────────────────────────

/** 특정 월의 백업 버전 목록 (최신순) */
export async function listVersions(
  year: number,
  month: number,
): Promise<{ timestamp: number; date: string; size: number }[]> {
  await ensureDataDir();
  const prefix = `${year}-${pad(month)}.v`;
  const files = await fs.readdir(DATA_DIR);
  const versions: { timestamp: number; date: string; size: number }[] = [];

  for (const f of files) {
    if (!f.startsWith(prefix) || !f.endsWith(".json")) continue;
    const match = f.match(VERSION_REGEX);
    if (!match) continue;
    const ts = parseInt(match[3]);
    const stat = await fs.stat(path.join(DATA_DIR, f));
    versions.push({
      timestamp: ts,
      date: new Date(ts).toISOString(),
      size: stat.size,
    });
  }

  return versions.sort((a, b) => b.timestamp - a.timestamp);
}

/** 백업 버전으로 복구 (현재 데이터는 자동 백업) */
export async function restoreVersion(
  year: number,
  month: number,
  timestamp: number,
): Promise<MonthlyReport> {
  const filePath = getReportPath(year, month);
  const versionPath = getVersionPath(year, month, timestamp);

  try {
    await fs.access(versionPath);
  } catch {
    throw new Error(`해당 버전을 찾을 수 없습니다: ${timestamp}`);
  }

  return withLock(filePath, async () => {
    // 복구 전 현재 데이터 백업
    await createBackup(year, month);
    // 버전 파일을 현재 경로로 복사
    await fs.copyFile(versionPath, filePath);
    // 마이그레이션 적용 + 타임스탬프 갱신
    const raw = await fs.readFile(filePath, "utf-8");
    const report = migrateReport(JSON.parse(raw));
    report.lastModifiedAt = new Date().toISOString();
    await fs.writeFile(filePath, JSON.stringify(report, null, 2), "utf-8");
    return report;
  });
}
