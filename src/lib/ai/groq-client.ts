import { GROQ_API_KEY, AI_MODEL } from "@/lib/config";

// ─── Groq API (OpenAI 호환 REST) ───────────────────────────────────────

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

/** 응답 다양성 (0에 가까울수록 결정적) */
const GROQ_TEMPERATURE = 0.7;

/** 응답 최대 토큰 수 */
const GROQ_MAX_TOKENS = 4096;

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GroqResponse {
  choices: { message: { content: string } }[];
  error?: { message: string };
}

export async function callGroq(messages: GroqMessage[]): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY 환경변수가 설정되지 않았습니다. .env.local에 추가하세요.",
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
      temperature: GROQ_TEMPERATURE,
      max_tokens: GROQ_MAX_TOKENS,
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
