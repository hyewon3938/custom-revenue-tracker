"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { MonthlyOverview } from "@/lib/types";
import { CHART_MARGIN, GRID_PROPS, X_TICK, Y_TICK, LABEL_STYLE } from "./chart-config";

interface Props {
  data: MonthlyOverview[];
}

export default function MarginChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ ...CHART_MARGIN, right: 24 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" tick={X_TICK} />
        <YAxis
          tickFormatter={(v) => `${v}%`}
          tick={Y_TICK}
          width={48}
          domain={["auto", "auto"]}
        />
        <Tooltip formatter={(value: number | undefined) => [`${value ?? 0}%`, "마진율"]} />
        {/* 손익분기선 (마진율 0%) */}
        <ReferenceLine
          y={0}
          stroke="#ef4444"
          strokeDasharray="4 2"
          label={{ value: "0%", position: "right", fontSize: 10, fill: "#ef4444" }}
        />
        <Line
          type="monotone"
          dataKey="marginRate"
          name="마진율"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 4, fill: "#3b82f6" }}
          activeDot={{ r: 6 }}
        >
          {/* 각 점 위에 마진율 값 표시 */}
          <LabelList
            dataKey="marginRate"
            position="top"
            formatter={(v: unknown) => `${(v as number) ?? 0}%`}
            style={{ ...LABEL_STYLE, fill: "#3b82f6" }}
          />
        </Line>
      </LineChart>
    </ResponsiveContainer>
  );
}
