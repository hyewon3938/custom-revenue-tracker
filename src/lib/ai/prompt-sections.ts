import { MonthlyReport, MonthlyOverview } from "@/lib/types";
import { formatKRW } from "@/lib/utils/format";

// ─── 헬퍼 함수 ─────────────────────────────────────────────────────────

export type Report = Omit<MonthlyReport, "insights">;

/** 이익률 (%) */
function profitMargin(revenue: number, netProfit: number): string {
  if (revenue === 0) return "0.0";
  return ((netProfit / revenue) * 100).toFixed(1);
}

/** 광고 효율 (ROAS = 매출 / 광고비) */
function calcROAS(revenue: number, adFee: number): string {
  if (adFee === 0) return "해당 없음 (광고 미집행)";
  return (revenue / adFee).toFixed(1);
}

/** 전달 대비 변화율 (%) */
function momChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "+100%" : "0%";
  const change = ((current - previous) / previous) * 100;
  return `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
}

/** 플랫폼 비용 합산 (OverallSummary에 없는 항목) */
function sumFees(report: Report) {
  const { naver, coupang, offline } = report;
  return {
    totalAdFee:
      naver.fees.adFee +
      coupang.fees.adFee +
      offline.reduce((s, v) => s + v.fees.adFee, 0),
    totalCommissionFee:
      naver.fees.commissionFee +
      coupang.fees.commissionFee +
      offline.reduce((s, v) => s + v.fees.commissionFee, 0),
    totalLogisticsFee:
      naver.fees.logisticsFee +
      coupang.fees.logisticsFee +
      offline.reduce((s, v) => s + v.fees.logisticsFee, 0),
  };
}

// ─── 프롬프트 섹션 빌더 ────────────────────────────────────────────────

function buildPeriodSection(report: Report): string {
  const { period, dataRange } = report;
  return `## 분석 기간
${period.year}년 ${period.month}월 (${dataRange.start} ~ ${dataRange.end})`;
}

function buildPlatformSection(report: Report): string {
  const { naver, coupang, offline } = report;

  const naverSection = `### 네이버
- 매출: ${formatKRW(naver.revenue)}
- 수수료: ${formatKRW(naver.fees.commissionFee)}
- 판매자부담 배송비: ${formatKRW(naver.fees.logisticsFee)} (유료배송 ${naver.shippingStats.regularCount}건 / 무료배송 ${naver.shippingStats.freeCount}건)
- 정산금: ${formatKRW(naver.fees.settlementAmount)}
- 이익: ${formatKRW(naver.profit.profit)} / 순이익: ${formatKRW(naver.profit.netProfit)}
- 이익률: ${profitMargin(naver.revenue, naver.profit.netProfit)}%
- 판매량: 전체 ${naver.totalQuantity}개 · 끈갈피 ${naver.handmadeQuantity}개`;

  const coupangSection = `### 쿠팡
- 매출: ${formatKRW(coupang.revenue)}
- 수수료: ${formatKRW(coupang.fees.commissionFee)}
- 풀필먼트 물류비: ${formatKRW(coupang.fees.logisticsFee)}
- 입고 배송비: ${formatKRW(coupang.fees.inboundShippingFee)}
- 광고비: ${formatKRW(coupang.fees.adFee)}
- 이익: ${formatKRW(coupang.profit.profit)} / 순이익: ${formatKRW(coupang.profit.netProfit)}
- 이익률: ${profitMargin(coupang.revenue, coupang.profit.netProfit)}%
- ROAS: ${calcROAS(coupang.revenue, coupang.fees.adFee)}
- 판매량: 전체 ${coupang.totalQuantity}개 · 끈갈피 ${coupang.handmadeQuantity}개`;

  const offlineSections = offline
    .map(
      (v) => `### 오프라인 (${v.venueName})
