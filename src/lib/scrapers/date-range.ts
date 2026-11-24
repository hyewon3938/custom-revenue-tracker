import { calcEndDay, pad } from "@/lib/utils/format";

/**
 * 조회 기간 결정:
 * - 이번 달이면 1일 ~ 어제
 * - 지난 달(과거)이면 1일 ~ 말일
 */
export function getDateRange(
  year: number,
  month: number,
): { start: string; end: string } {
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(calcEndDay(year, month))}`,
  };
}
