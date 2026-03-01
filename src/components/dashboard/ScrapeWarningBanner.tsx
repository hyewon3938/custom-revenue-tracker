"use client";

import { ScrapeWarning } from "@/lib/types";

interface Props {
  warnings: ScrapeWarning[];
}

export default function ScrapeWarningBanner({ warnings }: Props) {
  if (!warnings || warnings.length === 0) return null;

  const hasError = warnings.some((w) => w.level === "error");

  return (
    <div
      className={`rounded-lg border p-4 ${
        hasError
          ? "bg-red-50 border-red-200"
          : "bg-amber-50 border-amber-200"
      }`}
    >
      <p
        className={`text-sm font-semibold mb-2 ${
          hasError ? "text-red-800" : "text-amber-800"
        }`}
      >
        {hasError
          ? "데이터 수집 중 문제가 발생했습니다"
          : "데이터 수집 시 주의사항이 있습니다"}
      </p>
      <ul className="space-y-1">
        {warnings.map((w, i) => (
          <li
            key={i}
            className={`text-xs leading-relaxed flex items-start gap-1.5 ${
              w.level === "error" ? "text-red-700" : "text-amber-700"
            }`}
          >
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                w.level === "error" ? "bg-red-400" : "bg-amber-400"
              }`}
            />
            {w.message}
          </li>
        ))}
      </ul>
      {hasError && (
        <p className="text-xs text-red-600 mt-2">
          재수집을 시도하거나, 0으로 표시된 값을 수기로 수정해 주세요.
        </p>
      )}
    </div>
  );
}
