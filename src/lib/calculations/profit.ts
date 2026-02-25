import {
  NaverData,
  CoupangData,
  OfflineData,
  PlatformFees,
  PlatformProfit,
  OverallSummary,
  ProductRankEntry,
  ProductMatrixRow,
  ProductSales,
  Platform,
  ProductCategory,
  ProductMappingConfig,
  SponsoredItem,
} from "@/lib/types";

// ─── 환경변수에서 비율 로드 ────────────────────────────────────────────────

function getRate(key: string): number {
  const val = process.env[key];
  if (!val) throw new Error(`환경변수 ${key}가 설정되지 않았습니다.`);
  const n = parseFloat(val);
  if (isNaN(n)) throw new Error(`환경변수 ${key}는 숫자여야 합니다.`);
  return n;
}

// ─── 플랫폼별 이익 계산 ────────────────────────────────────────────────────

/**
 * 온라인 플랫폼 이익 계산 (네이버 / 쿠팡)
 * - 이익 = 매출 - 수수료 - 물류비 - 광고비
 * - 부자재비 = (매출 - 물류비) × 환경변수 비율
 * - 순이익 = 이익 - 부자재비
 */
export function calcOnlineProfit(
  revenue: number,
  fees: PlatformFees
): PlatformProfit {
  const profit =
    revenue - fees.commissionFee - fees.logisticsFee - fees.adFee;
  const materialCost = Math.round(
    (revenue - fees.logisticsFee) * getRate("ONLINE_MATERIAL_RATE")
  );
  const netProfit = profit - materialCost;
  return { profit, materialCost, netProfit };
}

/**
 * 오프라인 플랫폼 이익 계산
 * - 이익 = 매출 - 수수료 - 물류비 - 광고비
 * - 부자재비:
 *   · 고산의낮(할인 납품): (매출 + 수수료) × 비율 — 수수료=할인분이므로 정가 기준
 *   · 기타 입점처(정가 판매): 매출 × 비율
 * - 순이익 = 이익 - 부자재비
 */
export function calcOfflineProfit(
  revenue: number,
  fees: PlatformFees,
  venueId: string
): PlatformProfit {
  const profit =
    revenue - fees.commissionFee - fees.logisticsFee - fees.adFee;
  // 고산의낮: 할인 납품이라 부자재비는 정가(매출+할인분) 기준
  // 기타 입점처: 정가 판매이므로 매출 기준
  const materialBase =
    venueId === "gosan" ? revenue + fees.commissionFee : revenue;
  const materialCost = Math.round(
    materialBase * getRate("OFFLINE_MATERIAL_RATE")
  );
  const netProfit = profit - materialCost;
  return { profit, materialCost, netProfit };
}

// ─── 전체 요약 계산 ────────────────────────────────────────────────────────

export function calcOverallSummary(
  naver: NaverData,
  coupang: CoupangData,
  offlineVenues: OfflineData[],
  marketingCost: number = 0
): OverallSummary {
  const offRevenue = offlineVenues.reduce((s, v) => s + v.revenue, 0);
  const offCommission = offlineVenues.reduce((s, v) => s + v.fees.commissionFee, 0);
  const offLogistics = offlineVenues.reduce((s, v) => s + v.fees.logisticsFee, 0);
  const offAd = offlineVenues.reduce((s, v) => s + v.fees.adFee, 0);
  const offProfit = offlineVenues.reduce((s, v) => s + v.profit.profit, 0);
  const offMaterial = offlineVenues.reduce((s, v) => s + v.profit.materialCost, 0);
  const offNetProfit = offlineVenues.reduce((s, v) => s + v.profit.netProfit, 0);
  const offTotal = offlineVenues.reduce((s, v) => s + v.totalQuantity, 0);
  const offHandmade = offlineVenues.reduce((s, v) => s + v.handmadeQuantity, 0);
  const offOther = offlineVenues.reduce((s, v) => s + v.otherQuantity, 0);

  return {
    totalRevenue: naver.revenue + coupang.revenue + offRevenue,
    totalCommissionFee: naver.fees.commissionFee + coupang.fees.commissionFee + offCommission,
    totalLogisticsFee: naver.fees.logisticsFee + coupang.fees.logisticsFee + offLogistics,
    totalAdFee: naver.fees.adFee + coupang.fees.adFee + offAd,
    totalProfit: naver.profit.profit + coupang.profit.profit + offProfit,
    totalMaterialCost: naver.profit.materialCost + coupang.profit.materialCost + offMaterial,
    marketingCost,
    totalNetProfit: naver.profit.netProfit + coupang.profit.netProfit + offNetProfit - marketingCost,
    totalQuantity: naver.totalQuantity + coupang.totalQuantity + offTotal,
    handmadeQuantity: naver.handmadeQuantity + coupang.handmadeQuantity + offHandmade,
    otherQuantity: naver.otherQuantity + coupang.otherQuantity + offOther,
  };
}

