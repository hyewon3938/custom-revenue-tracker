import { chromium, Browser, BrowserContext, Page } from "playwright";
import { NaverData, CoupangData, PlatformFees } from "@/lib/types";
import { pad } from "@/lib/utils/format";
import { loginNaver } from "./naver-auth";
import { loginCoupang } from "./coupang-auth";
import { getValidSessionPath } from "./session-store";
import { scrapeNaverOrders } from "./naver-orders";
import { scrapeNaverSalesAnalysis } from "./naver-sales";
import { scrapeNaverSettlement } from "./naver-settlement";
import { scrapeCoupangSalesAnalysis } from "./coupang-sales";
import { scrapeCoupangSettlement } from "./coupang-settlement";
import {
  calcPlatformProfit,
  calcNaverShippingStats,
  naverMaterialBase,
  coupangMaterialBase,
} from "@/lib/calculations/profit";

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
    const shippingCollected = salesResult?.shippingCollected ?? 0;
    const payerCount = salesResult?.payerCount ?? 0;
    const shippingStats = calcNaverShippingStats(shippingCollected, payerCount);
    const fees: PlatformFees = {
      commissionFee: settlementResult?.commissionFee ?? 0,
      logisticsFee: shippingStats.sellerCost,
      adFee: 0,
      settlementAmount: settlementResult?.settlementAmount ?? 0,
    };
    const products = productsResult ?? [];
    const handmadeQuantity = products
      .filter((p) => p.category === "handmade")
      .reduce((s, p) => s + p.quantity, 0);
    const totalQuantity = products.reduce((s, p) => s + p.quantity, 0);

    return {
      revenue,
      shippingCollected,
      payerCount,
      totalQuantity,
      handmadeQuantity,
      otherQuantity: totalQuantity - handmadeQuantity,
      fees,
      shippingStats,
      profit: calcPlatformProfit(
        revenue, fees, naverMaterialBase(revenue, shippingCollected)
      ),
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
      profit: calcPlatformProfit(
        revenue, fees, coupangMaterialBase(revenue, totalQuantity)
      ),
      products,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

/**
 * 네이버·쿠팡 데이터를 수집해 원시 결과만 반환.
 * 오프라인/협찬/매핑 동기화/파생 필드 계산은 호출자(scrape/route.ts)가 담당.
 */
export async function collectMonthlyData(
  year: number,
  month: number
): Promise<{
  naver: NaverData;
  coupang: CoupangData;
  period: { year: number; month: number };
  dataRange: { start: string; end: string };
}> {
  const dataRange = getDateRange(year, month);

  const [naver, coupang] = await Promise.all([
    collectNaverData(year, month),
    collectCoupangData(year, month),
  ]);

  return { naver, coupang, period: { year, month }, dataRange };
}
