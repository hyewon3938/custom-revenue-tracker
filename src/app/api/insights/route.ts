import { NextRequest, NextResponse } from "next/server";
import { generateSalesInsights } from "@/lib/ai/insights";
import { loadReport, updateReport } from "@/lib/storage/report-store";

/**
 * POST /api/insights
 *
 * 저장된 레포트의 AI 인사이트를 (재)생성하고 파일에 저장합니다.
 * body: { year: number, month: number }
 */
export async function POST(request: NextRequest) {
  try {
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

    const insights = await generateSalesInsights(report);
    const updated = await updateReport(year, month, { insights });

    return NextResponse.json({ insights: updated.insights });
  } catch (error) {
    const message = error instanceof Error ? error.message : "인사이트 생성 실패";
    console.error("[POST /api/insights]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
