import { useState, useEffect } from "react";
import { MonthlyReport } from "@/lib/types";
import { getErrorMessage } from "@/lib/utils/error";

/** 저장된 레포트 목록의 한 항목 */
export interface SavedReportEntry {
  year: number;
  month: number;
}

/**
 * 월별 레포트 화면의 조회 상태를 관리합니다.
 *
 * 저장된 레포트 목록을 처음 한 번 불러와 가장 최근 달을 선택하고,
 * 선택한 연·월이 바뀔 때마다 그 달의 레포트를 불러옵니다.
 * 목록 초기 로드가 선택 연·월을 바꾸므로 선택 상태도 이 훅이 갖습니다.
 *
 * @param initialYear - 목록 로드 전에 선택해 둘 연도
 * @param initialMonth - 목록 로드 전에 선택해 둘 월
 */
export function useMonthlyReport(initialYear: number, initialMonth: number) {
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [savedList, setSavedList] = useState<SavedReportEntry[]>([]);
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 저장된 레포트 목록 초기 로드
  useEffect(() => {
    fetch("/api/report")
      .then((r) => r.json())
      .then((list: SavedReportEntry[]) => {
        // 목록 조회가 에러 객체를 반환한 경우 방어 (savedList는 항상 배열이어야 함)
        if (!Array.isArray(list)) return;
        setSavedList(list);
        if (list.length > 0) {
          setSelectedYear(list[0].year);
          setSelectedMonth(list[0].month);
        }
      })
      .catch(console.error);
  }, []);

  // 선택 월 변경 시 레포트 로드
  //
  // savedList는 의존성에서 제외한다. 수집 직후 savedList에 새 달이 추가되면
  // 이 effect가 다시 돌면서 방금 응답으로 받은 레포트를 굳이 재조회했고,
  // 그 재조회가 끝날 때까지 화면 전체가 "불러오는 중"으로 덮였다.
  // (재수집은 savedList가 그대로라 재조회가 없어 정상 동작 — 첫 수집만 멈춘 이유)
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setIsLoading(true);
    setError(null);
    fetch(`/api/report?year=${selectedYear}&month=${selectedMonth}`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (r.status === 404) return null; // 아직 수집하지 않은 달
        if (!r.ok) throw new Error("레포트 로드 실패");
        return r.json();
      })
      .then((data: MonthlyReport | null) => {
        if (!cancelled) setReport(data);
      })
      .catch((e: unknown) => {
        if (cancelled || (e instanceof Error && e.name === "AbortError"))
          return;
        setError(getErrorMessage(e, "레포트 로드 실패"));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    // 월을 빠르게 바꿔도 이전 응답이 뒤늦게 덮어쓰지 않도록 취소
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedYear, selectedMonth]);

  return {
    report,
    setReport,
    savedList,
    setSavedList,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    isLoading,
    error,
    setError,
  };
}
