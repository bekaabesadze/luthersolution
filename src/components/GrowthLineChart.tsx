/**
 * GrowthLineChart.tsx
 * Line chart for quarterly growth trend. Uses Recharts for smooth, readable visualization.
 * Accepts data in { quarter, growth } shape.
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import styles from "./Charts.module.css";

export interface GrowthLineChartProps {
  data: { quarter: string; growth: number }[];
  title?: string;
}

const tooltipContentStyle = {
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border)",
  boxShadow: "var(--shadow-md)",
  padding: "0.75rem 1rem",
  background: "var(--color-surface)",
  fontSize: "0.875rem",
  fontWeight: 500,
} as const;

export function GrowthLineChart({ data, title = "Quarterly growth (%)" }: GrowthLineChartProps) {
  return (
    <div className={styles.chartWrapper}>
      {title ? <h3 className="card-title">{title}</h3> : null}
      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="quarter"
              tick={{ fontSize: 13, fill: "var(--color-text-muted)", fontWeight: 500 }}
              stroke="var(--color-border)"
              axisLine={{ stroke: "var(--color-border)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
              stroke="transparent"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
              domain={["auto", "auto"]}
              width={48}
            />
            <Tooltip
              formatter={(value: number) => [`${value}%`, "Growth"]}
              contentStyle={tooltipContentStyle}
              labelStyle={{ color: "var(--color-text)", fontWeight: 600 }}
            />
            <Line
              type="monotone"
              dataKey="growth"
              stroke="var(--color-accent)"
              strokeWidth={2.5}
              dot={{ fill: "var(--color-accent)", stroke: "var(--color-surface)", strokeWidth: 2, r: 5 }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: "var(--color-surface)" }}
              name="Growth"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
