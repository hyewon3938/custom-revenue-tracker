import { NextRequest, NextResponse } from "next/server";
import { collectMonthlyData } from "@/lib/scrapers";
import { saveReport } from "@/lib/storage/report-store";
import { generateSalesInsights } from "@/lib/ai/insights";

/**
 * POST /api/scrape
 *
 * 네이버·쿠팡 데이터를 수집하고 저장합니다.
 * body: { year?: number, month?: number }
 *   생략 시 현재 연/월 사용
 *
 * 응답: 저장된 MonthlyReport
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const now = new Date();
    const year: number = body.year ?? now.getFullYear();
    const month: number = body.month ?? now.getMonth() + 1;

    if (month < 1 || month > 12) {
      return NextResponse.json(
        { error: "month는 1~12 사이여야 합니다." },
        { status: 400 }
      );
    }

    // 1) 스크레이핑
    const reportData = await collectMonthlyData(year, month);

    // 2) AI 인사이트 생성
    const insights = await generateSalesInsights(reportData);

    const report = { ...reportData, insights };

    // 3) 파일 저장
    await saveReport(report);

    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "데이터 수집 실패";
    console.error("[POST /api/scrape]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
