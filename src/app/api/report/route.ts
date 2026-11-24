import { NextRequest, NextResponse } from "next/server";
import {
  loadReport,
  updateReport,
  listReports,
} from "@/lib/storage/report-store";
import {
  errorJson,
  serverErrorJson,
  parseYearMonth,
} from "@/lib/utils/api-response";

/**
 * GET /api/report
 *   → 저장된 레포트 목록 반환 [{ year, month }, ...]
 *
 * GET /api/report?year=2026&month=2
 *   → 해당 월 레포트 반환
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");

    if (!yearParam || !monthParam) {
      const list = await listReports();
      return NextResponse.json(list);
    }

    const period = parseYearMonth(yearParam, monthParam);
    if (!period) {
      return errorJson("year, month는 숫자여야 합니다.", 400);
    }
    const { year, month } = period;

    const report = await loadReport(year, month);
    if (!report) {
      return errorJson(`${year}년 ${month}월 레포트가 없습니다.`, 404);
    }

    return NextResponse.json(report);
  } catch (error) {
    return serverErrorJson(error, "조회 실패");
  }
}

/**
 * PATCH /api/report
 *
 * 레포트 수기 편집. 변경된 필드만 전송하면 됩니다.
 * profit·handmadeRanking은 자동 재계산됩니다.
 *
 * body 예시:
 * {
 *   "year": 2026,
 *   "month": 2,
 *   "naver": { "fees": { "adFee": 150000 } },
 *   "offline": { "revenue": 500000 }
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      year, month, naver, coupang, offline,
      offlineVenueId, addOfflineVenue, removeOfflineVenueId,
      sponsorship, insights,
    } = body;

    if (!year || !month) {
      return errorJson("year, month 필드가 필요합니다.", 400);
    }

    const updated = await updateReport(year, month, {
      naver,
      coupang,
      offline,
      offlineVenueId,
      addOfflineVenue,
      removeOfflineVenueId,
      sponsorship,
      insights,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return serverErrorJson(error, "수정 실패");
  }
}
