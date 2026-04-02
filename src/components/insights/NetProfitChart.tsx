"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  LabelList,
  Cell,
} from "recharts";
import { MonthlyOverview } from "@/lib/types";
import { formatKRW } from "@/lib/utils/format";
import { CHART_MARGIN, GRID_PROPS, X_TICK, Y_TICK, LABEL_STYLE } from "./chart-config";

const COLOR_POSITIVE = "#00C4FF";
const COLOR_NEGATIVE = "#FF5B5B";

interface Props {
  data: MonthlyOverview[];
}

export default function NetProfitChart({ data }: Props) {
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
          formatter={(value: number | undefined) => [
            formatKRW(value ?? 0),
            "순수익",
          ]}
        />
        {/* 손익분기선 */}
        <ReferenceLine
          y={0}
          stroke="#ef4444"
          strokeDasharray="4 2"
          label={{ value: "0원", position: "right", fontSize: 10, fill: "#ef4444" }}
        />
        <Bar dataKey="totalNetProfit" name="순수익" radius={[4, 4, 0, 0]}>
          {data.map((entry, idx) => (
            <Cell
              key={idx}
              fill={entry.totalNetProfit >= 0 ? COLOR_POSITIVE : COLOR_NEGATIVE}
            />
          ))}
          <LabelList
            dataKey="totalNetProfit"
            position="top"
            formatter={(v: unknown) => {
              const n = (v as number) ?? 0;
              return `${Math.round(n / 10000)}만`;
            }}
            style={{ ...LABEL_STYLE, fill: "#374151" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
