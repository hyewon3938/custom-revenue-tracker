"use client";

import dynamic from "next/dynamic";
import { ComponentType } from "react";
import { MonthlyOverview } from "@/lib/types";
import Card from "@/components/ui/Card";

interface ChartProps {
  data: MonthlyOverview[];
}

// 높이는 chart-config 의 CHART_HEIGHT(300)와 맞춘다. Tailwind 가 클래스를 찾도록 문자열로 둔다.
function ChartSkeleton() {
  return <div className="h-[300px] rounded-xl bg-gray-100 animate-pulse" />;
}

const loading = () => <ChartSkeleton />;

const CHARTS: { title: string; Component: ComponentType<ChartProps> }[] = [
  {
    title: "월별 매출",
    Component: dynamic(() => import("./RevenueChart"), { ssr: false, loading }),
  },
  {
    title: "월별 순수익",
    Component: dynamic(() => import("./NetProfitChart"), { ssr: false, loading }),
  },
  {
    title: "월별 판매량",
    Component: dynamic(() => import("./QuantityChart"), { ssr: false, loading }),
  },
  {
    title: "월별 마진율",
    Component: dynamic(() => import("./MarginChart"), { ssr: false, loading }),
  },
  {
    title: "월별 마케팅 비용",
    Component: dynamic(() => import("./MarketingCostChart"), { ssr: false, loading }),
  },
];

export default function ChartsSection({ data }: ChartProps) {
  return (
    <>
      {CHARTS.map(({ title, Component }) => (
        <section key={title}>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">{title}</h3>
          <Card>
            <Component data={data} />
          </Card>
        </section>
      ))}
    </>
  );
}
