import { ProductSales, ScrapeWarning } from "@/lib/types";
import { detectCategory } from "@/lib/calculations/product";
import { getRgOrders } from "./orders";

/**
 * 쿠팡 RG Order API로 주문 데이터 수집.
 * 기존 coupang-sales.ts 스크레이퍼를 대체.
 *
 * 반환: 제품별 판매수량 + 매출 합계
 * (정산 데이터는 별도 스크레이퍼로 수집)
 */
export async function collectCoupangOrdersViaApi(
  vendorId: string,
  startDate: string,
  endDate: string
): Promise<{
  products: ProductSales[];
  revenue: number;
  warnings: ScrapeWarning[];
}> {
  const warnings: ScrapeWarning[] = [];
  let products: ProductSales[] = [];
  let revenue = 0;

  try {
    const orders = await getRgOrders(vendorId, startDate, endDate);

    const productMap = new Map<string, ProductSales>();
    for (const order of orders) {
      for (const item of order.orderItems) {
        const name = item.productName;
        const qty = item.salesQuantity;
        const price = parseFloat(item.unitSalesPrice) || 0;

        revenue += price * qty;

        const existing = productMap.get(name);
        if (existing) {
          existing.quantity += qty;
        } else {
          productMap.set(name, {
            productName: name,
            category: detectCategory(name),
            platform: "coupang",
            quantity: qty,
          });
        }
      }
    }
    products = Array.from(productMap.values());
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    warnings.push({
      level: "error",
      message: `쿠팡 주문 API 호출 실패: ${msg}`,
    });
  }

  return { products, revenue, warnings };
}
