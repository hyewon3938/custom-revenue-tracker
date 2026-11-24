import {
  NaverData,
  CoupangData,
  OfflineData,
  SponsorshipData,
  DeepPartial,
} from "@/lib/types";
import {
  calcPlatformProfit,
  calcNaverShippingStats,
  naverMaterialBase,
  coupangMaterialBase,
  calcOfflineVenueProfit,
} from "@/lib/calculations/profit";
import { reclassifyAndSummarize } from "@/lib/calculations/product";
import { calcTotalSponsorshipCost } from "@/lib/calculations/sponsorship";
import { deepMerge } from "@/lib/utils/deep-merge";
import { DEFAULT_SPONSORSHIP } from "@/lib/constants";

// ─── 레포트 수기 편집(updateReport)용 순수 계산 ─────────────────────────────

/** 오프라인 입점처 배열에 적용할 변경 요청 */
export interface OfflineVenueUpdates {
  offline?: DeepPartial<OfflineData>;
  offlineVenueId?: string;
  addOfflineVenue?: { id: string; name: string };
  removeOfflineVenueId?: string;
}

/** 오프라인 입점처 배열에 추가/삭제/수정 반영 */
export function applyOfflineUpdates(
  existing: OfflineData[],
  updates: OfflineVenueUpdates,
): OfflineData[] {
  let venues = [...existing];

  if (updates.addOfflineVenue) {
    const { id, name } = updates.addOfflineVenue;
    if (!venues.some((v) => v.venueId === id)) {
      venues.push({
        venueId: id,
        venueName: name,
        revenue: 0,
        totalQuantity: 0,
        handmadeQuantity: 0,
        otherQuantity: 0,
        fees: {
          commissionFee: 0,
          logisticsFee: 0,
          inboundShippingFee: 0,
          adFee: 0,
          settlementAmount: 0,
        },
        profit: { profit: 0, materialCost: 0, netProfit: 0 },
        products: [],
      });
    }
  }

  if (updates.removeOfflineVenueId) {
    venues = venues.filter((v) => v.venueId !== updates.removeOfflineVenueId);
  }

  if (updates.offline && updates.offlineVenueId) {
    venues = venues.map((venue) => {
      if (venue.venueId !== updates.offlineVenueId) return venue;
      const merged = deepMerge(venue, updates.offline!);
      if (updates.offline!.products !== undefined) {
        const { products, ...qtySummary } = reclassifyAndSummarize(
          merged.products,
        );
        return { ...merged, products, ...qtySummary };
      }
      return merged;
    });
  }

  return venues;
}

/** 플랫폼별 카테고리 재분류 + 이익 재계산 */
export function recalcPlatformProfits(
  naver: NaverData,
  coupang: CoupangData,
  offlineVenues: OfflineData[],
): { naver: NaverData; coupang: CoupangData; offline: OfflineData[] } {
  const naverReclassified = reclassifyAndSummarize(naver.products);
  const coupangReclassified = reclassifyAndSummarize(coupang.products);

  const offlineWithProfit: OfflineData[] = offlineVenues.map((v) => {
    const { products, ...qtySummary } = reclassifyAndSummarize(v.products);
    return calcOfflineVenueProfit({ ...v, products, ...qtySummary });
  });

  const naverShippingStats = calcNaverShippingStats(
    naver.shippingCollected ?? 0,
    naver.payerCount ?? 0,
  );
  const naverFees = {
    ...naver.fees,
    logisticsFee: naverShippingStats.sellerCost,
    adFee: 0,
  };
  const naverWithProfit: NaverData = {
    ...naver,
    fees: naverFees,
    shippingStats: naverShippingStats,
    products: naverReclassified.products,
    totalQuantity: naverReclassified.totalQuantity,
    handmadeQuantity: naverReclassified.handmadeQuantity,
    otherQuantity: naverReclassified.otherQuantity,
    profit: calcPlatformProfit(
      naver.revenue,
      naverFees,
      naverMaterialBase(naver.revenue, naver.shippingCollected ?? 0),
    ),
  };

  const coupangTotalQty = coupangReclassified.totalQuantity;
  const coupangWithProfit: CoupangData = {
    ...coupang,
    products: coupangReclassified.products,
    totalQuantity: coupangTotalQty,
    handmadeQuantity: coupangReclassified.handmadeQuantity,
    otherQuantity: coupangReclassified.otherQuantity,
    profit: calcPlatformProfit(
      coupang.revenue,
      coupang.fees,
      coupangMaterialBase(coupang.revenue, coupangTotalQty),
    ),
  };

  return {
    naver: naverWithProfit,
    coupang: coupangWithProfit,
    offline: offlineWithProfit,
  };
}

/** 협찬 데이터 병합 + 수량/비용 자동 재계산 */
export function mergeSponsorshipData(
  existing: SponsorshipData | undefined,
  patch: DeepPartial<SponsorshipData> | undefined,
): SponsorshipData {
  const base = existing ?? DEFAULT_SPONSORSHIP;
  const merged = patch ? deepMerge(base, patch) : base;

  // items 변경 없으면 그대로 반환 (marketingCost 수기 수정 포함)
  if (patch?.items === undefined) return merged;

  const totalQuantity = merged.items.reduce((s, i) => s + i.quantity, 0);
  const handmadeQuantity = merged.items
    .filter((i) => i.category === "handmade")
    .reduce((s, i) => s + i.quantity, 0);

  // 자동 계산 시도 — unitPrice가 모두 입력된 경우만 자동, 아니면 기존값 유지
  const autoCost = calcTotalSponsorshipCost(merged.items);
  const marketingCost = autoCost ?? merged.marketingCost;

  return { ...merged, totalQuantity, handmadeQuantity, marketingCost };
}
