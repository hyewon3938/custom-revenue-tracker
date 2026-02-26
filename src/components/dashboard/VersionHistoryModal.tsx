"use client";

import { useState, useEffect, useCallback } from "react";
import { MonthlyReport } from "@/lib/types";

interface VersionInfo {
  timestamp: number;
  date: string;
  size: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  month: number;
  onRestore: (report: MonthlyReport) => void;
}

export default function VersionHistoryModal({
  isOpen,
  onClose,
  year,
  month,
  onRestore,
}: Props) {
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [restoringTimestamp, setRestoringTimestamp] = useState<number | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/report/versions?year=${year}&month=${month}`
      );
      if (!res.ok) throw new Error("버전 목록 로드 실패");
      setVersions(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류 발생");
    } finally {
      setIsLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    if (isOpen) fetchVersions();
  }, [isOpen, fetchVersions]);

  if (!isOpen) return null;

  const handleRestore = async (timestamp: number) => {
    const dateStr = formatDateTime(timestamp);
    if (
      !confirm(
        `${dateStr} 버전으로 복구하시겠습니까?\n현재 데이터는 자동으로 백업됩니다.`
      )
    ) {
      return;
    }

    setRestoringTimestamp(timestamp);
    setError(null);
    try {
      const res = await fetch("/api/report/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, timestamp }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "복구 실패");
      }
      const report: MonthlyReport = await res.json();
      onRestore(report);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "복구 중 오류 발생");
    } finally {
      setRestoringTimestamp(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl border border-warm-200 shadow-lg w-full max-w-md mx-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              버전 이력
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {year}년 {month}월 — 최대 5개 보관
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none px-1"
          >
            &times;
          </button>
        </div>

        {/* 내용 */}
        <div className="px-5 pb-5 max-h-72 overflow-y-auto">
          {isLoading && (
            <p className="text-sm text-gray-400 py-4 text-center">
              불러오는 중...
            </p>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs mb-3">
              {error}
            </div>
          )}

          {!isLoading && versions.length === 0 && !error && (
            <p className="text-sm text-gray-400 py-8 text-center">
              저장된 이전 버전이 없습니다.
            </p>
          )}

          {!isLoading && versions.length > 0 && (
            <div className="divide-y divide-warm-100">
              {versions.map((v) => (
                <div
                  key={v.timestamp}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="text-sm text-gray-800">
                      {formatDateTime(v.timestamp)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatFileSize(v.size)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestore(v.timestamp)}
                    disabled={restoringTimestamp !== null}
                    className="text-sm text-brand-500 hover:text-brand-700 disabled:opacity-40 transition-colors px-2 py-1"
                  >
                    {restoringTimestamp === v.timestamp ? "복구 중..." : "복구"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}
