/**
 * RevenueBarChart.tsx
 * Bar chart showing revenue by bank. Uses Recharts for a clean, readable chart.
 * Accepts data in { bank, revenue } shape for flexibility.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import styles from "./Charts.module.css";

export interface RevenueBarChartProps {
  data: { bank: string; revenue: number }[];
  title?: string;
  height?: number;
  axisFontSize?: number;
}

const formatRevenue = (v: number) =>
  v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : String(v);

const tooltipContentStyle = {
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border)",
  boxShadow: "var(--shadow-md)",
  padding: "0.75rem 1rem",
  background: "var(--color-surface)",
  fontSize: "0.875rem",
  fontWeight: 500,
} as const;

export function RevenueBarChart({
  data,
  title = "Revenue by bank",
  height = 300,
  axisFontSize = 13,
}: RevenueBarChartProps) {
  return (
    <div className={styles.chartWrapper}>
      {title ? <h3 className="card-title">{title}</h3> : null}
      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="bank"
              tick={{ fontSize: axisFontSize, fill: "var(--color-text-muted)", fontWeight: 600 }}
              stroke="var(--color-border)"
              axisLine={{ stroke: "var(--color-border)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: Math.max(10, axisFontSize - 1), fill: "var(--color-text-muted)", fontWeight: 600 }}
              stroke="transparent"
              tickLine={false}
              axisLine={false}
              tickFormatter={formatRevenue}
              width={48}
            />
            <Tooltip
              formatter={(value: number) => [value.toLocaleString(), "Revenue"]}
              contentStyle={tooltipContentStyle}
              cursor={{ fill: "var(--color-accent-soft)", radius: 4 }}
              labelStyle={{ color: "var(--color-text)", fontWeight: 600 }}
            />
            <Bar
              dataKey="revenue"
              fill="var(--color-accent)"
              radius={[6, 6, 0, 0]}
              name="Revenue"
              maxBarSize={56}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
