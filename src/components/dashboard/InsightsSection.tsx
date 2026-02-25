"use client";

import { useState } from "react";
import { SalesInsight } from "@/lib/types";

const TYPE_CONFIG: Record<
  SalesInsight["type"],
  { card: string; badge: string; label: string }
> = {
  positive: {
    card: "bg-green-50 border-green-200",
    badge: "bg-green-100 text-green-700",
    label: "긍정",
  },
  negative: {
    card: "bg-red-50 border-red-200",
    badge: "bg-red-100 text-red-700",
    label: "주의",
  },
  neutral: {
    card: "bg-warm-100 border-warm-200",
    badge: "bg-warm-200 text-warm-700",
    label: "관찰",
  },
  action: {
    card: "bg-brand-50 border-brand-200",
    badge: "bg-brand-100 text-brand-700",
    label: "액션",
  },
};

interface Props {
  insights: SalesInsight[];
  onRegenerate: () => Promise<void>;
}

export default function InsightsSection({ insights, onRegenerate }: Props) {
  const [regenerating, setRegenerating] = useState(false);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800">AI 인사이트</h3>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="text-sm text-brand-500 hover:text-brand-700 disabled:opacity-40 transition-colors"
        >
          {regenerating ? "생성 중..." : "재생성"}
        </button>
      </div>

      {insights.length === 0 ? (
        <div className="bg-white rounded-xl border border-warm-200 py-12 text-center text-sm text-gray-400">
          인사이트가 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {insights.map((insight, idx) => {
            const cfg = TYPE_CONFIG[insight.type] ?? TYPE_CONFIG.neutral;
            return (
              <div
                key={idx}
                className={`rounded-xl border p-4 ${cfg.card}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-semibold text-gray-800 text-sm leading-snug">
                    {insight.title}
                  </p>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 font-medium ${cfg.badge}`}
                  >
                    {cfg.label}
                  </span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {insight.description}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
