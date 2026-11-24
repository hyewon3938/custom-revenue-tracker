import { useState, useCallback, Dispatch, SetStateAction } from "react";
import { MonthlyReport } from "@/lib/types";
import { COLLECT_TIMEOUT_MS } from "@/lib/constants";
import { getErrorMessage } from "@/lib/utils/error";
import { requestJson } from "@/lib/utils/request";
import { SavedReportEntry } from "./useMonthlyReport";

/** 타임아웃 안내 문구에서 ms를 분으로 바꿀 때 쓰는 값 */
const MS_PER_MINUTE = 60_000;

const JSON_HEADERS = { "Content-Type": "application/json" };

/** POST /api/insights 응답에서 레포트에 반영하는 필드 */
type InsightsResponse = Pick<
  MonthlyReport,
  "insights" | "insightsGeneratedAt" | "lastModifiedAt"
>;

interface Params {
  selectedYear: number;
  selectedMonth: number;
  setReport: Dispatch<SetStateAction<MonthlyReport | null>>;
  setSavedList: Dispatch<SetStateAction<SavedReportEntry[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
}

/**
 * 월별 레포트를 바꾸는 요청(수집, 수기 편집, 인사이트 재생성)을 묶습니다.
 * 결과와 오류는 넘겨받은 setter로 `useMonthlyReport`의 상태에 반영합니다.
 */
export function useReportActions({
  selectedYear,
  selectedMonth,
  setReport,
  setSavedList,
  setError,
}: Params) {
  const [isCollecting, setIsCollecting] = useState(false);

  // 데이터 수집
  const handleCollect = async () => {
    setIsCollecting(true);
    setError(null);
    try {
      const data = await requestJson<MonthlyReport>(
        "/api/scrape",
        {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({ year: selectedYear, month: selectedMonth }),
          signal: AbortSignal.timeout(COLLECT_TIMEOUT_MS),
        },
        "데이터 수집 중 오류가 발생했습니다.",
      );
      setReport(data);
      setSavedList((prev) => {
        const exists = prev.some(
          (r) => r.year === selectedYear && r.month === selectedMonth,
        );
        if (exists) return prev;
        return [{ year: selectedYear, month: selectedMonth }, ...prev];
      });
    } catch (err) {
      if (err instanceof Error && err.name === "TimeoutError") {
        setError(
          `수집 응답이 ${COLLECT_TIMEOUT_MS / MS_PER_MINUTE}분 안에 오지 않았습니다. ` +
            `터미널 로그를 확인한 뒤 다시 시도해주세요.`,
        );
      } else {
        setError(getErrorMessage(err, "알 수 없는 오류"));
      }
    } finally {
      setIsCollecting(false);
    }
  };

  // 수기 편집 (PATCH)
  //
  // 의존성은 선택 연·월만 둔다. setReport·setError는 useState setter라 참조가
  // 바뀌지 않으므로, 넣지 않아야 자식에게 넘기는 onUpdate 참조가 바뀌는 시점이
  // 페이지에 있던 때와 같게 유지된다.
  const handleUpdate = useCallback(
    async (patch: object) => {
      try {
        const updated = await requestJson<MonthlyReport>(
          "/api/report",
          {
            method: "PATCH",
            headers: JSON_HEADERS,
            body: JSON.stringify({
              year: selectedYear,
              month: selectedMonth,
              ...patch,
            }),
          },
          "저장 실패",
        );
        setReport(updated);
      } catch (err) {
        setError(getErrorMessage(err, "저장 중 오류가 발생했습니다."));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedYear, selectedMonth],
  );

  // AI 인사이트 재생성
  const handleRegenerate = async () => {
    try {
      const { insights, insightsGeneratedAt, lastModifiedAt } =
        await requestJson<InsightsResponse>(
          "/api/insights",
          {
            method: "POST",
            headers: JSON_HEADERS,
            body: JSON.stringify({ year: selectedYear, month: selectedMonth }),
          },
          "인사이트 생성 실패",
        );
      setReport((prev) =>
        prev
          ? { ...prev, insights, insightsGeneratedAt, lastModifiedAt }
          : prev,
      );
    } catch (err) {
      setError(getErrorMessage(err, "인사이트 생성 중 오류가 발생했습니다."));
    }
  };

  return { isCollecting, handleCollect, handleUpdate, handleRegenerate };
}
