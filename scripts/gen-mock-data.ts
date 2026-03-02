/**
 * 목업 데이터 생성 스크립트
 * 2024-04 ~ 2025-12 (21개월) 가상 판매 데이터 생성
 */
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data", "reports");

// ── 시즌별 상품 정의 ─────────────────────────────────────────────
const PRODUCTS = {
  spring:  ["봄 벚꽃 끈갈피", "딸기 꽃 끈갈피", "민들레 끈갈피"],
  summer:  ["여름 수박 끈갈피", "빙수 끈갈피", "파랑 물결 끈갈피"],
  autumn:  ["가을 단풍 끈갈피", "귀여운 고양이 끈갈피", "열매 넝쿨 끈갈피"],
  winter:  ["겨울 눈꽃 끈갈피", "작은 별 끈갈피", "붉은 열매 끈갈피"],
  perennial: ["봄 벚꽃 끈갈피", "귀여운 고양이 끈갈피", "딸기 꽃 끈갈피"],
  other:   ["독서 인덱스 플래그"],
};

function getSeason(month: number): "spring" | "summer" | "autumn" | "winter" {
  if (month >= 3 && month <= 5)  return "spring";
  if (month >= 6 && month <= 8)  return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

// 시즌 주력 상품 + 상시 상품 조합
function getMonthProducts(month: number): { handmade: string[]; other: string[] } {
  const season = getSeason(month);
  const main = PRODUCTS[season];
  // 상시 상품은 주력이 아닌 것 중 1~2개
  const extra = PRODUCTS.perennial.filter(p => !main.includes(p)).slice(0, 2);
  return { handmade: [...main, ...extra], other: PRODUCTS.other };
}

// 시즌 부스트 (계절 성수기)
function seasonBoost(month: number): number {
  // 12월(크리스마스), 5월(어버이날/스승의날), 2월(발렌타인) 피크
  const boosts: Record<number, number> = { 12: 1.5, 5: 1.25, 2: 1.15, 10: 1.1, 11: 1.2 };
  return boosts[month] ?? 1.0;
}

// 성장 곡선: 초기 소규모 → 안정화
function growthFactor(year: number, month: number): number {
  const monthsFromStart = (year - 2024) * 12 + (month - 4); // 2024-04 기준
  // 로지스틱 성장 곡선 (0.3 → 1.0)
  const growth = 0.3 + 0.7 * (1 / (1 + Math.exp(-0.3 * (monthsFromStart - 8))));
  return growth;
}

// 결정론적 "랜덤" (seed 기반, 실행마다 동일 결과)
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x); // 0~1
}

function jitter(base: number, seed: number, range = 0.12): number {
  return Math.round(base * (1 + (pseudoRandom(seed) * 2 - 1) * range));
}

// 비율(rate)에 변동을 줄 때 사용 — jitter()는 내부에서 round를 해서 소수 비율에 사용 불가
function rateJitter(base: number, seed: number, range = 0.2): number {
  return base * (1 + (pseudoRandom(seed) * 2 - 1) * range);
}

