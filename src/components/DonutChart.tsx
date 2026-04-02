/**
 * DonutChart.tsx
 * Circular (donut) chart for revenue share by bank or metric breakdown. Uses Recharts.
 */

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import styles from "./Charts.module.css";

export interface DonutChartProps {
  data: { name: string; value: number }[];
  title?: string;
  /** Format value in tooltip (e.g. currency or percent). */
  valueFormatter?: (value: number) => string;
  /** Colors for segments; cycles if fewer than data length. */
  colors?: string[];
  /** Height of the chart container in pixels. */
  height?: number;
  /** When true, uses longer animation for pie segments "coming together" effect. */
  isExpanded?: boolean;
  /** Slice label style. */
  sliceLabelMode?: "namePercent" | "percentOnly" | "none";
  legendFontSize?: number;
}

const DEFAULT_COLORS = [
  "var(--color-accent)",
  "#00c875",
  "#ffcb00",
  "#6366f1",
  "#a855f7",
  "#f97316",
  "#ec4899",
  "#14b8a6",
];

const tooltipContentStyle = {
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border)",
  boxShadow: "var(--shadow-md)",
  padding: "0.75rem 1rem",
  background: "var(--color-surface)",
  fontSize: "0.875rem",
  fontWeight: 500,
} as const;

export function DonutChart({
  data,
  title = "",
  valueFormatter = (v) => v.toLocaleString(),
  colors = DEFAULT_COLORS,
  height = 280,
  isExpanded = false,
  sliceLabelMode = "namePercent",
  legendFontSize = 12,
}: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);

  const renderTooltip = ({ payload }: any) => {
    if (!payload?.length) return null;
    const d = payload[0].payload;
    const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
    return (
      <div style={tooltipContentStyle}>
        <div style={{ fontWeight: 600, color: "var(--color-text)", marginBottom: 4 }}>{d.name}</div>
        <div style={{ color: "var(--color-text-muted)" }}>
          {valueFormatter(d.value)} ({pct}%)
        </div>
      </div>
    );
  };

  if (data.length === 0) {
    return (
      <div className={styles.chartWrapper}>
        {title ? <h3 className="card-title">{title}</h3> : null}
        <div
          className={styles.chartContainer}
          style={{
            height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-text-muted)",
          }}
        >
          No data
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chartWrapper}>
      {title ? <h3 className="card-title">{title}</h3> : null}
      <div className={styles.chartContainer} style={{ height }}>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={64}
              outerRadius={100}
              paddingAngle={2}
              animationBegin={isExpanded ? 200 : 0}
              animationDuration={isExpanded ? 900 : 400}
              animationEasing="ease-out"
              label={({ name, percent }) => {
                if (sliceLabelMode === "none") return "";
                if (sliceLabelMode === "percentOnly") {
                  return percent >= 0.08 ? `${(percent * 100).toFixed(0)}%` : "";
                }
                return percent >= 0.06 ? `${name}: ${(percent * 100).toFixed(0)}%` : "";
              }}
              labelLine={sliceLabelMode === "namePercent" ? { stroke: "var(--color-border)", strokeWidth: 1 } : false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} stroke="var(--color-surface)" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={renderTooltip} />
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              formatter={(value) => {
                const d = data.find((x) => x.name === value);
                const pct = d && total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
                return `${value} (${pct}%)`;
              }}
              wrapperStyle={{ fontSize: `${legendFontSize}px` }}
              iconType="circle"
              iconSize={8}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
