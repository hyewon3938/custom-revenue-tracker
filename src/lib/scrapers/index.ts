import { chromium, Browser, BrowserContext, Page } from "playwright";
import {
  MonthlyReport,
  NaverData,
  CoupangData,
  OfflineData,
  PlatformFees,
  ShippingStats,
} from "@/lib/types";
import { loginNaver } from "./naver-auth";
import { loginCoupang } from "./coupang-auth";
import { getValidSessionPath } from "./session-store";
import { scrapeNaverOrders } from "./naver-orders";
import { scrapeNaverSalesAnalysis } from "./naver-sales";
import { scrapeNaverSettlement } from "./naver-settlement";
import { scrapeCoupangSalesAnalysis } from "./coupang-sales";
import { scrapeCoupangSettlement } from "./coupang-settlement";
import {
  calcOnlineProfit,
  calcOfflineProfit,
  calcOverallSummary,
  calcPlatformRanking,
  calcOverallRanking,
  calcProductMatrix,
  calcSponsorExcludedRanking,
} from "@/lib/calculations/profit";
import { loadProductMapping, syncNewProductsToMapping } from "@/lib/storage/mapping-store";

const EMPTY_FEES: PlatformFees = {
  settlementAmount: 0,
  logisticsFee: 0,
  commissionFee: 0,
  adFee: 0,
};

const EMPTY_SHIPPING_STATS: ShippingStats = {
  regularCount: 0,
  freeCount: 0,
  sellerCost: 0,
};

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * 공통 브라우저 + 컨텍스트 + 페이지 생성.
 * storageStatePath가 주어지면 저장된 쿠키/스토리지를 복원한다.
 * 세션 파일이 손상된 경우 경고 후 빈 컨텍스트로 재시도.
 */
async function createBrowserPage(storageStatePath?: string | null): Promise<{
  browser: Browser;
  context: BrowserContext;
  page: Page;
}> {
  const browser = await chromium.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  let context: BrowserContext;
  try {
    context = await browser.newContext({
      userAgent: BROWSER_UA,
      ...(storageStatePath ? { storageState: storageStatePath } : {}),
    });
  } catch {
    console.warn("[세션] 세션 파일 로드 실패 — 새 컨텍스트로 재시도");
    context = await browser.newContext({ userAgent: BROWSER_UA });
  }

  const page = await context.newPage();
  return { browser, context, page };
}

/**
 * 조회 기간 결정:
 * - 이번 달이면 1일 ~ 어제
 * - 지난 달(과거)이면 1일 ~ 말일
 */
