/**
 * GrowthLineChart.tsx
 * Line chart for quarterly growth trend. Uses Recharts for smooth, readable visualization.
 * Accepts data in { quarter, growth } shape.
 */

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Label,
  ReferenceLine,
  Legend,
} from "recharts";
import styles from "./Charts.module.css";

export interface GrowthLineChartProps {
  data: Array<Record<string, any>>;
  title?: string;
  /** When provided, renders one line per key (e.g. bank names). */
  seriesKeys?: string[];
  height?: number;
  hideControls?: boolean;
  /** Compact mode: hides axis labels and reduces margins for widget view */
  compact?: boolean;
  axisFontSize?: number;
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

const decimalsOptions = [0, 1, 2] as const;

const SERIES_COLORS = [
  "var(--color-accent)",
  "#00c875",
  "#ffcb00",
  "#6366f1",
  "#a855f7",
  "#f97316",
  "#ec4899",
  "#14b8a6",
];

export function GrowthLineChart({
  data,
  title = "Quarterly growth (%)",
  seriesKeys,
  height = 300,
  hideControls = false,
  compact = false,
  axisFontSize = 13,
}: GrowthLineChartProps) {
  const [decimals, setDecimals] = useState<number>(1);

  const fmt = (v: number) => v.toFixed(decimals);
  const isMulti = !!seriesKeys && seriesKeys.length > 1;

  return (
    <div className={styles.chartWrapper}>
      {title ? <h3 className="card-title">{title}</h3> : null}
      {!hideControls && !compact ? (
        <div className={styles.chartControls}>
          <span className={styles.controlLabel}>Decimals:</span>
          {decimalsOptions.map((d) => (
            <button
              key={d}
              type="button"
              className={`${styles.controlBtn} ${decimals === d ? styles.controlBtnActive : ""}`}
              onClick={() => setDecimals(d)}
            >
              {d}
            </button>
          ))}
        </div>
      ) : null}
      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 12, right: 16, left: 8, bottom: compact ? 8 : 48 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="quarter"
              tick={{ fontSize: axisFontSize, fill: "var(--color-text-muted)", fontWeight: 600 }}
              stroke="var(--color-border)"
              axisLine={{ stroke: "var(--color-border)" }}
              tickLine={false}
            >
              {!compact && (
                <Label
                  value="Quarter"
                  position="bottom"
                  offset={32}
                  style={{ fill: "var(--color-text-muted)", fontSize: Math.max(10, axisFontSize - 1), fontWeight: 700 }}
                />
              )}
            </XAxis>
            <YAxis
              tick={{ fontSize: Math.max(10, axisFontSize - 1), fill: "var(--color-text-muted)", fontWeight: 600 }}
              stroke="transparent"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${fmt(v)}%`}
              domain={[(min: number) => Math.max(-100, Math.min(min, 0)), "auto"]}
              width={compact ? 44 : 56}
            >
              {!compact && (
                <Label
                  value="Growth Rate (%)"
                  angle={-90}
                  position="insideLeft"
                  offset={0}
                  style={{
                    fill: "var(--color-text-muted)",
                    fontSize: Math.max(10, axisFontSize - 1),
                    fontWeight: 700,
                    textAnchor: "middle",
                  }}
                />
              )}
            </YAxis>
            <Tooltip
              formatter={(value: number) => [`${fmt(value)}%`, ""]}
              contentStyle={tooltipContentStyle}
              labelStyle={{ color: "var(--color-text)", fontWeight: 600 }}
            />
            <ReferenceLine
              y={0}
              stroke="var(--color-text-muted)"
              strokeOpacity={0.55}
              strokeDasharray="3 3"
              strokeWidth={1.5}
              ifOverflow="extendDomain"
              isFront
            />
            {isMulti ? <Legend /> : null}
            {isMulti ? (
              seriesKeys!.map((key, i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  strokeWidth={2.3}
                  dot={{ fill: SERIES_COLORS[i % SERIES_COLORS.length], r: 4 }}
                  activeDot={{ r: 6 }}
                  name={key}
                  connectNulls
                />
              ))
            ) : (
              <Line
                type="monotone"
                dataKey="growth"
                stroke="var(--color-accent)"
                strokeWidth={2.5}
                dot={{ fill: "var(--color-accent)", stroke: "var(--color-surface)", strokeWidth: 2, r: 5 }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: "var(--color-surface)" }}
                name="Growth"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
