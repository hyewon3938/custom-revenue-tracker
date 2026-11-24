import { NextResponse } from "next/server";
import { loadAllReports } from "@/lib/storage/report-store";
import { buildOverviewData } from "@/lib/calculations/overview";
import { serverErrorJson } from "@/lib/utils/api-response";

/**
 * GET /api/overview
 *
 * 저장된 전체 월별 레포트를 집계해 인사이트 차트용 데이터를 반환.
 * 각 월의 MonthlyReport를 병렬 로드 후 차트에 필요한 필드만 추출.
 * 마진율은 서버에서 미리 계산해 내려보냄.
 */
export async function GET() {
  try {
    const reports = await loadAllReports(); // 최신순
    return NextResponse.json(buildOverviewData(reports));
  } catch (error) {
    return serverErrorJson(error, "집계 실패");
  }
}
