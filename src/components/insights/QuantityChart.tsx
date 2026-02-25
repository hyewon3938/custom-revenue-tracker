"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { MonthlyOverview } from "@/lib/types";

interface Props {
  data: MonthlyOverview[];
}

export default function QuantityChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 24, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis
          tickFormatter={(v) => `${v}개`}
          tick={{ fontSize: 11 }}
          width={44}
        />
        <Tooltip formatter={(value: number | undefined) => [`${value ?? 0}개`]} />
        <Legend />
        <Bar
          dataKey="handmadeQuantity"
          name="끈갈피"
          stackId="qty"
          fill="#0046FF"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="otherQuantity"
          name="기타"
          stackId="qty"
          fill="#73C8D2"
          radius={[4, 4, 0, 0]}
        >
          {/* 스택 합계(총 판매량)를 막대 위에 표시 */}
          <LabelList
            dataKey="totalQuantity"
            position="top"
            formatter={(v: unknown) => `${(v as number) ?? 0}개`}
            style={{ fontSize: 11, fill: "#374151", fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
