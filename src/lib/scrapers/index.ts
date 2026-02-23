import { chromium } from "playwright";
import { MonthlyReport, PlatformData, OfflineData } from "@/lib/types";
import { loginNaver } from "./naver-auth";
import { loginCoupang } from "./coupang-auth";
import { scrapeNaverOrders } from "./naver-orders";
import { scrapeNaverSalesAnalysis } from "./naver-sales";
import { scrapeNaverSettlement } from "./naver-settlement";
import { scrapeCoupangSalesAnalysis } from "./coupang-sales";
import { scrapeCoupangSettlement } from "./coupang-settlement";
import {
  calculateProfit,
  calculateHandmadeRanking,
} from "@/lib/calculations/profit";

const EMPTY_FEES = {
  settlementAmount: 0,
  logisticsFee: 0,
  commissionFee: 0,
  shippingFee: 0,
  adFee: 0,
};

async function collectNaverData(
  year: number,
  month: number
): Promise<PlatformData> {
  const browser = await chromium.launch({
    // headless: false → 2FA·캡차 대응 및 로그인 상태 확인용
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    await loginNaver(page);

    // 세 페이지를 순차 수집 (같은 브라우저 컨텍스트, 같은 세션 공유)
    const [salesResult, fees, products] = await Promise.allSettled([
      scrapeNaverSalesAnalysis(page, year, month),
      scrapeNaverSettlement(page, year, month),
      scrapeNaverOrders(page, year, month),
    ]);

    if (salesResult.status === "rejected")
      console.error("[naver-sales] 오류:", salesResult.reason);
    if (fees.status === "rejected")
      console.error("[naver-settlement] 오류:", fees.reason);
    if (products.status === "rejected")
      console.error("[naver-orders] 오류:", products.reason);

    return {
      platform: "naver",
      revenue:
        salesResult.status === "fulfilled"
          ? salesResult.value.totalRevenue
          : 0,
      fees: fees.status === "fulfilled" ? fees.value : EMPTY_FEES,
      products: products.status === "fulfilled" ? products.value : [],
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function collectCoupangData(
  year: number,
  month: number
): Promise<PlatformData> {
  const browser = await chromium.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    await loginCoupang(page);

    const [salesResult, fees] = await Promise.allSettled([
      scrapeCoupangSalesAnalysis(page, year, month),
      scrapeCoupangSettlement(page, year, month),
    ]);

    if (salesResult.status === "rejected")
      console.error("[coupang-sales] 오류:", salesResult.reason);
    if (fees.status === "rejected")
      console.error("[coupang-settlement] 오류:", fees.reason);

    const sales =
      salesResult.status === "fulfilled"
        ? salesResult.value
        : { totalRevenue: 0, products: [] };

    return {
      platform: "coupang",
      revenue: sales.totalRevenue,
      fees: fees.status === "fulfilled" ? fees.value : EMPTY_FEES,
      products: sales.products,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

/**
 * 네이버·쿠팡 데이터를 수집하고 MonthlyReport(insights 제외)를 반환.
 * 오프라인 매출은 초기값 0으로 설정 — 이후 /api/report PATCH로 수기 입력.
 */
export async function collectMonthlyData(
  year: number,
  month: number
): Promise<Omit<MonthlyReport, "insights">> {
  // 네이버·쿠팡 브라우저를 병렬로 실행
  const [naverData, coupangData] = await Promise.all([
    collectNaverData(year, month),
    collectCoupangData(year, month),
  ]);

  const offline: OfflineData = {
    revenue: 0,
    products: [],
    fees: { logisticsFee: 0, shippingFee: 0 },
  };

  const profit = calculateProfit(naverData, coupangData, offline);
  const handmadeRanking = calculateHandmadeRanking(
    naverData,
    coupangData,
    offline
  );

  const now = new Date().toISOString();
  return {
    period: { year, month },
    naver: naverData,
    coupang: coupangData,
    offline,
    profit,
    handmadeRanking,
    collectedAt: now,
    lastModifiedAt: now,
  };
}
