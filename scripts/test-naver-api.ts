/**
 * 네이버 커머스 API 통합 테스트
 * 실행: npx tsx scripts/test-naver-api.ts [year] [month]
 */
import { resolve } from "path";
import { existsSync, readFileSync } from "fs";

// .env.local 수동 로드
const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

import { getOrders, filterValidOrders } from "../src/lib/naver-api/orders";
import { getSettlements } from "../src/lib/naver-api/settlement";

const fmt = (n: number) => n.toLocaleString("ko-KR") + "원";

async function main() {
  const [, , yearStr = "2026", monthStr = "2"] = process.argv;
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const pad = (n: number) => String(n).padStart(2, "0");

  const startDate = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${pad(month)}-${pad(lastDay)}`;

  console.log(`\n네이버 커머스 API 테스트: ${startDate} ~ ${endDate}\n`);

  // 1. 주문 API
  console.log("[1/2] 주문 조회 중...");
  const allOrders = await getOrders(startDate, endDate);
  const validOrders = filterValidOrders(allOrders);

  const revenue = validOrders.reduce((s, o) => s + o.totalPaymentAmount, 0);
  const shipping = validOrders.reduce((s, o) => s + o.deliveryFeeAmount, 0);
  const uniqueOrders = new Set(validOrders.map((o) => o.orderId)).size;

  // 제품별 집계
  const productMap = new Map<string, number>();
  for (const o of validOrders) {
    productMap.set(o.productName, (productMap.get(o.productName) ?? 0) + o.quantity);
  }

  console.log(`  전체 주문: ${allOrders.length}건 (유효: ${validOrders.length}건)`);
  console.log(`  매출: ${fmt(revenue)}`);
  console.log(`  배송비 수입: ${fmt(shipping)}`);
  console.log(`  결제자수: ${uniqueOrders}명`);
  console.log(`  상품 종류: ${productMap.size}개`);
  console.log("  상품별 수량:");
  Array.from(productMap.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, qty]) => console.log(`    ${qty}개 — ${name.slice(0, 50)}`));

  // 2. 정산 API
  console.log("\n[2/2] 정산 조회 중...");
  const settlements = await getSettlements(startDate, endDate);
  const settleAmount = settlements.reduce((s, e) => s + e.settleAmount, 0);
  const commission = Math.abs(settlements.reduce((s, e) => s + e.commissionSettleAmount, 0));

  console.log(`  정산 내역: ${settlements.length}건`);
  console.log(`  정산금액: ${fmt(settleAmount)}`);
  console.log(`  수수료: ${fmt(commission)}`);

  console.log("\n테스트 완료");
}

main().catch((e) => {
  console.error("에러:", e);
  process.exit(1);
});
