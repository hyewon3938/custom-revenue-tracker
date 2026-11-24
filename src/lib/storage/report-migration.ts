import { MonthlyReport } from "@/lib/types";

/** 기존 레포트 마이그레이션 (입력 객체를 직접 변경해 그대로 반환) */
export function migrateReport(raw: Record<string, unknown>): MonthlyReport {
  // offline이 배열이 아닌 경우 (구버전) → 배열로 래핑
  if (raw.offline && !Array.isArray(raw.offline)) {
    const single = raw.offline as Record<string, unknown>;
    if (!single.venueId) single.venueId = "gosan";
    raw.offline = [single];
  }
  // NaverData에 shippingCollected/payerCount 없는 경우 기본값 추가
  const naver = raw.naver as Record<string, unknown> | undefined;
  if (naver) {
    if (naver.shippingCollected === undefined) naver.shippingCollected = 0;
    if (naver.payerCount === undefined) naver.payerCount = 0;
  }
  // PlatformFees에 inboundShippingFee 없는 기존 레포트 호환
  ensureInboundShippingFee(raw.naver);
  ensureInboundShippingFee(raw.coupang);
  if (Array.isArray(raw.offline)) {
    for (const venue of raw.offline) ensureInboundShippingFee(venue);
  }
  // warnings 필드 없는 기존 레포트 호환
  if (!raw.warnings) raw.warnings = [];
  return raw as unknown as MonthlyReport;
}

export function ensureInboundShippingFee(node: unknown): void {
  if (!node || typeof node !== "object") return;
  const fees = (node as { fees?: Record<string, unknown> }).fees;
  if (fees && fees.inboundShippingFee === undefined) {
    fees.inboundShippingFee = 0;
  }
}