// ── 월별 레포트 생성 ──────────────────────────────────────────────
function generateReport(year: number, month: number) {
  const gf = growthFactor(year, month);
  const sb = seasonBoost(month);
  const seed = year * 100 + month;

  const { handmade: hpList, other: opList } = getMonthProducts(month);

  // ── 네이버 ─────────────────────────────────────────────────────
  const naverBaseRevenue = jitter(680000 * gf * sb, seed + 1);
  const naverRevenue = Math.round(naverBaseRevenue / 1000) * 1000;

  const naverBaseQty = Math.round(naverRevenue / 17500);
  const naverOtherQty = Math.min(Math.round(naverBaseQty * 0.12), 6);
  const naverHandmadeQty = naverBaseQty - naverOtherQty;

  // 네이버 상품 분배 (주력 1위에 40%, 2위 30%, 나머지 배분)
  const naverHProd = hpList.map((name, i) => {
    const ratio = i === 0 ? 0.4 : i === 1 ? 0.3 : i === 2 ? 0.18 : 0.12;
    return { productName: name, category: "handmade" as const, platform: "naver" as const,
      quantity: Math.max(1, Math.round(naverHandmadeQty * ratio)) };
  });
  const naverOProd = opList.map(name => ({
    productName: name, category: "other" as const, platform: "naver" as const, quantity: naverOtherQty,
  }));

  const naverShippingCollected = Math.round(naverRevenue * 0.068);
  const naverPayerCount = Math.round(naverBaseQty * 0.52);
  const naverCommission = Math.round(naverRevenue * 0.05);
  const naverRegularCount = Math.round(naverPayerCount * 0.76);
  const naverFreeCount = naverPayerCount - naverRegularCount;
  const naverLogistics = naverFreeCount * 3300 + naverRegularCount * 300;
  const naverSettlement = naverRevenue + naverShippingCollected - naverCommission - naverLogistics;
  const naverMaterialCost = Math.round((naverRevenue - naverShippingCollected) * 0.148);
  const naverProfit = naverRevenue - naverCommission - naverLogistics;
  const naverNetProfit = naverProfit - naverMaterialCost;

  // ── 쿠팡 ─────────────────────────────────────────────────────
  const coupangBaseRevenue = jitter(920000 * gf * sb, seed + 2);
  const coupangRevenue = Math.round(coupangBaseRevenue / 1000) * 1000;
  const coupangQty = Math.round(coupangRevenue / 18000);

  const coupangCProd = hpList.map((name, i) => {
    // 쿠팡은 2위 상품이 더 강한 경우도 있음
    const ratios = [0.38, 0.32, 0.18, 0.08, 0.04];
    return { productName: name, category: "handmade" as const, platform: "coupang" as const,
      quantity: Math.max(1, Math.round(coupangQty * (ratios[i] ?? 0.03))) };
  });

  const coupangCommission = Math.round(coupangRevenue * 0.119);
  const coupangLogistics = Math.round(coupangRevenue * 0.192);
  const coupangAdFee = Math.round(coupangRevenue * rateJitter(0.13, seed + 3, 0.2));
  const coupangMaterialCost = Math.round(coupangRevenue * 0.15);
  const coupangProfit = coupangRevenue - coupangCommission - coupangLogistics - coupangAdFee;
  const coupangNetProfit = coupangProfit - coupangMaterialCost;

  // ── 오프라인 (격월 또는 월 단위, 소규모) ───────────────────────
  const hasOffline = gf > 0.5 && pseudoRandom(seed + 10) > 0.3;
  const offlineRevenue = hasOffline ? Math.round(jitter(105000 * gf, seed + 4) / 1000) * 1000 : 0;
  const offlineQty = hasOffline ? Math.max(3, Math.round(offlineRevenue / 17000)) : 0;
  const offlineCommission = Math.round(offlineRevenue * 0.30);
  const offlineLogistics = hasOffline ? 3300 : 0;
  const offlineMaterialCost = Math.round(offlineRevenue * 0.175);
  const offlineProfit = offlineRevenue - offlineCommission - offlineLogistics;
  const offlineNetProfit = offlineProfit - offlineMaterialCost;

  const offlineProd = hasOffline ? hpList.slice(0, 2).map((name, i) => ({
    productName: name, category: "handmade" as const, platform: "offline" as const,
    quantity: i === 0 ? Math.round(offlineQty * 0.6) : Math.round(offlineQty * 0.4),
  })) : [];

  // ── 네이버 광고비 (격월 집행, 성수기에 집중) ────────────────────
  const hasNaverAd = gf > 0.55 && [5, 6, 10, 11, 12].includes(month);
  const naverAdFee = hasNaverAd ? Math.round(naverRevenue * rateJitter(0.07, seed + 20, 0.2)) : 0;

  // ── 협찬 (성장기 이후, 계절 성수기 전달에 집중) ─────────────────
  const hasSponsorship = gf > 0.55 && [3, 7, 9, 11, 4].includes(month);
  const sponsorProductName = hpList[0];
  const sponsorQty = hasSponsorship ? 5 : 0;
  const marketingCost = sponsorQty * 5280;

  // ── 집계 ─────────────────────────────────────────────────────
  const totalRevenue = naverRevenue + coupangRevenue + offlineRevenue;
  const totalCommissionFee = naverCommission + coupangCommission + offlineCommission;
  const totalLogisticsFee = naverLogistics + coupangLogistics + offlineLogistics;
  const totalAdFee = naverAdFee + coupangAdFee;
  const totalProfit = naverProfit + coupangProfit + offlineProfit;
  const totalMaterialCost = naverMaterialCost + coupangMaterialCost + offlineMaterialCost;
  const totalNetProfit = totalProfit - totalMaterialCost - marketingCost;
  const totalQty = naverBaseQty + coupangQty + offlineQty;
  const handmadeQty = naverHandmadeQty + coupangQty + (hasOffline ? offlineQty : 0);
  const otherQty = naverOtherQty;

  // ── 랭킹 계산 ────────────────────────────────────────────────
  const productTotals: Record<string, { naver: number; coupang: number; offline: number; category: string }> = {};

  [...naverHProd, ...naverOProd].forEach(p => {
    if (!productTotals[p.productName]) productTotals[p.productName] = { naver: 0, coupang: 0, offline: 0, category: p.category };
    productTotals[p.productName].naver += p.quantity;
  });
  coupangCProd.forEach(p => {
    if (!productTotals[p.productName]) productTotals[p.productName] = { naver: 0, coupang: 0, offline: 0, category: p.category };
    productTotals[p.productName].coupang += p.quantity;
  });
  offlineProd.forEach(p => {
    if (!productTotals[p.productName]) productTotals[p.productName] = { naver: 0, coupang: 0, offline: 0, category: p.category };
    productTotals[p.productName].offline += p.quantity;
  });

  const allRanking = Object.entries(productTotals)
    .filter(([, v]) => v.category === "handmade")
    .map(([name, v]) => ({ productName: name, category: "handmade" as const, naver: v.naver, coupang: v.coupang, offline: v.offline, total: v.naver + v.coupang + v.offline }))
    .sort((a, b) => b.total - a.total)
    .map((r, i) => ({ rank: i + 1, ...r }));

  const sponsorExcluded = allRanking.map(r => ({
    ...r, total: r.productName === sponsorProductName ? r.total - sponsorQty : r.total
  })).sort((a, b) => b.total - a.total).map((r, i) => ({ ...r, rank: i + 1 }));

  const productMatrix = Object.entries(productTotals).map(([name, v]) => ({
    productName: name, category: v.category as "handmade" | "other",
    naver: v.naver, coupang: v.coupang, offline: v.offline, total: v.naver + v.coupang + v.offline
  })).sort((a, b) => b.total - a.total);

  const naverRanking = [...naverHProd].sort((a, b) => b.quantity - a.quantity)
    .slice(0, 3).map((p, i) => ({
      rank: i + 1, productName: p.productName, category: p.category,
      total: p.quantity, naver: p.quantity, coupang: 0, offline: 0
    }));

  const coupangRanking = [...coupangCProd].sort((a, b) => b.quantity - a.quantity)
    .slice(0, 3).map((p, i) => ({
      rank: i + 1, productName: p.productName, category: p.category,
      total: p.quantity, naver: 0, coupang: p.quantity, offline: 0
    }));

  const offlineRanking = [...offlineProd].sort((a, b) => b.quantity - a.quantity)
    .slice(0, 3).map((p, i) => ({
      rank: i + 1, productName: p.productName, category: p.category,
      total: p.quantity, naver: 0, coupang: 0, offline: p.quantity
    }));

  const collectedAt = new Date(year, month, 1, 9, 0, 0).toISOString();

  return {
    period: { year, month },
    dataRange: { start: `${year}-${String(month).padStart(2, "0")}-01`, end: `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}` },
    naver: {
      revenue: naverRevenue,
      shippingCollected: naverShippingCollected,
      payerCount: naverPayerCount,
      totalQuantity: naverBaseQty,
      handmadeQuantity: naverHandmadeQty,
      otherQuantity: naverOtherQty,
      fees: { commissionFee: naverCommission, logisticsFee: naverLogistics, adFee: naverAdFee, settlementAmount: naverSettlement },
      shippingStats: { regularCount: naverRegularCount, freeCount: naverFreeCount, sellerCost: naverLogistics },
      profit: { profit: naverProfit, materialCost: naverMaterialCost, netProfit: naverNetProfit },
      products: [...naverHProd, ...naverOProd],
    },
    coupang: {
      revenue: coupangRevenue,
      totalQuantity: coupangQty,
      handmadeQuantity: coupangQty,
      otherQuantity: 0,
      fees: { commissionFee: coupangCommission, logisticsFee: coupangLogistics, adFee: coupangAdFee, settlementAmount: 0 },
      profit: { profit: coupangProfit, materialCost: coupangMaterialCost, netProfit: coupangNetProfit },
      products: coupangCProd,
    },
    offline: [{
      venueId: "lighthouse",
      venueName: "등대서점",
      revenue: offlineRevenue,
      totalQuantity: offlineQty,
      handmadeQuantity: offlineQty,
      otherQuantity: 0,
      fees: { commissionFee: offlineCommission, logisticsFee: offlineLogistics, adFee: 0, settlementAmount: 0 },
      profit: { profit: offlineProfit, materialCost: offlineMaterialCost, netProfit: offlineNetProfit },
      products: offlineProd,
    }],
    sponsorship: {
      items: hasSponsorship ? [{ productName: sponsorProductName, category: "handmade", quantity: sponsorQty }] : [],
      marketingCost,
      totalQuantity: sponsorQty,
      handmadeQuantity: sponsorQty,
    },
    summary: {
      totalRevenue,
      totalCommissionFee,
      totalLogisticsFee,
      totalAdFee,
      totalProfit,
      totalMaterialCost,
      marketingCost,
      totalNetProfit,
      totalQuantity: totalQty,
      handmadeQuantity: handmadeQty,
      otherQuantity: otherQty,
    },
    naverRanking,
    coupangRanking,
    offlineRanking,
    overallRanking: allRanking.slice(0, 5),
    sponsorExcludedRanking: sponsorExcluded.slice(0, 5),
    productMatrix,
    insights: [],
    warnings: [],
    collectedAt,
    lastModifiedAt: collectedAt,
  };
}

// ── 생성 대상 월 목록 (2024-04 ~ 2025-09) ────────────────────────
const months: [number, number][] = [];
for (let m = 4; m <= 12; m++) months.push([2024, m]);
for (let m = 1; m <= 9;  m++) months.push([2025, m]);

fs.mkdirSync(DATA_DIR, { recursive: true });

let count = 0;
for (const [year, month] of months) {
  const filePath = path.join(DATA_DIR, `${year}-${String(month).padStart(2, "0")}.json`);
  // 이미 존재하는 파일(Oct~Dec 2025)은 덮어쓰지 않음
  if (fs.existsSync(filePath)) {
    console.log(`⏭  Skip ${year}-${month} (already exists)`);
    continue;
  }
  const report = generateReport(year, month);
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
  console.log(`✅ Generated ${year}-${String(month).padStart(2, "0")}  revenue: ${report.summary.totalRevenue.toLocaleString()}원`);
  count++;
}
console.log(`\n🎉 Done! Generated ${count} mock reports.`);
