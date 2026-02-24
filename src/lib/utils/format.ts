/** 원화 표시 (예: ₩1,234,567) */
export const formatKRW = (n: number): string =>
  n.toLocaleString("ko-KR", { style: "currency", currency: "KRW" });
