/**
 * 쿠팡 데이터 한번에 수집
 * 실행: npx tsx scripts/collect-coupang.ts
 */
import { chromium } from "playwright";
import { loginCoupang } from "../src/lib/scrapers/coupang-auth";
import { getValidSessionPath } from "../src/lib/scrapers/session-store";
import { scrapeCoupangSalesAnalysis } from "../src/lib/scrapers/coupang-sales";
import { scrapeCoupangSettlement } from "../src/lib/scrapers/coupang-settlement";

const YEAR = 2026, MONTH = 2;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const fmt = (n: number) => n.toLocaleString("ko-KR") + "원";

(async () => {
  const sessionPath = await getValidSessionPath("coupang");
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    userAgent: UA,
    ...(sessionPath ? { storageState: sessionPath } : {}),
  });
  const page = await ctx.newPage();

  try {
    await loginCoupang(page, ctx);
    console.log("✅ 로그인 완료\n");

    // ── 판매분석 ──
    console.log("[1/2] 판매분석 수집 중...");
    const sales = await scrapeCoupangSalesAnalysis(page, YEAR, MONTH);
    console.log("  매출:", fmt(sales.totalRevenue));
    console.log("  상품 종류:", sales.products.length, "종");

    // ── 정산 ──
    console.log("\n[2/2] 정산 수집 중...");
    const settlement = await scrapeCoupangSettlement(page, YEAR, MONTH);
    console.log("  매출(정산기준):", fmt(settlement.revenue));
    console.log("  물류비:", fmt(settlement.logisticsFee));
    console.log("  수수료:", fmt(settlement.commissionFee));
    console.log("  광고비:", fmt(settlement.adFee));

    // ── 최종 요약 ──
    const revenue = settlement.revenue || sales.totalRevenue;
    const materialCost = Math.round(revenue * 0.15);
    const platformFee = settlement.logisticsFee + settlement.commissionFee + settlement.adFee;
    const grossProfit = revenue - platformFee;
    const netProfit = grossProfit - materialCost;
    const totalQty = sales.products.reduce((s, p) => s + p.quantity, 0);
    const handmadeQty = sales.products.filter(p => p.category === "handmade").reduce((s, p) => s + p.quantity, 0);

    console.log("\n══════════════════════════════════");
    console.log(`  쿠팡 ${YEAR}년 ${MONTH}월 수집 결과`);
    console.log("══════════════════════════════════");
    console.log("  매출:          ", fmt(revenue));
    console.log("  물류비:        ", fmt(settlement.logisticsFee));
    console.log("  수수료:        ", fmt(settlement.commissionFee));
    console.log("  광고비:        ", fmt(settlement.adFee));
    console.log("  부자재비(15%): ", fmt(materialCost));
    console.log("  ──────────────────────────────");
    console.log("  플랫폼 순이익: ", fmt(netProfit));
    console.log("  전체 판매수량: ", totalQty, "개 (끈갈피:", handmadeQty, "개)");
    console.log("\n  상품별 판매수량:");
    sales.products
      .sort((a, b) => b.quantity - a.quantity)
      .forEach(p => console.log(`    [${p.category === "handmade" ? "끈갈피" : "기타  "}] ${p.quantity}개 — ${p.productName.slice(0, 40)}`));

    console.log("\n  Raw JSON:");
    console.log(JSON.stringify({ sales, settlement }, null, 2));

  } catch (e) {
    console.error("❌ 에러:", e);
  } finally {
    await browser.close();
  }
})();
