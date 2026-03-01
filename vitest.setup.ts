/**
 * Vitest 전역 셋업.
 * config.ts가 환경변수를 요구하므로 테스트 기본값을 설정합니다.
 */

// 테스트 환경용 기본값 (실제 .env.local 값과 무관)
process.env.ONLINE_MATERIAL_RATE ??= "0.15";
process.env.OFFLINE_MATERIAL_RATE ??= "0.2";
process.env.GROQ_API_KEY ??= "test-key";
process.env.ENABLE_AI_INSIGHTS ??= "false";
