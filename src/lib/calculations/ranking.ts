import {
  NaverData,
  CoupangData,
  OfflineData,
  ProductRankEntry,
  ProductMatrixRow,
  ProductSales,
  Platform,
  ProductCategory,
  ProductMappingConfig,
  SponsoredItem,
  SponsorshipData,
} from "@/lib/types";
import { toCanonical } from "./product";
import { calcOverallSummary } from "./profit";

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

// ─── 파생 필드 일괄 재계산 ──────────────────────────────────────────────────

/**
 * summary·ranking·matrix를 일괄 재계산.
 * updateReport()와 scrape/route.ts에서 공통 사용.
 */
export function rebuildDerivedFields(
  naver: NaverData,
  coupang: CoupangData,
  offline: OfflineData[],
  sponsorship: SponsorshipData,
  mapping: ProductMappingConfig | null
) {
  const allOfflineProducts = offline.flatMap((v) => v.products);

  const summary = calcOverallSummary(naver, coupang, offline, sponsorship.marketingCost);
  const naverRanking = calcPlatformRanking(naver.products, 3, mapping);
  const coupangRanking = calcPlatformRanking(coupang.products, 3, mapping);
  const offlineRanking = calcPlatformRanking(allOfflineProducts, 3, mapping);
  const overallRanking = calcOverallRanking(
    naver.products, coupang.products, allOfflineProducts, mapping, 5
  );
  const sponsorExcludedRanking = calcSponsorExcludedRanking(
    naver.products, coupang.products, allOfflineProducts,
    sponsorship.items, mapping, 5
  );
  const productMatrix = calcProductMatrix(
    naver.products, coupang.products, allOfflineProducts, mapping
  );

  return {
    summary,
    naverRanking,
    coupangRanking,
    offlineRanking,
    overallRanking,
    sponsorExcludedRanking,
    productMatrix,
  };
}
