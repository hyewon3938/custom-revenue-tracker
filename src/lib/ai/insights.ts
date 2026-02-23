import Anthropic from "@anthropic-ai/sdk";
import { MonthlyReport, SalesInsight } from "@/lib/types";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const formatKRW = (n: number) =>
  n.toLocaleString("ko-KR", { style: "currency", currency: "KRW" });

function buildPrompt(report: Omit<MonthlyReport, "insights">): string {
  const { period, naver, coupang, offline, profit, handmadeRanking } = report;

  const feeDetail = (label: string, fees: typeof naver.fees) =>
    `  - 정산금: ${formatKRW(fees.settlementAmount)}\n` +
    `  - 물류비: ${formatKRW(fees.logisticsFee)}\n` +
    `  - 수수료: ${formatKRW(fees.commissionFee)}\n` +
    `  - 배송비: ${formatKRW(fees.shippingFee)}\n` +
    `  - 광고비: ${formatKRW(fees.adFee)}`;

  return `
## 분석 기간
${period.year}년 ${period.month}월

## 플랫폼별 매출
- 네이버: ${formatKRW(naver.revenue)}
- 쿠팡:   ${formatKRW(coupang.revenue)}
- 오프라인: ${formatKRW(offline.revenue)}

## 네이버 정산/비용 내역
${feeDetail("네이버", naver.fees)}

## 쿠팡 정산/비용 내역
${feeDetail("쿠팡", coupang.fees)}

## 수익 요약
- 최종 매출: ${formatKRW(profit.totalRevenue)}
- 플랫폼 총 비용: ${formatKRW(profit.platformFees)}
- 재료비 (15%): ${formatKRW(profit.materialCost)}
- 최종 이익: ${formatKRW(profit.grossProfit)}
- 순이익: ${formatKRW(profit.netProfit)}

## 끈갈피(핸드메이드) 판매 TOP 5
${
  handmadeRanking.length > 0
    ? handmadeRanking
        .map(
          (r) =>
            `${r.rank}위. ${r.productName}: ${r.totalQuantity}개 / ${formatKRW(r.totalRevenue)}`
        )
        .join("\n")
    : "데이터 없음"
}

## 제품 카테고리별 판매량
- 핸드메이드(끈갈피): ${[...naver.products, ...coupang.products, ...offline.products]
    .filter((p) => p.category === "handmade")
    .reduce((s, p) => s + p.quantity, 0)}개
- 기타 상품: ${[...naver.products, ...coupang.products, ...offline.products]
    .filter((p) => p.category === "other")
    .reduce((s, p) => s + p.quantity, 0)}개
`.trim();
}

/**
 * Claude API를 사용해 이번 달 판매 인사이트 생성.
 * claude-opus-4-6 모델 사용.
 */
export async function generateSalesInsights(
  report: Omit<MonthlyReport, "insights">
): Promise<SalesInsight[]> {
  const prompt = buildPrompt(report);

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    system: `당신은 이커머스 전문 데이터 분석가입니다.
핸드메이드 끈갈피 제품을 주력으로 네이버 스마트스토어·쿠팡·오프라인에서 판매하는 사업자의 월별 데이터를 분석합니다.
응답은 반드시 아래 JSON 배열 형식으로만 출력하세요. 추가 설명 없이 JSON만 반환하세요.

[
  {
    "title": "인사이트 제목 (15자 이내)",
    "description": "구체적인 설명과 행동 권장 사항 (100자 이내)",
    "type": "positive | negative | neutral | action"
  }
]

type 분류:
- positive: 좋은 성과나 개선점
- negative: 주의가 필요한 지표
- neutral: 중립적 관찰
- action: 즉시 실행 가능한 액션 아이템`,
    messages: [
      {
        role: "user",
        content: `다음 판매 데이터를 분석하여 핵심 인사이트 5~7개를 JSON 배열로 제공해주세요.\n\n${prompt}`,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude API에서 텍스트 응답을 받지 못했습니다.");
  }

  const jsonMatch = textBlock.text.trim().match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("인사이트 JSON 파싱 실패: " + textBlock.text);
  }

  return JSON.parse(jsonMatch[0]) as SalesInsight[];
}