- 매출: ${formatKRW(v.revenue)}
- 수수료: ${formatKRW(v.fees.commissionFee)}
- 물류비: ${formatKRW(v.fees.logisticsFee)}
- 광고비: ${formatKRW(v.fees.adFee)}
- 이익: ${formatKRW(v.profit.profit)} / 순이익: ${formatKRW(v.profit.netProfit)}
- 이익률: ${profitMargin(v.revenue, v.profit.netProfit)}%
- 판매량: 전체 ${v.totalQuantity}개 · 끈갈피 ${v.handmadeQuantity}개`,
    )
    .join("\n\n");

  return `## 1. 플랫폼별 매출 및 비용

${naverSection}

${coupangSection}

${offlineSections}`;
}

function buildSummarySection(report: Report): string {
  const { summary } = report;
  return `## 2. 전체 요약
- 총 매출: ${formatKRW(summary.totalRevenue)}
- 총 이익: ${formatKRW(summary.totalProfit)}
- 총 부자재비: ${formatKRW(summary.totalMaterialCost)}
- 마케팅 비용: ${formatKRW(summary.marketingCost)}
- 총 순이익: ${formatKRW(summary.totalNetProfit)}
- 이익률: ${profitMargin(summary.totalRevenue, summary.totalNetProfit)}%`;
}

function buildProductSection(report: Report): string {
  const { summary, overallRanking, sponsorExcludedRanking, productMatrix } =
    report;

  const handmadeRatio =
    summary.totalQuantity > 0
      ? ((summary.handmadeQuantity / summary.totalQuantity) * 100).toFixed(1)
      : "0";

  const topRanking =
    overallRanking.length > 0
      ? overallRanking
          .map(
            (r) =>
              `${r.rank}위. ${r.productName}: 총 ${r.total}개 (N:${r.naver} / C:${r.coupang} / O:${r.offline})`,
          )
          .join("\n")
      : "데이터 없음";

  const excludedRanking =
    sponsorExcludedRanking.length > 0
      ? sponsorExcludedRanking
          .map((r) => `${r.rank}위. ${r.productName}: ${r.total}개`)
          .join("\n")
      : "데이터 없음";

  // 판매 있는 상품만 (프롬프트 길이 제한)
  const activeProducts = productMatrix.filter((p) => p.total > 0);
  const matrixStr =
    activeProducts.length > 0
      ? activeProducts
          .map(
            (p) =>
              `- ${p.productName}: 총 ${p.total}개 (N:${p.naver} / C:${p.coupang} / O:${p.offline})`,
          )
          .join("\n")
      : "데이터 없음";

  return `## 3. 판매량 및 상품 분석

### 판매량
- 전체: ${summary.totalQuantity}개 (끈갈피 ${summary.handmadeQuantity}개 / 기타 ${summary.otherQuantity}개)
- 끈갈피 비율: ${handmadeRatio}%

### 상품별 판매 TOP 5
${topRanking}

### 협찬 제외 실판매 TOP 5
${excludedRanking}

### 상품 x 플랫폼 판매수량
${matrixStr}`;
}

function buildSponsorshipSection(report: Report): string {
  const { sponsorship, overallRanking, sponsorExcludedRanking } = report;

  if (!sponsorship || sponsorship.items.length === 0) return "";

  const itemsStr = sponsorship.items
    .map((i) => {
      const priceStr = i.unitPrice ? ` @${i.unitPrice.toLocaleString()}원` : "";
      return `${i.productName} ${i.quantity}개${priceStr}`;
    })
    .join(", ");

  return `## 4. 협찬 마케팅
