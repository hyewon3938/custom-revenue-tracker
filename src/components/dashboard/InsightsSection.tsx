"use client";

import { useState, Fragment } from "react";
import { SalesInsight } from "@/lib/types";
import Card from "@/components/ui/Card";

// 타입 순서: 주의 → 액션 → 관찰 → 긍정
const TYPE_ORDER: SalesInsight["type"][] = [
  "negative",
  "action",
  "neutral",
  "positive",
];

const TYPE_CONFIG: Record<
  SalesInsight["type"],
  {
    label: string;
    icon: string;
    accentBg: string;
    accentText: string;
    iconBg: string;
    dotColor: string;
  }
> = {
  negative: {
    label: "주의",
    icon: "!",
    accentBg: "bg-[#D94848]",
    accentText: "text-white",
    iconBg: "bg-[#E56060]",
    dotColor: "bg-[#FF5555]",
  },
  action: {
    label: "액션",
    icon: "→",
    accentBg: "bg-[#4A9CE6]",
    accentText: "text-white",
    iconBg: "bg-[#60B5FF]",
    dotColor: "bg-[#60B5FF]",
  },
  neutral: {
    label: "관찰",
    icon: "i",
    accentBg: "bg-[#88A4B8]",
    accentText: "text-white",
    iconBg: "bg-[#9CB8CC]",
    dotColor: "bg-[#AFDDFF]",
  },
  positive: {
    label: "긍정",
    icon: "✓",
    accentBg: "bg-[#6BA55A]",
    accentText: "text-white",
    iconBg: "bg-[#7DB86C]",
    dotColor: "bg-[#A3D78A]",
  },
};

/** **볼드 마커** 파싱 → <strong> 변환 */
function renderBoldText(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  if (parts.length === 1) return text;

  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-gray-900">
        {part}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

/** ISO 타임스탬프 → "3월 1일 15:30 생성" */
function formatGeneratedAt(iso: string): string {
  const d = new Date(iso);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${m}월 ${day}일 ${h}:${min} 생성`;
}

interface Props {
  insights: SalesInsight[];
  insightsGeneratedAt?: string;
  lastModifiedAt?: string;
  onRegenerate: () => Promise<void>;
}

export default function InsightsSection({
  insights,
  insightsGeneratedAt,
  lastModifiedAt,
  onRegenerate,
}: Props) {
  const [regenerating, setRegenerating] = useState(false);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setRegenerating(false);
    }
  };

  // 낡음 판단: 인사이트 생성 이후 데이터가 변경됐는지
  const isStale =
    insights.length > 0 &&
    !!insightsGeneratedAt &&
    !!lastModifiedAt &&
    lastModifiedAt !== insightsGeneratedAt;

  // 타입별 그룹핑
  const grouped = TYPE_ORDER.map((type) => ({
    type,
    config: TYPE_CONFIG[type],
    items: insights.filter((i) => i.type === type),
  }));

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">AI 인사이트</h3>
        <div className="flex items-center gap-3">
          {/* 생성 시각 (fresh 상태일 때만) */}
          {insights.length > 0 && insightsGeneratedAt && !isStale && (
            <span className="text-xs text-gray-400">
              {formatGeneratedAt(insightsGeneratedAt)}
            </span>
          )}
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-brand-500 text-white hover:bg-brand-600"
          >
            {regenerating
              ? "생성 중..."
              : insights.length === 0
                ? "인사이트 생성"
                : "재생성"}
          </button>
        </div>
      </div>

      {/* 낡음 경고 배너 */}
      {isStale && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-700">
            <span className="mr-1.5">&#9888;</span>
            인사이트 생성 이후 데이터가 변경되었습니다.
            {insightsGeneratedAt && (
              <span className="text-amber-500 ml-1.5 text-xs">
                ({formatGeneratedAt(insightsGeneratedAt)})
              </span>
            )}
          </p>
        </div>
      )}

      {insights.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="text-sm text-gray-400">인사이트가 없습니다.</p>
          <p className="text-xs text-gray-300 mt-1">
            수기 데이터 입력 완료 후 &ldquo;생성&rdquo; 버튼을 눌러주세요.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {grouped.map((group) => (
            <Card key={group.type} className="p-0 overflow-hidden">
              {/* 카드 헤더 */}
              <div
                className={`flex items-center gap-2.5 px-5 py-3.5 ${group.config.accentBg}`}
              >
                <span
                  className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${group.config.iconBg} ${group.config.accentText}`}
                >
                  {group.config.icon}
                </span>
                <h4 className={`text-sm font-semibold ${group.config.accentText}`}>
                  {group.config.label}
                </h4>
                <span
                  className="text-xs ml-auto text-white/50"
                >
                  {group.items.length}건
                </span>
              </div>

              {/* 인사이트 목록 */}
              <div className="px-5 py-4">
                {group.items.length === 0 ? (
                  <p className="text-sm text-gray-300 py-2">
                    해당 항목이 없습니다.
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {group.items.map((insight, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span
                          className={`inline-block w-1.5 h-1.5 rounded-full mt-[7px] shrink-0 ${group.config.dotColor}`}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 leading-snug">
                            {insight.title}
                          </p>
                          <p className="text-[13px] text-gray-500 leading-relaxed mt-1">
                            {renderBoldText(insight.description)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
