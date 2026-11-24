/** 차트 공통 설정 — 5개 차트(Revenue, NetProfit, Quantity, Margin, MarketingCost)에서 공유 */

import { formatKRW } from "@/lib/utils/format";

export const CHART_HEIGHT = 300;

export const CHART_MARGIN = { top: 24, right: 8, left: 8, bottom: 4 } as const;

export const GRID_PROPS = { strokeDasharray: "3 3", stroke: "#f0f0f0" } as const;

export const X_TICK = { fontSize: 12 } as const;

export const Y_TICK = { fontSize: 11 } as const;

/** 금액 Y축 너비 (Revenue, NetProfit, MarketingCost) */
export const MONEY_AXIS_WIDTH = 52;

/** LabelList 공통 스타일 (fill 색상만 각 차트에서 오버라이드) */
export const LABEL_STYLE = { fontSize: 11, fontWeight: 600 } as const;

// ─── 색상 ────────────────────────────────────────────────────────────────

/** 막대 위 합계 라벨 글자색 */
export const LABEL_FILL = "#374151";

/** 손익분기선(0 기준선)과 그 라벨 색 */
export const BREAK_EVEN_COLOR = "#ef4444";

// ─── 포맷 ────────────────────────────────────────────────────────────────

/** 1만 원 */
export const MAN_WON = 10000;

/** 원 단위 금액 → 만 원 단위 반올림 표기 ("123만") */
export function formatManWon(value: number): string {
  return `${Math.round(value / MAN_WON)}만`;
}

/** 스택 막대 툴팁: [원화 금액, 시리즈 이름] */
export function formatKRWTooltip(
  value: number | undefined,
  name: string | undefined
): [string, string] {
  return [formatKRW(value ?? 0), name ?? ""];
}
