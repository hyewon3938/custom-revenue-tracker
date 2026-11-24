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
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  GRID_PROPS,
  X_TICK,
  Y_TICK,
  MONEY_AXIS_WIDTH,
  LABEL_STYLE,
  LABEL_FILL,
  BREAK_EVEN_COLOR,
  formatManWon,
} from "./chart-config";

const COLOR_POSITIVE = "#00C4FF";
const COLOR_NEGATIVE = "#FF5B5B";

interface Props {
  data: MonthlyOverview[];
}

export default function NetProfitChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" tick={X_TICK} />
        <YAxis
          tickFormatter={(v) => formatManWon(v)}
          tick={Y_TICK}
          width={MONEY_AXIS_WIDTH}
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
          stroke={BREAK_EVEN_COLOR}
          strokeDasharray="4 2"
          label={{
            value: "0원",
            position: "right",
            fontSize: 10,
            fill: BREAK_EVEN_COLOR,
          }}
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
            formatter={(v: unknown) => formatManWon((v as number) ?? 0)}
            style={{ ...LABEL_STYLE, fill: LABEL_FILL }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