- 협찬 제공: ${itemsStr}
- 총 협찬 수량: ${sponsorship.totalQuantity}개 (끈갈피 ${sponsorship.handmadeQuantity}개)
- 마케팅 비용: ${formatKRW(sponsorship.marketingCost)}
- 협찬 포함 1위: ${overallRanking[0]?.productName ?? "없음"} (${overallRanking[0]?.total ?? 0}개)
- 협찬 제외 1위: ${sponsorExcludedRanking[0]?.productName ?? "없음"} (${sponsorExcludedRanking[0]?.total ?? 0}개)`;
}

/** 히스토리에서 존재하는 레포트만 시간 역순으로 정렬 (과거→현재) */
function validHistory(report: Report, history: (Report | null)[]): Report[] {
  const past = history.filter((r): r is Report => r !== null).reverse();
  return [...past, report];
}

function buildTrendSection(report: Report, history: (Report | null)[]): string {
  const timeline = validHistory(report, history);
  if (timeline.length < 2) return "";

  // 3개월 추이 테이블
  const header = timeline.map((r) => `${r.period.month}월`).join(" | ");
  const separator = timeline.map(() => "---").join(" | ");

  const row = (label: string, fn: (r: Report) => string) =>
    `| ${label} | ${timeline.map(fn).join(" | ")} |`;

  const trendTable = `### 추이 (${timeline.length}개월)
| 지표 | ${header} |
| --- | ${separator} |
${row("총 매출", (r) => formatKRW(r.summary.totalRevenue))}
${row("순이익", (r) => formatKRW(r.summary.totalNetProfit))}
${row("판매량", (r) => `${r.summary.totalQuantity}개`)}
${row("끈갈피", (r) => `${r.summary.handmadeQuantity}개`)}
${row("광고비", (r) => formatKRW(sumFees(r).totalAdFee))}
${row("협찬 수량", (r) => `${r.sponsorship?.totalQuantity ?? 0}개`)}`;

  // 전달 대비 상세 비교 (직전 달이 있을 때만)
  const prev = history[0];
  if (!prev) return `## 5. 월별 추이 및 전달 비교\n\n${trendTable}`;

  const c = report.summary;
  const p = prev.summary;

  // TOP5 상품 변동
  const prevTopNames = new Set(prev.overallRanking.map((r) => r.productName));
  const currTopNames = new Set(report.overallRanking.map((r) => r.productName));
  const newInTop = report.overallRanking.filter(
    (r) => !prevTopNames.has(r.productName),
  );
  const droppedFromTop = prev.overallRanking.filter(
    (r) => !currTopNames.has(r.productName),
  );

  // 협찬 지연 효과: 이전 달 협찬 상품이 당월에 얼마나 팔렸는지
  let sponsorDelayStr = "";
  if (prev.sponsorship?.items?.length > 0) {
    const prevSponsoredNames = prev.sponsorship.items.map((i) => i.productName);
    const currentMatrix = report.productMatrix ?? [];
    const delayRows = prevSponsoredNames
      .map((name) => {
        const currRow = currentMatrix.find((p) => p.productName === name);
        const prevRow = (prev.productMatrix ?? []).find(
          (p) => p.productName === name,
        );
        return `- ${name}: 전달 ${prevRow?.total ?? 0}개 → 당월 ${currRow?.total ?? 0}개`;
      })
      .join("\n");
    sponsorDelayStr = `\n### 협찬 지연 효과 (전달 협찬 → 당월 판매)\n${delayRows}`;
  }

  const detailComparison = `### 전달 대비 (${prev.period.month}월 → ${report.period.month}월)
- 총 매출: ${momChange(c.totalRevenue, p.totalRevenue)}
- 순이익: ${momChange(c.totalNetProfit, p.totalNetProfit)}
- 네이버: ${momChange(report.naver.revenue, prev.naver.revenue)}
- 쿠팡: ${momChange(report.coupang.revenue, prev.coupang.revenue)}
- 판매량: ${p.totalQuantity}개 → ${c.totalQuantity}개 (${momChange(c.totalQuantity, p.totalQuantity)})

### 상품 변동
${newInTop.length > 0 ? `- TOP5 신규 진입: ${newInTop.map((r) => `${r.productName}(${r.total}개)`).join(", ")}` : "- TOP5 신규 진입 없음"}
${droppedFromTop.length > 0 ? `- TOP5 이탈: ${droppedFromTop.map((r) => `${r.productName}(전달 ${r.total}개)`).join(", ")}` : "- TOP5 이탈 없음"}${sponsorDelayStr}`;

  return `## 5. 월별 추이 및 전달 비교\n\n${trendTable}\n\n${detailComparison}`;
}

