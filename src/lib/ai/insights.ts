import { MonthlyReport, SalesInsight } from "@/lib/types";
import { formatKRW } from "@/lib/utils/format";
import { GROQ_API_KEY, AI_MODEL } from "@/lib/config";

// ─── Groq API (OpenAI 호환 REST) ───────────────────────────────────────

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GroqResponse {
  choices: { message: { content: string } }[];
  error?: { message: string };
}

async function callGroq(messages: GroqMessage[]): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY 환경변수가 설정되지 않았습니다. .env.local에 추가하세요."
    );
  }

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = (body as GroqResponse).error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Groq API 오류: ${msg}`);
  }

  const data = (await res.json()) as GroqResponse;
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("Groq API에서 텍스트 응답을 받지 못했습니다.");
  }
  return text;
}

// ─── 헬퍼 함수 ─────────────────────────────────────────────────────────

type Report = Omit<MonthlyReport, "insights">;

/** 이익률 (%) */
function profitMargin(revenue: number, netProfit: number): string {
  if (revenue === 0) return "0.0";
  return ((netProfit / revenue) * 100).toFixed(1);
}

/** 광고 효율 (ROAS = 매출 / 광고비) */
function calcROAS(revenue: number, adFee: number): string {
  if (adFee === 0) return "N/A (광고비 없음)";
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
- 판매량: 전체 ${v.totalQuantity}개 · 끈갈피 ${v.handmadeQuantity}개`
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
              `${r.rank}위. ${r.productName}: 총 ${r.total}개 (N:${r.naver} / C:${r.coupang} / O:${r.offline})`
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
              `- ${p.productName}: 총 ${p.total}개 (N:${p.naver} / C:${p.coupang} / O:${p.offline})`
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
    .map((i) => `${i.productName} ${i.quantity}개`)
    .join(", ");

  return `## 4. 협찬 마케팅
- 협찬 제공: ${itemsStr}
- 총 협찬 수량: ${sponsorship.totalQuantity}개 (끈갈피 ${sponsorship.handmadeQuantity}개)
- 마케팅 비용: ${formatKRW(sponsorship.marketingCost)}
- 협찬 포함 1위: ${overallRanking[0]?.productName ?? "없음"} (${overallRanking[0]?.total ?? 0}개)
- 협찬 제외 1위: ${sponsorExcludedRanking[0]?.productName ?? "없음"} (${sponsorExcludedRanking[0]?.total ?? 0}개)`;
}

/** 히스토리에서 존재하는 레포트만 시간 역순으로 정렬 (과거→현재) */
function validHistory(
  report: Report,
  history: (Report | null)[]
): Report[] {
  const past = history.filter((r): r is Report => r !== null).reverse();
  return [...past, report];
}

