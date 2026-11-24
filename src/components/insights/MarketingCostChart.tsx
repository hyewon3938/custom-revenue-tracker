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
  CHART_HEIGHT,
  CHART_MARGIN,
  GRID_PROPS,
  X_TICK,
  Y_TICK,
  MONEY_AXIS_WIDTH,
  LABEL_STYLE,
  LABEL_FILL,
  MAN_WON,
  formatManWon,
  formatKRWTooltip,
} from "./chart-config";

interface Props {
  data: MonthlyOverview[];
}

export default function MarketingCostChart({ data }: Props) {
  // 마케팅 비용 합계 계산
  const chartData = data.map((m) => ({
    ...m,
    totalMarketingCost: m.naverAdFee + m.coupangAdFee + m.sponsorshipCost,
  }));

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={chartData} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" tick={X_TICK} />
        <YAxis
          tickFormatter={(v) => (v >= MAN_WON ? formatManWon(v) : `${v}`)}
          tick={Y_TICK}
          width={MONEY_AXIS_WIDTH}
        />
        <Tooltip formatter={formatKRWTooltip} />
        <Legend />
        <Bar
          dataKey="naverAdFee"
          name="네이버 광고비"
          stackId="marketing"
          fill="#2938E4"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="coupangAdFee"
          name="쿠팡 광고비"
          stackId="marketing"
          fill="#848EF0"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="sponsorshipCost"
          name="협찬 마케팅"
          stackId="marketing"
          fill="#CDD1F9"
          radius={[4, 4, 0, 0]}
        >
          <LabelList
            dataKey="totalMarketingCost"
            position="top"
            formatter={(v: unknown) => {
              const val = (v as number) ?? 0;
              if (val === 0) return "";
              return val >= MAN_WON ? formatManWon(val) : formatKRW(val);
            }}
            style={{ ...LABEL_STYLE, fill: LABEL_FILL }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
