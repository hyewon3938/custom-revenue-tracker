/**
 * AI 인사이트 프롬프트 미리보기.
 * 실행: npx tsx scripts/preview-prompt.ts [year] [month]
 * 예시: npx tsx scripts/preview-prompt.ts 2026 2
 */
import { resolve } from "path";
import { existsSync, readFileSync } from "fs";

// .env.local 수동 로드 (동적 import 전에 실행해야 함)
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  // 환경변수 로드 후 동적 import (config.ts가 process.env를 읽을 수 있도록)
  const { loadReport, loadRecentHistory, listReports } = await import("../src/lib/storage/report-store");
  const { buildOverviewData } = await import("../src/lib/calculations/overview");
  const { buildPrompt } = await import("../src/lib/ai/insights");

  const year = Number(process.argv[2]) || 2026;
  const month = Number(process.argv[3]) || 2;

  const report = await loadReport(year, month);
  if (!report) {
    console.error(`❌ ${year}년 ${month}월 레포트 없음`);
    process.exit(1);
  }

  const history = await loadRecentHistory(year, month, 3);

  const allList = await listReports();
  const allReports = (
    await Promise.all(allList.map(({ year: y, month: m }) => loadReport(y, m)))
  ).filter((r): r is NonNullable<typeof r> => r !== null);
  const { months: overview } = buildOverviewData(allReports);

  const { insights: _, ...reportWithoutInsights } = report;
  const prompt = buildPrompt(reportWithoutInsights, history, overview);

  console.log("=".repeat(80));
  console.log("📋 SYSTEM PROMPT (시스템 프롬프트는 insights.ts의 SYSTEM_PROMPT 상수 참고)");
  console.log("=".repeat(80));
  console.log();
  console.log("=".repeat(80));
  console.log(`📊 USER PROMPT (${year}년 ${month}월)`);
  console.log("=".repeat(80));
  console.log();
  console.log(`다음 판매 데이터를 분석하여 핵심 인사이트 7~12개를 JSON 배열로 제공해주세요.\n`);
  console.log(prompt);
  console.log();
  console.log("=".repeat(80));
  console.log(`📏 프롬프트 길이: ${prompt.length}자`);
  console.log("=".repeat(80));
}

main().catch(console.error);
