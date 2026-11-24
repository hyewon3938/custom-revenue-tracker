import { ProductSales, ScrapeWarning } from "@/lib/types";
import {
  aggregateProductSales,
  type ProductQuantityEntry,
} from "@/lib/calculations/quantity";
import { getErrorMessage } from "@/lib/utils/error";
import { getRgOrders } from "./orders";

/**
 * 쿠팡 RG Order API로 주문 데이터 수집.
 * 판매분석 화면을 긁지 않고 주문 API만으로 상품·매출을 구한다.
 *
 * 반환: 제품별 판매수량 + 매출 합계
 * (정산 데이터는 scrapers/coupang-settlement.ts 스크레이퍼로 수집)
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

    const entries: ProductQuantityEntry[] = [];
    for (const order of orders) {
      for (const item of order.orderItems) {
        const qty = item.salesQuantity;
        const price = parseFloat(item.unitSalesPrice) || 0;

        revenue += price * qty;
        entries.push({ productName: item.productName, quantity: qty });
      }
    }
    products = aggregateProductSales(entries, "coupang");
  } catch (error) {
    const msg = getErrorMessage(error, String(error));
    warnings.push({
      level: "error",
      message: `쿠팡 주문 API 호출 실패: ${msg}`,
    });
  }

  return { products, revenue, warnings };
}