// ─── 전체 기간 개요 섹션 ──────────────────────────────────────────────

function buildOverviewSection(
  report: Report,
  overview: MonthlyOverview[],
): string {
  // 당월 포함 최소 3개월 이상일 때만 의미 있음
  if (overview.length < 3) return "";

  const header = overview.map((m) => m.label).join(" | ");
  const separator = overview.map(() => "---").join(" | ");

  const row = (label: string, fn: (m: MonthlyOverview) => string) =>
    `| ${label} | ${overview.map(fn).join(" | ")} |`;

  const table = `| 지표 | ${header} |
| --- | ${separator} |
${row("매출", (m) => formatKRW(m.totalRevenue))}
${row("순이익", (m) => formatKRW(m.totalNetProfit))}
${row("마진율", (m) => `${m.marginRate}%`)}
${row("판매량", (m) => `${m.totalQuantity}개`)}
${row("끈갈피", (m) => `${m.handmadeQuantity}개`)}
${row("네이버 매출", (m) => formatKRW(m.naverRevenue))}
${row("쿠팡 매출", (m) => formatKRW(m.coupangRevenue))}
${row("오프라인 매출", (m) => formatKRW(m.offlineRevenue))}
${row("네이버 광고비", (m) => formatKRW(m.naverAdFee))}
${row("쿠팡 광고비", (m) => formatKRW(m.coupangAdFee))}
${row("협찬 비용", (m) => formatKRW(m.sponsorshipCost))}
${row("마케팅 합계", (m) => formatKRW(m.naverAdFee + m.coupangAdFee + m.sponsorshipCost))}
${row("광고비/매출 비율", (m) => {
  const adTotal = m.naverAdFee + m.coupangAdFee;
  return m.totalRevenue > 0
    ? `${((adTotal / m.totalRevenue) * 100).toFixed(1)}%`
    : "0%";
})}`;

  // 전체 누적 요약
  const totals = overview.reduce(
    (acc, m) => ({
      revenue: acc.revenue + m.totalRevenue,
      netProfit: acc.netProfit + m.totalNetProfit,
      quantity: acc.quantity + m.totalQuantity,
    }),
    { revenue: 0, netProfit: 0, quantity: 0 },
  );
  const avgMargin =
    totals.revenue > 0
      ? Math.round((totals.netProfit / totals.revenue) * 1000) / 10
      : 0;

  return `## 6. 전체 기간 개요 (${overview.length}개월)

${table}

### 누적 요약
- 누적 매출: ${formatKRW(totals.revenue)}
- 누적 순이익: ${formatKRW(totals.netProfit)}
- 평균 마진율: ${avgMargin}%
- 누적 판매량: ${totals.quantity}개

이 데이터를 바탕으로 장기적 매출 추세, 마진율 변화 패턴, 채널별 성장/하락 추이 등 전체 기간에서 주목할 점이 있다면 분석해주세요.`;
}

// ─── 프롬프트 통합 ─────────────────────────────────────────────────────

export function buildPrompt(
  report: Report,
  history?: (Report | null)[],
  overview?: MonthlyOverview[],
): string {
  const sections = [
    buildPeriodSection(report),
    buildPlatformSection(report),
    buildSummarySection(report),
    buildProductSection(report),
    buildSponsorshipSection(report),
    history ? buildTrendSection(report, history) : "",
    overview ? buildOverviewSection(report, overview) : "",
  ];

  return sections.filter(Boolean).join("\n\n");
}
