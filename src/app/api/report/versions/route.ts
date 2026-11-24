import { NextRequest, NextResponse } from "next/server";
import { listVersions, restoreVersion } from "@/lib/storage/report-store";
import {
  errorJson,
  serverErrorJson,
  parseYearMonth,
} from "@/lib/utils/api-response";

/**
 * GET /api/report/versions?year=X&month=Y
 * 특정 월의 백업 버전 목록을 반환합니다.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");

    if (!yearParam || !monthParam) {
      return errorJson("year, month 파라미터가 필요합니다.", 400);
    }

    const period = parseYearMonth(yearParam, monthParam);
    if (!period) {
      return errorJson("year, month는 숫자여야 합니다.", 400);
    }

    const versions = await listVersions(period.year, period.month);
    return NextResponse.json(versions);
  } catch (error) {
    return serverErrorJson(error, "버전 목록 조회 실패");
  }
}

/**
 * POST /api/report/versions
 * 백업 버전으로 복구합니다. 현재 데이터는 자동으로 백업됩니다.
 * body: { year: number, month: number, timestamp: number }
 */
export async function POST(request: NextRequest) {
  try {
    const { year, month, timestamp } = await request.json();

    if (!year || !month || !timestamp) {
      return errorJson("year, month, timestamp 필드가 필요합니다.", 400);
    }

    const report = await restoreVersion(year, month, timestamp);
    return NextResponse.json(report);
  } catch (error) {
    return serverErrorJson(error, "버전 복구 실패");
  }
}
