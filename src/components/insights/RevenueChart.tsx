"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LabelList,
} from "recharts";
import { MonthlyOverview } from "@/lib/types";
import { formatKRW } from "@/lib/utils/format";
import {
  CHART_MARGIN,
  GRID_PROPS,
  X_TICK,
  Y_TICK,
  LABEL_STYLE,
} from "./chart-config";

interface Props {
  data: MonthlyOverview[];
}

export default function RevenueChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" tick={X_TICK} />
        <YAxis
          tickFormatter={(v) => `${Math.round(v / 10000)}만`}
          tick={Y_TICK}
          width={52}
        />
        <Tooltip
          formatter={(value: number | undefined, name: string | undefined) => [
            formatKRW(value ?? 0),
            name ?? "",
          ]}
        />
        <Legend />
        <Bar
          dataKey="naverRevenue"
          name="네이버"
          stackId="revenue"
          fill="#5EB1FD"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="coupangRevenue"
          name="쿠팡"
          stackId="revenue"
          fill="#3165F6"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="offlineRevenue"
          name="오프라인"
          stackId="revenue"
          fill="#182D9A"
          radius={[4, 4, 0, 0]}
        >
          {/* 스택 합계(총 매출)를 막대 위에 표시 */}
          <LabelList
            dataKey="totalRevenue"
            position="top"
            formatter={(v: unknown) =>
              `${Math.round(((v as number) ?? 0) / 10000)}만`
            }
            style={{ ...LABEL_STYLE, fill: "#374151" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
