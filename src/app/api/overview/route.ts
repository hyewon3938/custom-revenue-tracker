import { NextResponse } from "next/server";
import { listReports, loadReport } from "@/lib/storage/report-store";
import { buildOverviewData } from "@/lib/calculations/overview";
import { getErrorMessage } from "@/lib/utils/error";

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

    const reports = results.filter(
      (r): r is NonNullable<typeof r> => r !== null
    );

    return NextResponse.json(buildOverviewData(reports));
  } catch (error) {
    const message = getErrorMessage(error, "집계 실패");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
