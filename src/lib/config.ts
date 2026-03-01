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

/** 리뷰 마케팅 끈갈피 1개당 비용 */
export const REVIEW_MARKETING_COST_PER_HANDMADE = envInt(
  "REVIEW_MARKETING_COST_PER_HANDMADE",
  0
);

// ─── 세션 ───────────────────────────────────────────────────────────────

/** 브라우저 세션 유효기간 (일) */
export const SESSION_TTL_DAYS = envInt("SESSION_TTL_DAYS", 30);

// ─── AI ─────────────────────────────────────────────────────────────────

export const GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";
export const AI_MODEL = process.env.AI_MODEL ?? "llama-3.3-70b-versatile";
export const ENABLE_AI_INSIGHTS = process.env.ENABLE_AI_INSIGHTS === "true";

// ─── 유사도 임계값 ──────────────────────────────────────────────────────

/** 매핑 자동 생성 시 유사도 임계값 (낮을수록 공격적 매칭) */
export const MAPPING_SIMILARITY_THRESHOLD = 0.25;

/** 오프라인 수기 입력 → canonical 매칭 임계값 */
export const OFFLINE_SIMILARITY_THRESHOLD = 0.5;
