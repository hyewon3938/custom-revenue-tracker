/**
 * Groq API 연결 테스트 스크립트
 * 사용법: npx tsx scripts/test-groq.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnvKey(key: string): string {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(new RegExp(`^${key}\\s*=\\s*(.+)`));
      if (match) return match[1].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // ignore
  }
  return process.env[key] ?? "";
}

const API_KEY = loadEnvKey("GROQ_API_KEY");

if (!API_KEY) {
  console.error("GROQ_API_KEY가 .env.local에 설정되지 않았습니다.");
  console.error("1. https://console.groq.com 접속");
  console.error("2. 회원가입 (Google 계정 가능)");
  console.error("3. API Keys 메뉴에서 키 생성");
  console.error("4. .env.local에 GROQ_API_KEY=gsk_... 추가");
  process.exit(1);
}

console.log(`API Key: ${API_KEY.slice(0, 8)}...${API_KEY.slice(-4)}`);

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "gemma2-9b-it",
];

async function testModel(model: string): Promise<void> {
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "1+1=? 숫자만 답해줘." }],
        max_tokens: 32,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = (body as { error?: { message: string } }).error?.message ?? `HTTP ${res.status}`;
      console.log(`[FAIL] ${model}: ${msg.slice(0, 100)}`);
      return;
    }

    const data = await res.json() as { choices: { message: { content: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "(empty)";
    console.log(`[OK] ${model}: "${text.slice(0, 50)}"`);
  } catch (e) {
    console.log(`[FAIL] ${model}: ${e}`);
  }
}

async function main() {
  console.log("\n=== Groq API 모델별 테스트 ===\n");
  for (const m of MODELS) {
    await testModel(m);
  }
  console.log("\n기본 모델: llama-3.3-70b-versatile");
  console.log("변경하려면 .env.local에 AI_MODEL=모델이름 추가\n");
}

main();
