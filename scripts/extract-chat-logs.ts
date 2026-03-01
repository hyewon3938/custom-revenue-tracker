/**
 * 대화 로그 추출 스크립트
 * .claude/projects/ 폴더의 jsonl 대화 기록에서 사용자 메시지와 어시스턴트 요약만 추출
 *
 * 사용법: npx tsx scripts/extract-chat-logs.ts
 * 출력: scripts/chat-summary.md
 */

import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";

const PROJECT_DIR = join(
  process.env.HOME ?? "",
  ".claude/projects/-Users-ihyewon-custom-revenue-tracker"
);
const OUTPUT_PATH = join(__dirname, "chat-summary.md");

interface Message {
  type: string;
  message?: {
    role?: string;
    content?: string | Array<{ type: string; text?: string }>;
  };
  // summary (compaction) messages
  summary?: string;
}

function extractText(
  content: string | Array<{ type: string; text?: string }> | undefined
): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text!)
    .join("\n");
}

function processFile(filePath: string): string[] {
  const lines = readFileSync(filePath, "utf-8").split("\n").filter(Boolean);
  const results: string[] = [];

  for (const line of lines) {
    try {
      const entry: Message = JSON.parse(line);

      // 사용자 메시지
      if (entry.type === "human" && entry.message?.role === "human") {
        const text = extractText(entry.message.content);
        // system-reminder 태그 제거
        const cleaned = text
          .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
          .trim();
        if (cleaned && cleaned.length > 5) {
          results.push(`### 👤 사용자\n${cleaned}\n`);
        }
      }

      // 어시스턴트 텍스트 메시지 (도구 호출 제외, 핵심 응답만)
      if (entry.type === "assistant" && entry.message?.role === "assistant") {
        const text = extractText(entry.message.content);
        if (text && text.length > 20 && !text.startsWith("{")) {
          // 긴 코드 블록은 요약
          const summarized = text.replace(
            /```[\s\S]{500,}?```/g,
            "[코드 블록 생략]"
          );
          results.push(`### 🤖 어시스턴트\n${summarized}\n`);
        }
      }

      // compaction summary
      if (entry.summary) {
        results.push(
          `### 📋 세션 요약 (자동 압축)\n${entry.summary.slice(0, 3000)}\n`
        );
      }
    } catch {
      // skip malformed lines
    }
  }

  return results;
}

// 메인 실행
const files = readdirSync(PROJECT_DIR)
  .filter((f) => f.endsWith(".jsonl"))
  .map((f) => ({
    name: f,
    path: join(PROJECT_DIR, f),
    size: readFileSync(join(PROJECT_DIR, f)).length,
  }))
  .sort((a, b) => a.size - b.size); // 작은 파일부터

let output = `# 프로젝트 대화 기록 요약\n\n`;
output += `추출일: ${new Date().toISOString().split("T")[0]}\n`;
output += `총 세션: ${files.length}개\n\n---\n\n`;

for (const file of files) {
  const sizeKB = Math.round(file.size / 1024);
  output += `## 세션: ${file.name} (${sizeKB}KB)\n\n`;

  const messages = processFile(file.path);
  if (messages.length === 0) {
    output += `(메시지 없음 또는 추출 불가)\n\n`;
  } else {
    output += messages.join("\n---\n\n");
  }
  output += `\n---\n\n`;
}

writeFileSync(OUTPUT_PATH, output, "utf-8");

const outputSizeKB = Math.round(readFileSync(OUTPUT_PATH).length / 1024);
console.log(`✅ 추출 완료: ${OUTPUT_PATH}`);
console.log(`   세션 ${files.length}개 → ${outputSizeKB}KB`);
console.log(`\n새 Opus 세션에서 이 파일을 읽고 이력서 분석을 요청하세요.`);