// ─── 상품명 → canonical 해석 ─────────────────────────────────────────────

const PRODUCT_STOP_WORDS = new Set([
  "끈갈피", "책갈피", "비즈", "북마크", "끈", "북클립",
  "선물", "독서모임", "책선물", "독서템", "독서용품", "독서",
  "리커밋", "맞춤제작", "handmade",
]);

function extractKeywords(name: string): Set<string> {
  const cleaned = name
    .replace(/\[.*?\]/g, "")
    .replace(/[^\uAC00-\uD7A3a-zA-Z\s]/g, " ")
    .toLowerCase()
    .trim();
  return new Set(
    cleaned.split(/\s+/).filter((w) => w.length > 0 && !PRODUCT_STOP_WORDS.has(w))
  );
}

function keywordOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

/**
 * 상품명 → canonical명 해석.
 * 네이버/쿠팡: 등록된 플랫폼 상품명 정확 매칭.
 * 오프라인 (수기 입력):
 *   1) canonical 정확 매칭
 *   2) naver/coupang 필드 매칭
 *   3) 키워드 유사도 매칭 (threshold 0.5)
 */
function toCanonical(
  name: string,
  platform: Platform | undefined,
  mapping: ProductMappingConfig | null
): string {
  if (!mapping) return name;

  if (platform === "naver") {
    return mapping.mappings.find((m) => m.naver === name)?.canonical ?? name;
  }
  if (platform === "coupang") {
    return mapping.mappings.find((m) => m.coupang === name)?.canonical ?? name;
  }

  // offline (수기 입력): 단계별 매칭
  const exact = mapping.mappings.find((m) => m.canonical === name);
  if (exact) return exact.canonical;

  const cross = mapping.mappings.find((m) => m.naver === name || m.coupang === name);
  if (cross) return cross.canonical;

  const kw = extractKeywords(name);
  if (kw.size > 0) {
    let bestScore = 0;
    let bestCanonical = name;
    for (const m of mapping.mappings) {
      const score = keywordOverlap(kw, extractKeywords(m.canonical));
      if (score > bestScore) {
        bestScore = score;
        bestCanonical = m.canonical;
      }
    }
    if (bestScore >= 0.5) return bestCanonical;
  }

  return name;
}

// ─── 랭킹 계산 ────────────────────────────────────────────────────────────

/** 단일 플랫폼 상품 목록에서 TOP N 랭킹 생성 */
export function calcPlatformRanking(
  products: ProductSales[],
  topN: number,
  mapping: ProductMappingConfig | null = null
): ProductRankEntry[] {
  const platform = products[0]?.platform;

  // canonical명 기준으로 합산
  const map = new Map<string, { qty: number; rawName: string }>();
  for (const p of products) {
    const key = toCanonical(p.productName, platform, mapping);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { qty: p.quantity, rawName: p.productName });
    } else {
      existing.qty += p.quantity;
    }
  }

  return Array.from(map.entries())
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, topN)
    .map(([canonicalName, { qty, rawName }], idx) => {
      const category =
        products.find((p) => p.productName === rawName)?.category ?? "other";
      return {
        rank: idx + 1,
        productName: canonicalName,
        category,
        total: qty,
        naver: platform === "naver" ? qty : 0,
        coupang: platform === "coupang" ? qty : 0,
        offline: platform === "offline" ? qty : 0,
      };
    });
}

/**
 * 전체 통합 TOP N 랭킹 계산
 * 상품 매핑이 있으면 canonical명 기준으로 합산, 없으면 상품명 그대로 사용
 */