function buildTrendSection(
  report: Report,
  history: (Report | null)[]
): string {
  const timeline = validHistory(report, history);
  if (timeline.length < 2) return "";

  // 3개월 추이 테이블
  const header = timeline
    .map((r) => `${r.period.month}월`)
    .join(" | ");
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
    (r) => !prevTopNames.has(r.productName)
  );
  const droppedFromTop = prev.overallRanking.filter(
    (r) => !currTopNames.has(r.productName)
  );

  // 협찬 지연 효과: 이전 달 협찬 상품이 당월에 얼마나 팔렸는지
  let sponsorDelayStr = "";
  if (prev.sponsorship?.items?.length > 0) {
    const prevSponsoredNames = prev.sponsorship.items.map((i) => i.productName);
    const currentMatrix = report.productMatrix ?? [];
    const delayRows = prevSponsoredNames
      .map((name) => {
        const currRow = currentMatrix.find((p) => p.productName === name);
        const prevRow = (prev.productMatrix ?? []).find((p) => p.productName === name);
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

// ─── 프롬프트 통합 ─────────────────────────────────────────────────────

function buildPrompt(
  report: Report,
  history?: (Report | null)[]
): string {
  const sections = [
    buildPeriodSection(report),
    buildPlatformSection(report),
    buildSummarySection(report),
    buildProductSection(report),
    buildSponsorshipSection(report),
    history ? buildTrendSection(report, history) : "",
  ];

  return sections.filter(Boolean).join("\n\n");
}

// ─── 시스템 프롬프트 ───────────────────────────────────────────────────

const SYSTEM_PROMPT = `당신은 핸드메이드 끈갈피(비즈 책갈피) 판매 사업의 전담 데이터 분석가입니다.

## 사업 배경
- 주력 상품: 비즈 소재 핸드메이드 끈갈피 (책갈피/북마크)
- 판매 채널: 네이버 스마트스토어, 쿠팡 로켓그로스, 오프라인 입점(서점 등)
- 모든 끈갈피 제품은 수작업 제작 → 생산량에 한계 있음
- 부자재비는 매출의 약 15%

## 분석 원칙
1. 구체적 수치로 뒷받침: "매출이 늘었다"가 아니라 "매출이 X원에서 Y원으로 Z% 증가했다"
2. 행동 가능한 조언: "개선이 필요하다"가 아니라 "A 상품을 B 플랫폼에 집중 노출하는 것을 권장한다"
3. 우선순위 명시: 가장 효과가 클 것으로 보이는 액션을 먼저 제안
4. 솔직한 평가: 좋은 점만이 아니라 문제점도 명확히 지적

## 필수 분석 카테고리 (각 카테고리에서 최소 1개 인사이트)
1. **revenue**: 전체 및 플랫폼별 매출 동향
2. **profit**: 이익률 분석 (플랫폼별 이익률 차이, 비용 구조 문제점)
3. **product**: 어떤 상품을 전략적으로 밀어야 할지 (TOP 상품, 성장 잠재력 있는 상품)
4. **platform**: 플랫폼별 성과 비교 및 채널 전략
5. **ad**: 광고 효율 분석 (ROAS가 낮으면 광고 중단/축소 권고)
6. **sponsorship**: 협찬 마케팅 효과 분석 (데이터가 있는 경우에만)
7. **trend**: 전달 대비 변화 트렌드 (이전 달 데이터가 있는 경우에만)

## 광고 효율 판단 기준
- ROAS 3.0 미만: 광고 효율이 낮으므로 축소 또는 중단 권고
- ROAS 3.0~5.0: 보통 수준, 키워드 최적화 권고
- ROAS 5.0 이상: 양호, 예산 확대 검토 가능

## 협찬 마케팅 지연 효과
- 협찬 리뷰의 판매 전환 효과는 1~2개월 뒤에 나타남
- 데이터에 "협찬 지연 효과" 섹션이 있으면: 이전 달 협찬 상품의 당월 판매 변화를 반드시 분석
- 판매량이 증가했으면 협찬 효과가 있었다고 판단, 변화 없거나 감소했으면 추가 마케팅 필요 여부 판단
- 2개월 이상의 추이 데이터가 있으면: 협찬 시작 전후의 장기적 판매 추이 변화도 분석

## 출력 형식
반드시 아래 JSON 배열 형식으로만 출력하세요. 추가 설명 없이 JSON만 반환하세요.
인사이트는 7~10개를 생성하세요.

description 안에서 핵심 수치, 상품명, 행동 권장 사항은 **볼드 마커**로 강조하세요.
예시: "매출이 **153,000원에서 220,000원으로 43.8% 증가**했으며, **쿠팡 채널 집중 노출**을 권장합니다."

[
  {
    "title": "인사이트 제목 (15자 이내, 핵심 키워드 포함)",
    "description": "구체적인 설명과 행동 권장 사항 (150자 이내, 수치 포함, **핵심 강조**)",
    "type": "positive | negative | neutral | action",
    "category": "revenue | profit | product | platform | ad | sponsorship | trend"
  }
]

type 분류:
- positive: 좋은 성과나 개선된 지표
- negative: 주의가 필요한 지표나 하락 추세
- neutral: 중립적 관찰이나 참고 정보
- action: 즉시 실행 가능한 구체적 액션 아이템`;

// ─── 메인 함수 ─────────────────────────────────────────────────────────

/**
 * Groq API (Llama 3.3)를 사용해 월간 판매 인사이트 생성.
 * history: [전달, 전전달, 전전전달] 순. 없으면 당월 데이터만으로 분석.
 */
export async function generateSalesInsights(
  report: Report,
  history?: (Report | null)[]
): Promise<SalesInsight[]> {
  const prompt = buildPrompt(report, history);

  const text = await callGroq([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `다음 판매 데이터를 분석하여 핵심 인사이트 7~10개를 JSON 배열로 제공해주세요.\n\n${prompt}`,
    },
  ]);

  const jsonMatch = text.trim().match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("인사이트 JSON 파싱 실패");
  }

  return JSON.parse(jsonMatch[0]) as SalesInsight[];
}
