/** 상품 주문 (API 응답을 플랫 구조로 변환한 것) */
export interface NaverProductOrder {
  productOrderId: string;
  orderId: string;
  orderDate: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPaymentAmount: number;
  productOrderStatus: string;
  paymentDate: string;
  deliveryFeeAmount: number;
  productDiscountAmount: number;
  expectedSettlementAmount: number;
  claimType?: string;
  claimStatus?: string;
  productOption?: string;
}

/** 주문 API 원본 응답 (중첩 구조) */
export interface OrderApiItem {
  productOrderId: string;
  content: {
    order: {
      orderId: string;
      orderDate: string;
      paymentDate: string;
      paymentMeans: string;
      payLocationType: string;
      orderDiscountAmount: number;
    };
    productOrder: {
      productOrderId: string;
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      totalPaymentAmount: number;
      productOrderStatus: string;
      deliveryFeeAmount: number;
      productDiscountAmount: number;
      expectedSettlementAmount: number;
      claimType?: string;
      claimStatus?: string;
      productOption?: string;
    };
    delivery?: {
      deliveredDate?: string;
    };
  };
}

/** 주문 목록 조회 응답 */
export interface OrderListResponse {
  data: {
    contents: OrderApiItem[];
    totalElements: number;
    totalPages: number;
  };
}

/** 일별 정산 내역 */
export interface NaverSettlement {
  settleBasisStartDate: string;
  settleBasisEndDate: string;
  settleExpectDate: string;
  settleCompleteDate: string;
  settleAmount: number;
  paySettleAmount: number;
  commissionSettleAmount: number;
  normalSettleAmount: number;
  quickSettleAmount: number;
  preferentialCommissionAmount: number;
  settleMethodType: string;
}

/** 정산 목록 조회 응답 */
export interface SettlementResponse {
  elements: NaverSettlement[];
  pagination: {
    current: number;
    totalPages: number;
    totalElements: number;
  };
}
