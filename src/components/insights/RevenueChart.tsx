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

const formatKRW = (v: number) =>
  v.toLocaleString("ko-KR") + " 원";

interface Props {
  data: MonthlyOverview[];
}

export default function RevenueChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 24, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis
          tickFormatter={(v) => `${Math.round(v / 10000)}만`}
          tick={{ fontSize: 11 }}
          width={52}
        />
        <Tooltip
          formatter={(value: number | undefined, name: string | undefined) => [formatKRW(value ?? 0), name ?? ""]}
        />
        <Legend />
        <Bar
          dataKey="naverRevenue"
          name="네이버"
          stackId="revenue"
          fill="#A3D78A"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="coupangRevenue"
          name="쿠팡"
          stackId="revenue"
          fill="#FF937E"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="offlineRevenue"
          name="오프라인"
          stackId="revenue"
          fill="#FF5555"
          radius={[4, 4, 0, 0]}
        >
          {/* 스택 합계(총 매출)를 막대 위에 표시 */}
          <LabelList
            dataKey="totalRevenue"
            position="top"
            formatter={(v: unknown) => `${Math.round(((v as number) ?? 0) / 10000)}만`}
            style={{ fontSize: 11, fill: "#374151", fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
