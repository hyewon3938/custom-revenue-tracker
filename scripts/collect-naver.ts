/**
 * 네이버 2026년 2월 데이터 한번에 수집
 * 실행: npx tsx scripts/collect-naver.ts
 */
import { chromium } from "playwright";
import { loginNaver } from "../src/lib/scrapers/naver-auth";
import { getValidSessionPath } from "../src/lib/scrapers/session-store";
import { scrapeNaverSalesAnalysis } from "../src/lib/scrapers/naver-sales";
import { scrapeNaverSettlement } from "../src/lib/scrapers/naver-settlement";
import { scrapeNaverOrders } from "../src/lib/scrapers/naver-orders";

const YEAR = 2026, MONTH = 2;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const fmt = (n: number) => n.toLocaleString("ko-KR") + "원";

(async () => {
  const sessionPath = await getValidSessionPath("naver");
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    userAgent: UA,
    ...(sessionPath ? { storageState: sessionPath } : {}),
  });
  const page = await ctx.newPage();

  try {
    await loginNaver(page, ctx);
    console.log("✅ 로그인 완료\n");

    // ── 판매분석 ──
    console.log("[1/3] 판매분석 수집 중...");
    const sales = await scrapeNaverSalesAnalysis(page, YEAR, MONTH);
    console.log("  매출:", fmt(sales.totalRevenue));
    console.log("  결제자수:", sales.payerCount, "명");
    console.log("  배송 - 일반:", sales.shippingStats.regularCount, "건 / 무료:", sales.shippingStats.freeCount, "건");
    console.log("  판매자 배송비 부담:", fmt(sales.shippingStats.sellerCost));

    // ── 정산내역 ──
    console.log("\n[2/3] 정산내역 수집 중...");
    const settlement = await scrapeNaverSettlement(page, YEAR, MONTH);
    console.log("  정산금:", fmt(settlement.settlementAmount));
    console.log("  수수료:", fmt(settlement.commissionFee));

    // ── 주문통합검색 ──
    console.log("\n[3/3] 주문 수집 중...");
    const orders = await scrapeNaverOrders(page, YEAR, MONTH);
    const totalQty = orders.reduce((s, p) => s + p.quantity, 0);
    const handmadeQty = orders.filter(p => p.category === "handmade").reduce((s, p) => s + p.quantity, 0);

    // ── 최종 요약 ──
    const materialCost = Math.round(sales.totalRevenue * 0.15);
    const platformFee = settlement.commissionFee + sales.shippingStats.sellerCost;
    const grossProfit = sales.totalRevenue - platformFee;
    const netProfit = grossProfit - materialCost;

    console.log("\n══════════════════════════════════");
    console.log(`  네이버 ${YEAR}년 ${MONTH}월 수집 결과`);
    console.log("══════════════════════════════════");
    console.log("  매출:          ", fmt(sales.totalRevenue));
    console.log("  수수료:        ", fmt(settlement.commissionFee));
    console.log("  배송비(부담):  ", fmt(sales.shippingStats.sellerCost));
    console.log("  부자재비(15%): ", fmt(materialCost));
    console.log("  ──────────────────────────────");
    console.log("  플랫폼 순이익: ", fmt(netProfit));
    console.log("  전체 판매수량: ", totalQty, "개 (끈갈피:", handmadeQty, "개)");
    console.log("\n  상품별 판매수량:");
    orders
      .sort((a, b) => b.quantity - a.quantity)
      .forEach(p => console.log(`    [${p.category === "handmade" ? "끈갈피" : "기타  "}] ${p.quantity}개 — ${p.productName.slice(0, 40)}`));

    console.log("\n  Raw JSON:");
    console.log(JSON.stringify({ sales, settlement, orders }, null, 2));

  } catch (e) {
    console.error("❌ 에러:", e);
  } finally {
    await browser.close();
  }
})();
