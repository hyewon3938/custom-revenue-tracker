import { NextRequest, NextResponse } from "next/server";
import { collectMonthlyData } from "@/lib/scrapers";
import { loadReport, saveReport } from "@/lib/storage/report-store";
import { generateSalesInsights } from "@/lib/ai/insights";
import {
  calcOnlineProfit,
  calcOfflineProfit,
  calcOverallSummary,
  calcPlatformRanking,
  calcOverallRanking,
  calcProductMatrix,
} from "@/lib/calculations/profit";
import { loadProductMapping } from "@/lib/storage/mapping-store";

/**
 * POST /api/scrape
 *
 * 네이버·쿠팡 데이터를 수집하고 저장합니다.
 * body: { year?: number, month?: number }
 *   생략 시 현재 연/월 사용
 *
 * 재수집 시 수기 입력 데이터(오프라인 전체, 네이버 광고비)는 보존되며,
 * 보존된 데이터를 반영해 파생 필드(profit·summary·ranking·matrix)를 재계산합니다.
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

    // 2) 재수집인 경우 수기 입력 데이터 보존 후 파생 필드 재계산
    //    - offline: 전체 (매출·비용·상품별 수량 모두 수기 입력)
    //    - naver.fees.adFee: 수기 입력
    const existing = await loadReport(year, month);
    if (existing) {
      reportData.offline = existing.offline;
      reportData.naver.fees.adFee = existing.naver.fees.adFee;

      // 보존된 데이터로 파생 필드 재계산
      // (collectMonthlyData는 offline=빈값·adFee=0 기준으로 계산했으므로)
      reportData.naver.profit = calcOnlineProfit(
        reportData.naver.revenue,
        reportData.naver.fees
      );
      reportData.offline.profit = calcOfflineProfit(
        reportData.offline.revenue,
        reportData.offline.fees
      );

      const mapping = await loadProductMapping();
      reportData.summary = calcOverallSummary(
        reportData.naver,
        reportData.coupang,
        reportData.offline
      );
      reportData.offlineRanking = calcPlatformRanking(
        reportData.offline.products,
        3,
        mapping
      );
      reportData.overallRanking = calcOverallRanking(
        reportData.naver.products,
        reportData.coupang.products,
        reportData.offline.products,
        mapping,
        5
      );
      reportData.productMatrix = calcProductMatrix(
        reportData.naver.products,
        reportData.coupang.products,
        reportData.offline.products,
        mapping
      );
    }

    // 3) AI 인사이트 생성 (API 키 없거나 실패해도 빈 배열로 저장)
    let insights: Awaited<ReturnType<typeof generateSalesInsights>> = [];
    try {
      insights = await generateSalesInsights(reportData);
    } catch (insightErr) {
      console.warn("[scrape] 인사이트 생성 실패 (데이터는 저장됩니다):", insightErr);
    }

    const report = { ...reportData, insights };

    // 4) 파일 저장
    await saveReport(report);

    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "데이터 수집 실패";
    console.error("[POST /api/scrape]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
