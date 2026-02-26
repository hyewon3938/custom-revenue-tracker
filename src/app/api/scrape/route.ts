import { NextRequest, NextResponse } from "next/server";
import { collectMonthlyData } from "@/lib/scrapers";
import { loadReport, saveReport } from "@/lib/storage/report-store";
import {
  loadProductMapping,
  syncNewProductsToMapping,
} from "@/lib/storage/mapping-store";
import {
  calcPlatformProfit,
  calcOfflineVenueProfit,
} from "@/lib/calculations/profit";
import { rebuildDerivedFields } from "@/lib/calculations/ranking";
import {
  MonthlyReport,
  OfflineData,
  PlatformFees,
  SponsorshipData,
} from "@/lib/types";
import { OFFLINE_MATERIAL_RATE } from "@/lib/config";

const EMPTY_FEES: PlatformFees = {
  settlementAmount: 0,
  logisticsFee: 0,
  commissionFee: 0,
  adFee: 0,
};

const DEFAULT_SPONSORSHIP: SponsorshipData = {
  items: [],
  marketingCost: 0,
  totalQuantity: 0,
  handmadeQuantity: 0,
};

/**
 * POST /api/scrape
 *
 * 네이버·쿠팡 데이터를 수집하고 저장합니다.
 * body: { year?: number, month?: number }
 *   생략 시 현재 연/월 사용
 *
 * 수집 파이프라인:
 * 1) 스크레이핑 (순수 수집)
 * 2) 신규 상품 매핑 동기화
 * 3) 수기 입력 데이터 보존 (재수집 시) 또는 초기화
 * 4) 파생 필드 계산 (summary·ranking·matrix)
 * 5) 저장
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

    // 1) 스크레이핑 (순수 수집만)
    const raw = await collectMonthlyData(year, month);

    // 2) 신규 상품 매핑 동기화
    const addedCount = await syncNewProductsToMapping(
      raw.naver.products,
      raw.coupang.products
    );
    if (addedCount > 0) {
      console.log(
        `[매핑] 신규 상품 ${addedCount}개를 product-mapping.json에 추가했습니다.`
      );
      console.log(
        `  → data/product-mapping.json을 열어 canonical 이름을 확인해주세요.`
      );
    }

    // 3) 재수집인 경우 수기 입력 데이터 보존, 신규면 초기화
    //    - offline: 전체 (매출·비용·상품별 수량 모두 수기 입력)
    //    - sponsorship: 협찬 마케팅 데이터 (수기 입력)
    const existing = await loadReport(year, month);

    const offline: OfflineData[] = existing
      ? existing.offline.map(calcOfflineVenueProfit)
      : [
          {
            venueId: "gosan",
            venueName: "고산의낮",
            revenue: 0,
            totalQuantity: 0,
            handmadeQuantity: 0,
            otherQuantity: 0,
            fees: EMPTY_FEES,
            profit: calcPlatformProfit(0, EMPTY_FEES, 0, OFFLINE_MATERIAL_RATE),
            products: [],
          },
        ];

    const sponsorship: SponsorshipData =
      existing?.sponsorship ?? DEFAULT_SPONSORSHIP;

    // 4) 파생 필드 계산 (summary·ranking·matrix)
    const mapping = await loadProductMapping();
    const derived = rebuildDerivedFields(
      raw.naver,
      raw.coupang,
      offline,
      sponsorship,
      mapping
    );

    // 5) 저장
    //    인사이트는 사용자가 수기 데이터 입력 후 직접 생성 (POST /api/insights)
    const timestamp = new Date().toISOString();
    const report: MonthlyReport = {
      period: raw.period,
      dataRange: raw.dataRange,
      naver: raw.naver,
      coupang: raw.coupang,
      offline,
      sponsorship,
      ...derived,
      insights: existing?.insights ?? [],
      collectedAt: timestamp,
      lastModifiedAt: timestamp,
    };

    await saveReport(report);

    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "데이터 수집 실패";
    console.error("[POST /api/scrape]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