export function calcOverallRanking(
  naver: ProductSales[],
  coupang: ProductSales[],
  offline: ProductSales[],
  mapping: ProductMappingConfig | null,
  topN: number
): ProductRankEntry[] {
  const map = new Map<
    string,
    { category: ProductCategory; naver: number; coupang: number; offline: number }
  >();

  const add = (products: ProductSales[], platform: Platform) => {
    for (const p of products) {
      const key = toCanonical(p.productName, platform, mapping);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { category: p.category, naver: 0, coupang: 0, offline: 0 });
      }
      const entry = map.get(key)!;
      entry[platform] += p.quantity;
    }
  };

  add(naver, "naver");
  add(coupang, "coupang");
  add(offline, "offline");

  return Array.from(map.entries())
    .map(([name, v]) => ({
      rank: 0,
      productName: name,
      category: v.category,
      total: v.naver + v.coupang + v.offline,
      naver: v.naver,
      coupang: v.coupang,
      offline: v.offline,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, topN)
    .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
}

// ─── 협찬 제외 랭킹 ───────────────────────────────────────────────────────

/**
 * 협찬 제공 수량을 제외한 실판매 기준 TOP N 랭킹.
 * sponsored 수량은 canonical명 기준으로 전체 합계에서 차감 (0 미만 클램프).
 */
export function calcSponsorExcludedRanking(
  naver: ProductSales[],
  coupang: ProductSales[],
  offline: ProductSales[],
  sponsoredItems: SponsoredItem[],
  mapping: ProductMappingConfig | null,
  topN: number
): ProductRankEntry[] {
  const map = new Map<
    string,
    { category: ProductCategory; naver: number; coupang: number; offline: number }
  >();

  const add = (products: ProductSales[], platform: Platform) => {
    for (const p of products) {
      const key = toCanonical(p.productName, platform, mapping);
      if (!map.has(key)) {
        map.set(key, { category: p.category, naver: 0, coupang: 0, offline: 0 });
      }
      const entry = map.get(key)!;
      entry[platform] += p.quantity;
    }
  };

  add(naver, "naver");
  add(coupang, "coupang");
  add(offline, "offline");

  // 협찬 수량 차감 (canonical명 기준, 0 미만 클램프)
  const sponsoredMap = new Map(sponsoredItems.map((i) => [i.productName, i.quantity]));

  return Array.from(map.entries())
    .map(([name, v]) => {
      const sponsored = sponsoredMap.get(name) ?? 0;
      const rawTotal = v.naver + v.coupang + v.offline;
      const adjustedTotal = Math.max(0, rawTotal - sponsored);
      return {
        rank: 0,
        productName: name,
        category: v.category,
        total: adjustedTotal,
        naver: v.naver,
        coupang: v.coupang,
        offline: v.offline,
      };
    })
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, topN)
    .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
}

// ─── 상품 × 플랫폼 매트릭스 ───────────────────────────────────────────────

export function calcProductMatrix(
  naver: ProductSales[],
  coupang: ProductSales[],
  offline: ProductSales[],
  mapping: ProductMappingConfig | null
): ProductMatrixRow[] {
  const map = new Map<
    string,
    { category: ProductCategory; naver: number; coupang: number; offline: number }
  >();

  // 매핑에 등록된 canonical명 전체를 0으로 초기 세팅
  // → 이번 달 판매 없는 상품도 리스트·오프라인 입력란에 표시됨
  if (mapping) {
    for (const m of mapping.mappings) {
      if (!map.has(m.canonical)) {
        map.set(m.canonical, { category: "handmade", naver: 0, coupang: 0, offline: 0 });
      }
    }
  }

  const add = (products: ProductSales[], platform: Platform) => {
    for (const p of products) {
      const key = toCanonical(p.productName, platform, mapping);
      if (!map.has(key)) {
        map.set(key, { category: p.category, naver: 0, coupang: 0, offline: 0 });
      }
      const entry = map.get(key)!;
      entry[platform] += p.quantity;
      // 실제 판매 데이터로 카테고리 보정
      if (p.quantity > 0) entry.category = p.category;
    }
  };

  add(naver, "naver");
  add(coupang, "coupang");
  add(offline, "offline");

  return Array.from(map.entries())
    .map(([name, v]) => ({
      productName: name,
      category: v.category,
      naver: v.naver,
      coupang: v.coupang,
      offline: v.offline,
      total: v.naver + v.coupang + v.offline,
    }))
    .sort((a, b) => b.total - a.total);
}

