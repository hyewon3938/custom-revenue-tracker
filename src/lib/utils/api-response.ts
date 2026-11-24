import { NextResponse } from "next/server";
import { getErrorMessage } from "./error";

/** `{ error }` 형태의 에러 응답 */
export function errorJson(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** catch 블록용 500 응답 — Error면 그 메시지를, 아니면 fallback 문구를 담는다 */
export function serverErrorJson(error: unknown, fallback: string) {
  return errorJson(getErrorMessage(error, fallback), 500);
}

/** 쿼리 문자열의 year·month를 정수로 변환. 하나라도 숫자가 아니면 null */
export function parseYearMonth(
  yearParam: string,
  monthParam: string
): { year: number; month: number } | null {
  const year = parseInt(yearParam);
  const month = parseInt(monthParam);
  if (isNaN(year) || isNaN(month)) return null;
  return { year, month };
}
