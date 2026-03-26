/**
 * 쿠팡 RG Order API 통합 테스트
 * 실행: npx tsx scripts/test-coupang-api.ts [year] [month]
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

import { getRgOrders } from "../src/lib/coupang-api/orders";

const fmt = (n: number) => n.toLocaleString("ko-KR") + "원";

async function main() {
  const [, , yearStr = "2026", monthStr = "2"] = process.argv;
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const pad = (n: number) => String(n).padStart(2, "0");

  const vendorId = process.env.COUPANG_VENDOR_ID;
  if (!vendorId) {
    console.error("COUPANG_VENDOR_ID 환경변수가 필요합니다.");
    process.exit(1);
  }

  const startDate = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${pad(month)}-${pad(lastDay)}`;

  console.log(`\n쿠팡 RG Order API 테스트: ${startDate} ~ ${endDate}\n`);

  const orders = await getRgOrders(vendorId, startDate, endDate);
  console.log(`전체 주문: ${orders.length}건`);

  let totalRevenue = 0;
  const productMap = new Map<string, { qty: number; revenue: number }>();

  for (const order of orders) {
    for (const item of order.orderItems) {
      const price = parseFloat(item.unitSalesPrice) || 0;
      const qty = item.salesQuantity;
      totalRevenue += price * qty;

      const existing = productMap.get(item.productName);
      if (existing) {
        existing.qty += qty;
        existing.revenue += price * qty;
      } else {
        productMap.set(item.productName, { qty, revenue: price * qty });
      }
    }
  }

  console.log(`매출 합계: ${fmt(totalRevenue)}`);
  console.log(`상품 종류: ${productMap.size}개\n`);
  console.log("상품별 수량:");
  Array.from(productMap.entries())
    .sort((a, b) => b[1].qty - a[1].qty)
    .forEach(([name, { qty, revenue }]) =>
      console.log(`  ${qty}개 (${fmt(revenue)}) — ${name.slice(0, 50)}`)
    );

  console.log("\n테스트 완료");
}

main().catch((e) => {
  console.error("에러:", e);
  process.exit(1);
});
