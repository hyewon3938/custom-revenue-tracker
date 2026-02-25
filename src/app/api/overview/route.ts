import { NextResponse } from "next/server";
import { listReports, loadReport } from "@/lib/storage/report-store";
import { MonthlyOverview, OverviewResponse } from "@/lib/types";

/**
 * GET /api/overview
 *
 * 저장된 전체 월별 레포트를 집계해 인사이트 차트용 데이터를 반환.
 * 각 월의 MonthlyReport를 병렬 로드 후 차트에 필요한 필드만 추출.
 * 마진율은 서버에서 미리 계산해 내려보냄.
 */
export async function GET() {
  try {
    const list = await listReports(); // 최신순

    const results = await Promise.all(
      list.map(({ year, month }) => loadReport(year, month))
    );

    const months: MonthlyOverview[] = results
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => ({
        period: r.period,
        label: `${r.period.year}.${String(r.period.month).padStart(2, "0")}`,
        totalRevenue: r.summary.totalRevenue,
        totalNetProfit: r.summary.totalNetProfit,
        totalQuantity: r.summary.totalQuantity,
        handmadeQuantity: r.summary.handmadeQuantity,
        otherQuantity: r.summary.otherQuantity,
        marginRate:
          r.summary.totalRevenue > 0
            ? Math.round(
                (r.summary.totalNetProfit / r.summary.totalRevenue) * 1000
              ) / 10
            : 0,
        naverRevenue: r.naver.revenue,
        coupangRevenue: r.coupang.revenue,
        offlineRevenue: r.offline.reduce((s: number, v: { revenue: number }) => s + v.revenue, 0),
      }))
      // 차트 X축: 오름차순 (과거 → 최신)
      .sort((a, b) =>
        a.period.year !== b.period.year
          ? a.period.year - b.period.year
          : a.period.month - b.period.month
      );

    const totals = months.reduce(
      (acc, m) => ({
        totalQuantity: acc.totalQuantity + m.totalQuantity,
        handmadeQuantity: acc.handmadeQuantity + m.handmadeQuantity,
        totalRevenue: acc.totalRevenue + m.totalRevenue,
        totalNetProfit: acc.totalNetProfit + m.totalNetProfit,
      }),
      {
        totalQuantity: 0,
        handmadeQuantity: 0,
        totalRevenue: 0,
        totalNetProfit: 0,
      }
    );

    return NextResponse.json({ months, totals } satisfies OverviewResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "집계 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
