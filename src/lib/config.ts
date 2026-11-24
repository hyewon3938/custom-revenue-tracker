/**
 * 전체 환경변수 + 비즈니스 상수를 한 곳에서 관리.
 * 모든 process.env 접근은 이 파일에서만 수행.
 */

// ─── 환경변수 읽기 헬퍼 (이 파일에서만 사용) ──────────────────────────────

function requireRate(key: string): number {
  const val = process.env[key];
  if (!val) throw new Error(`환경변수 ${key}가 설정되지 않았습니다.`);
  const n = parseFloat(val);
  if (isNaN(n)) throw new Error(`환경변수 ${key}는 숫자여야 합니다.`);
  return n;
}

function envInt(key: string, fallback: number): number {
  return parseInt(process.env[key] ?? "") || fallback;
}

function envStr(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

// ─── 이익 계산 ──────────────────────────────────────────────────────────

/** 온라인(네이버·쿠팡) 부자재비 비율 */
export const ONLINE_MATERIAL_RATE = requireRate("ONLINE_MATERIAL_RATE");

/** 오프라인 부자재비 비율 */
export const OFFLINE_MATERIAL_RATE = requireRate("OFFLINE_MATERIAL_RATE");

// ─── 배송비 ─────────────────────────────────────────────────────────────

/** 네이버 고객 배송비 (유료배송 기준) */
export const NAVER_SHIPPING_FEE = envInt("NAVER_SHIPPING_FEE", 3000);

/** 네이버 판매자 실배송비 (택배사 비용) */
export const NAVER_SHIPPING_COST = envInt("NAVER_SHIPPING_COST", 3300);

/** 쿠팡 배송 마크업 (단가 상승분) */
export const COUPANG_SHIPPING_MARKUP = envInt("COUPANG_SHIPPING_MARKUP", 2000);

// ─── 협찬 마케팅 ────────────────────────────────────────────────────────

/** 마케팅 링크 총 수수료율 (주문관리 1.947% + 판매수수료 0.91%) */
export const MARKETING_LINK_FEE_RATE = parseFloat(
  envStr("MARKETING_LINK_FEE_RATE", "0.02857"),
);

/** 협찬 고객 배송비 (스토어 설정 기준) */
export const SPONSOR_SHIPPING_FEE = envInt("SPONSOR_SHIPPING_FEE", 3000);

/** 협찬 실배송비 (택배사 비용) */
export const SPONSOR_SHIPPING_COST = envInt("SPONSOR_SHIPPING_COST", 3300);

// ─── 세션 ───────────────────────────────────────────────────────────────

/** 브라우저 세션 유효기간 (일) */
export const SESSION_TTL_DAYS = envInt("SESSION_TTL_DAYS", 30);

// ─── 외부 API 요청 ──────────────────────────────────────────────────────

/**
 * 외부 API(네이버·쿠팡) 요청 1회당 타임아웃 (ms).
 * 응답 없이 열려만 있는 연결이 수집 전체를 무한 대기시키는 것을 방지.
 */
export const API_REQUEST_TIMEOUT_MS = envInt("API_REQUEST_TIMEOUT_MS", 30_000);

/** 외부 API 요청 최대 시도 횟수 (첫 시도 포함) */
export const API_MAX_RETRIES = 3;

/** 재시도 대기 기본값 (ms). n번째 시도 실패 후 이 값 × n 만큼 대기 */
export const API_RETRY_BACKOFF_MS = 1_000;

// ─── 외부 API 인증 정보 ─────────────────────────────────────────────────
// 스크립트가 .env.local을 로드한 뒤 모듈을 동적 import 하는 경우가 있어
// 모듈 로드 시점에 고정하지 않고 호출 시점에 읽는다.
// 값이 없을 때의 처리(에러·경고)는 호출부가 맡는다.

/** 네이버 커머스 API 인증 정보 */
export function getNaverApiCredentials(): {
  clientId: string | undefined;
  clientSecret: string | undefined;
} {
  return {
    clientId: process.env.NAVER_CLIENT_ID,
    clientSecret: process.env.NAVER_CLIENT_SECRET,
  };
}

/** 쿠팡 Wing API 인증 정보 */
export function getCoupangApiCredentials(): {
  accessKey: string | undefined;
  secretKey: string | undefined;
} {
  return {
    accessKey: process.env.COUPANG_ACCESS_KEY,
    secretKey: process.env.COUPANG_SECRET_KEY,
  };
}

/** 쿠팡 판매자 ID (RG 주문 API 조회용) */
export function getCoupangVendorId(): string | undefined {
  return process.env.COUPANG_VENDOR_ID;
}

// ─── AI ─────────────────────────────────────────────────────────────────

export const GROQ_API_KEY = envStr("GROQ_API_KEY", "");
export const AI_MODEL = envStr("AI_MODEL", "llama-3.3-70b-versatile");
export const ENABLE_AI_INSIGHTS = envStr("ENABLE_AI_INSIGHTS", "") === "true";

// ─── 유사도 임계값 ──────────────────────────────────────────────────────

/** 매핑 자동 생성 시 유사도 임계값 (낮을수록 공격적 매칭) */
export const MAPPING_SIMILARITY_THRESHOLD = 0.25;

/** 오프라인 수기 입력 → canonical 매칭 임계값 */
export const OFFLINE_SIMILARITY_THRESHOLD = 0.5;