export function getDateRange(
  year: number,
  month: number
): { start: string; end: string } {
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() + 1 === month;

  const lastDay = new Date(year, month, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");

  const endDay = isCurrentMonth ? today.getDate() - 1 : lastDay;

  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(endDay)}`,
  };
}

async function collectNaverData(
  year: number,
  month: number
): Promise<NaverData> {
  const sessionPath = await getValidSessionPath("naver");
  const { browser, context, page } = await createBrowserPage(sessionPath);

  try {
    await loginNaver(page, context);

    // 순차 수집 (세션 공유)
    const salesResult = await scrapeNaverSalesAnalysis(page, year, month).catch(
      (e) => { console.error("[naver-sales]", e); return null; }
    );
    const settlementResult = await scrapeNaverSettlement(page, year, month).catch(
      (e) => { console.error("[naver-settlement]", e); return null; }
    );
    const productsResult = await scrapeNaverOrders(page, year, month).catch(
      (e) => { console.error("[naver-orders]", e); return []; }
    );

    const revenue = salesResult?.totalRevenue ?? 0;
    const shippingStats = salesResult?.shippingStats ?? EMPTY_SHIPPING_STATS;
    const fees: PlatformFees = {
      commissionFee: settlementResult?.commissionFee ?? 0,
      logisticsFee: shippingStats.sellerCost, // 네이버 물류비 = 판매자 부담 배송비
      adFee: 0, // 수기 입력
      settlementAmount: settlementResult?.settlementAmount ?? 0,
    };
    const products = productsResult ?? [];
    const handmadeQuantity = products
      .filter((p) => p.category === "handmade")
      .reduce((s, p) => s + p.quantity, 0);
    const totalQuantity = products.reduce((s, p) => s + p.quantity, 0);

    return {
      revenue,
      totalQuantity,
      handmadeQuantity,
      otherQuantity: totalQuantity - handmadeQuantity,
      fees,
      shippingStats,
      profit: calcOnlineProfit(revenue, fees),
      products,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function collectCoupangData(
  year: number,
  month: number
): Promise<CoupangData> {
  const sessionPath = await getValidSessionPath("coupang");
  const { browser, context, page } = await createBrowserPage(sessionPath);

  try {
    await loginCoupang(page, context);

    const salesResult = await scrapeCoupangSalesAnalysis(page, year, month).catch(
      (e) => { console.error("[coupang-sales]", e); return null; }
    );
    const settlementResult = await scrapeCoupangSettlement(page, year, month).catch(
      (e) => { console.error("[coupang-settlement]", e); return null; }
    );

    const revenue = settlementResult?.revenue ?? 0;
    const fees: PlatformFees = {
      commissionFee: settlementResult?.commissionFee ?? 0,
      logisticsFee: settlementResult?.logisticsFee ?? 0,
      adFee: settlementResult?.adFee ?? 0,
      settlementAmount: 0, // 쿠팡은 정산금 없음
    };
    const products = salesResult?.products ?? [];
    const handmadeQuantity = products
      .filter((p) => p.category === "handmade")
      .reduce((s, p) => s + p.quantity, 0);
    const totalQuantity = products.reduce((s, p) => s + p.quantity, 0);

    return {
      revenue,
      totalQuantity,
      handmadeQuantity,
      otherQuantity: totalQuantity - handmadeQuantity,
      fees,
      profit: calcOnlineProfit(revenue, fees),
      products,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

/**
 * 네이버·쿠팡 데이터를 수집하고 MonthlyReport(insights 제외)를 반환.
 * 오프라인(고산의낮) 데이터는 0으로 초기화 — 이후 /api/report PATCH로 수기 입력.
 */
export async function collectMonthlyData(
  year: number,
  month: number
): Promise<Omit<MonthlyReport, "insights">> {
  const dateRange = getDateRange(year, month);

  const [naverData, coupangData] = await Promise.all([
    collectNaverData(year, month),
    collectCoupangData(year, month),
  ]);

  const offlineFees: PlatformFees = EMPTY_FEES;
  const offline: OfflineData[] = [
    {
      venueId: "gosan",
      venueName: "고산의낮",
      revenue: 0,
      totalQuantity: 0,
      handmadeQuantity: 0,
      otherQuantity: 0,
      fees: offlineFees,
      profit: calcOfflineProfit(0, offlineFees),
      products: [],
    },
  ];

  // 새 상품이 있으면 매핑 파일에 자동 추가
  const addedCount = await syncNewProductsToMapping(
    naverData.products,
    coupangData.products
  );
  if (addedCount > 0) {
    console.log(
      `[매핑] 신규 상품 ${addedCount}개를 product-mapping.json에 추가했습니다.`
    );
    console.log(
      `  → data/product-mapping.json을 열어 canonical 이름을 확인해주세요.`
    );
  }

  const mapping = await loadProductMapping();

  // 협찬 초기값 (수기 입력이므로 빈 상태로 시작)
  const sponsorship = {
    items: [],
    marketingCost: 0,
    totalQuantity: 0,
    handmadeQuantity: 0,
  };

  const allOfflineProducts = offline.flatMap((v) => v.products);
  const summary = calcOverallSummary(naverData, coupangData, offline, 0);
  const naverRanking = calcPlatformRanking(naverData.products, 3, mapping);
  const coupangRanking = calcPlatformRanking(coupangData.products, 3, mapping);
  const offlineRanking = calcPlatformRanking(allOfflineProducts, 3, mapping);
  const overallRanking = calcOverallRanking(
    naverData.products,
    coupangData.products,
    allOfflineProducts,
    mapping,
    5
  );
  const sponsorExcludedRanking = calcSponsorExcludedRanking(
    naverData.products,
    coupangData.products,
    allOfflineProducts,
    [],
    mapping,
    5
  );
  const productMatrix = calcProductMatrix(
    naverData.products,
    coupangData.products,
    allOfflineProducts,
    mapping
  );

  const now = new Date().toISOString();
  return {
    period: { year, month },
    dataRange: dateRange,
    naver: naverData,
    coupang: coupangData,
    offline,
    sponsorship,
    summary,
    naverRanking,
    coupangRanking,
    offlineRanking,
    overallRanking,
    sponsorExcludedRanking,
    productMatrix,
    collectedAt: now,
    lastModifiedAt: now,
  };
}
