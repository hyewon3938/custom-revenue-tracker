import { NextRequest, NextResponse } from "next/server";
import { generateSalesInsights } from "@/lib/ai/insights";
import { loadReport, loadRecentHistory, updateReport } from "@/lib/storage/report-store";
import { ENABLE_AI_INSIGHTS } from "@/lib/config";

/**
 * POST /api/insights
 *
 * 저장된 레포트의 AI 인사이트를 (재)생성하고 파일에 저장합니다.
 * ENABLE_AI_INSIGHTS=true 환경변수가 설정되어 있어야 동작합니다.
 * 최대 3개월 히스토리를 함께 전달하여 추이 분석 및 협찬 지연 효과를 포함합니다.
 *
 * body: { year: number, month: number }
 */
export async function POST(request: NextRequest) {
  try {
    // 활성화 플래그 체크
    if (!ENABLE_AI_INSIGHTS) {
      return NextResponse.json(
        { error: "AI 인사이트가 비활성화되어 있습니다. .env.local에 ENABLE_AI_INSIGHTS=true를 추가하세요." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { year, month } = body;

    if (!year || !month) {
      return NextResponse.json(
        { error: "year, month 필드가 필요합니다." },
        { status: 400 }
      );
    }

    const report = await loadReport(year, month);
    if (!report) {
      return NextResponse.json(
        { error: `${year}년 ${month}월 레포트가 없습니다. 먼저 /api/scrape를 실행하세요.` },
        { status: 404 }
      );
    }

    // 최대 3개월 히스토리 로드 [전달, 전전달, 전전전달]
    const history = await loadRecentHistory(year, month, 3);

    const insights = await generateSalesInsights(report, history);
    const updated = await updateReport(year, month, { insights });

    return NextResponse.json({ insights: updated.insights });
  } catch (error) {
    const message = error instanceof Error ? error.message : "인사이트 생성 실패";
    console.error("[POST /api/insights] 인사이트 생성 실패");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
