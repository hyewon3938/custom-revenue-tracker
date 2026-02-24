import Anthropic from "@anthropic-ai/sdk";
import { MonthlyReport, SalesInsight } from "@/lib/types";
import { formatKRW } from "@/lib/utils/format";

// 모듈 로드 시 초기화하지 않음 (API 키 없으면 생성자 자체가 throw)
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다. .env.local에 추가하세요."
    );
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function buildPrompt(report: Omit<MonthlyReport, "insights">): string {
  const { period, naver, coupang, offline, summary, overallRanking } = report;

  return `
## 분석 기간
${period.year}년 ${period.month}월 (${report.dataRange.start} ~ ${report.dataRange.end})

## 플랫폼별 매출 및 비용
### 네이버
- 매출: ${formatKRW(naver.revenue)}
- 수수료: ${formatKRW(naver.fees.commissionFee)}
- 물류비: ${formatKRW(naver.fees.logisticsFee)} (일반배송 ${naver.shippingStats.regularCount}건 / 무료배송 ${naver.shippingStats.freeCount}건)
- 광고비: ${formatKRW(naver.fees.adFee)}
- 정산금: ${formatKRW(naver.fees.settlementAmount)}
- 이익: ${formatKRW(naver.profit.profit)} / 순이익: ${formatKRW(naver.profit.netProfit)}

### 쿠팡
- 매출: ${formatKRW(coupang.revenue)}
- 수수료: ${formatKRW(coupang.fees.commissionFee)}
- 물류비: ${formatKRW(coupang.fees.logisticsFee)}
- 광고비: ${formatKRW(coupang.fees.adFee)}
- 이익: ${formatKRW(coupang.profit.profit)} / 순이익: ${formatKRW(coupang.profit.netProfit)}

### 오프라인 (${offline.venueName})
- 매출: ${formatKRW(offline.revenue)}
- 수수료: ${formatKRW(offline.fees.commissionFee)}
- 물류비: ${formatKRW(offline.fees.logisticsFee)}
- 광고비: ${formatKRW(offline.fees.adFee)}
- 이익: ${formatKRW(offline.profit.profit)} / 순이익: ${formatKRW(offline.profit.netProfit)}

## 전체 요약
- 총 매출: ${formatKRW(summary.totalRevenue)}
- 총 이익: ${formatKRW(summary.totalProfit)}
- 총 부자재비: ${formatKRW(summary.totalMaterialCost)}
- 총 순이익: ${formatKRW(summary.totalNetProfit)}

## 판매량
- 전체: ${summary.totalQuantity}개 (끈갈피 ${summary.handmadeQuantity}개 / 기타 ${summary.otherQuantity}개)

## 상품별 판매 TOP 5
${
  overallRanking.length > 0
    ? overallRanking
        .map(
          (r) =>
            `${r.rank}위. ${r.productName}: 총 ${r.total}개 (네이버 ${r.naver} / 쿠팡 ${r.coupang} / 오프라인 ${r.offline})`
        )
        .join("\n")
    : "데이터 없음"
}
`.trim();
}

/**
 * Claude API를 사용해 월간 판매 인사이트 생성.
 * claude-opus-4-6 모델 사용.
 */
export async function generateSalesInsights(
  report: Omit<MonthlyReport, "insights">
): Promise<SalesInsight[]> {
  const prompt = buildPrompt(report);

  const message = await getClient().messages.create({
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
