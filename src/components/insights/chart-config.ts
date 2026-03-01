/** 차트 공통 설정 — 3개 차트(Revenue, Quantity, Margin)에서 공유 */

export const CHART_MARGIN = { top: 24, right: 8, left: 8, bottom: 4 } as const;

export const GRID_PROPS = { strokeDasharray: "3 3", stroke: "#f0f0f0" } as const;

export const X_TICK = { fontSize: 12 } as const;

export const Y_TICK = { fontSize: 11 } as const;

/** LabelList 공통 스타일 (fill 색상만 각 차트에서 오버라이드) */
export const LABEL_STYLE = { fontSize: 11, fontWeight: 600 } as const;
