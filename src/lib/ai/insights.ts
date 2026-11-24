import { MonthlyOverview, SalesInsight } from "@/lib/types";
import { callGroq, GroqMessage } from "./groq-client";
import { buildPrompt, Report } from "./prompt-sections";
import { sanitizeInsights, sanitizeText } from "./sanitize";
import { SYSTEM_PROMPT } from "./system-prompt";

// 기존 import 경로(`@/lib/ai/insights`) 호환용 re-export
export { buildPrompt, sanitizeText };

// ─── 타입 분포 검증 ───────────────────────────────────────────────────

/** type별 최소 요구 개수 */
const ACTION_MIN = 2;
const POS_NEG_MIN = 3;

export interface TypeDeficit {
  action: number; // 부족한 action 개수
  posNeg: number; // 부족한 positive+negative 개수
}

/** 인사이트 배열의 타입 분포를 검증하여 부족분을 반환 */
export function findTypeDeficit(insights: SalesInsight[]): TypeDeficit {
  const actionCount = insights.filter((i) => i.type === "action").length;
  const posNegCount = insights.filter(
    (i) => i.type === "positive" || i.type === "negative",
  ).length;

  return {
    action: Math.max(0, ACTION_MIN - actionCount),
    posNeg: Math.max(0, POS_NEG_MIN - posNegCount),
  };
}

/** 부족한 타입만 보충 요청하는 프롬프트 생성 */
export function buildSupplementPrompt(
  existing: SalesInsight[],
  deficit: TypeDeficit,
): string {
  const existingList = existing
    .map((i) => `- [${i.type}] ${i.title}`)
    .join("\n");

  const requests: string[] = [];
  if (deficit.action > 0) {
    requests.push(
      `- **action** 타입 ${deficit.action}개 (구체적이고 즉시 실행 가능한 액션)`,
    );
  }
  if (deficit.posNeg > 0) {
    requests.push(`- **positive 또는 negative** 타입 ${deficit.posNeg}개`);
  }

  return `기존에 생성된 인사이트:
${existingList}

위 인사이트에서 아래 타입이 부족합니다. **기존 인사이트와 중복되지 않는 새로운 관점**으로 추가 생성해주세요:

${requests.join("\n")}

동일한 JSON 배열 형식으로 추가할 인사이트만 반환하세요.`;
}

/** JSON 배열 응답에서 SalesInsight[] 파싱 (실패 시 null) */
export function parseInsightsJson(text: string): SalesInsight[] | null {
  const match = text.trim().match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    return sanitizeInsights(JSON.parse(match[0]) as SalesInsight[]);
  } catch {
    return null;
  }
}

// ─── 메인 함수 ─────────────────────────────────────────────────────────

/**
 * Groq API (Llama 3.3)를 사용해 월간 판매 인사이트 생성.
 * history: [전달, 전전달, 전전전달] 순. 없으면 당월 데이터만으로 분석.
 * overview: 전체 기간 월별 개요 데이터 (장기 추세 분석용).
 *
 * 1차 생성 후 타입 분포를 검증하여, 부족한 타입이 있으면
 * 보충 요청(2차 호출)으로 기존 인사이트를 보존하면서 누락 타입만 추가.
 */
export async function generateSalesInsights(
  report: Report,
  history?: (Report | null)[],
  overview?: MonthlyOverview[],
): Promise<SalesInsight[]> {
  const prompt = buildPrompt(report, history, overview);

  const systemMessage: GroqMessage = {
    role: "system",
    content: SYSTEM_PROMPT,
  };
  const dataMessage: GroqMessage = {
    role: "user",
    content: `다음 판매 데이터를 분석하여 핵심 인사이트 7~12개를 JSON 배열로 제공해주세요.\n\n${prompt}`,
  };

  // ── 1차: 메인 인사이트 생성 ──
  const text = await callGroq([systemMessage, dataMessage]);

  const insights = parseInsightsJson(text);
  if (!insights) {
    throw new Error("인사이트 JSON 파싱 실패");
  }

  // ── 2차: 타입 분포 검증 → 부족하면 보충 ──
  const deficit = findTypeDeficit(insights);
  if (deficit.action === 0 && deficit.posNeg === 0) {
    return insights; // 모든 타입 충족 → 바로 반환
  }

  const supplementText = await callGroq([
    systemMessage,
    dataMessage,
    { role: "assistant", content: JSON.stringify(insights) },
    { role: "user", content: buildSupplementPrompt(insights, deficit) },
  ]);

  const supplement = parseInsightsJson(supplementText);
  if (!supplement) {
    return insights; // 보충 파싱 실패 → 원본 반환
  }

  return [...insights, ...supplement];
}
