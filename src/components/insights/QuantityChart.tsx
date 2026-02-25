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
import { CHART_MARGIN, GRID_PROPS, X_TICK, Y_TICK, LABEL_STYLE } from "./chart-config";

interface Props {
  data: MonthlyOverview[];
}

export default function QuantityChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" tick={X_TICK} />
        <YAxis
          tickFormatter={(v) => `${v}개`}
          tick={Y_TICK}
          width={44}
        />
        <Tooltip formatter={(value: number | undefined) => [`${value ?? 0}개`]} />
        <Legend />
        <Bar
          dataKey="handmadeQuantity"
          name="끈갈피"
          stackId="qty"
          fill="#60B5FF"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="otherQuantity"
          name="기타"
          stackId="qty"
          fill="#AFDDFF"
          radius={[4, 4, 0, 0]}
        >
          {/* 스택 합계(총 판매량)를 막대 위에 표시 */}
          <LabelList
            dataKey="totalQuantity"
            position="top"
            formatter={(v: unknown) => `${(v as number) ?? 0}개`}
            style={{ ...LABEL_STYLE, fill: "#374151" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
