/** RG 주문 아이템 */
export interface RgOrderItem {
  vendorItemId: number;
  productName: string;
  salesQuantity: number;
  unitSalesPrice: string; // "15900.0" 형태
  currency: string;
}

/** RG 주문 */
export interface RgOrder {
  vendorId: string;
  orderId: number;
  paidAt: number; // timestamp (ms)
  orderItems: RgOrderItem[];
}

/** RG 주문 목록 응답 */
export interface RgOrderListResponse {
  message: string;
  data: RgOrder[];
  nextToken?: string;
}
