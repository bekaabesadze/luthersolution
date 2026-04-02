import { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Area,
  Line,
} from "recharts";
import type { ForecastMetricSeries } from "../api/types";
import { formatOutlookValue } from "../utils/outlookFormatting";
import styles from "./Charts.module.css";

interface OutlookMetricChartProps {
  series: ForecastMetricSeries | null;
  height?: number;
}

export function OutlookMetricChart({ series, height = 360 }: OutlookMetricChartProps) {
  const chartData = useMemo(() => {
    if (!series) return [];

    const rows = new Map<
      string,
      {
        label: string;
        key: string;
        actualValue?: number;
        forecastValue?: number;
        peerMedianValue?: number;
        bandBase?: number;
        bandSize?: number;
      }
    >();

    series.primary_points.forEach((point) => {
      const row = rows.get(point.key) ?? { label: point.label, key: point.key };
      if (point.is_forecast) {
        row.forecastValue = point.value ?? undefined;
        if (point.lower != null && point.upper != null) {
          row.bandBase = point.lower;
          row.bandSize = Math.max(0, point.upper - point.lower);
        }
      } else {
        row.actualValue = point.value ?? undefined;
      }
      rows.set(point.key, row);
    });

    const lastActual = [...series.primary_points].reverse().find((point) => !point.is_forecast);
    if (lastActual) {
      const row = rows.get(lastActual.key);
      if (row) {
        row.forecastValue = lastActual.value ?? undefined;
      }
    }

    series.peer_median_points.forEach((point) => {
      const row = rows.get(point.key) ?? { label: point.label, key: point.key };
      row.peerMedianValue = point.value ?? undefined;
      rows.set(point.key, row);
    });

    return Array.from(rows.values());
  }, [series]);

  if (!series || chartData.length === 0) {
    return (
      <div className={styles.chartWrapper}>
        <div className={styles.chartContainer}>
          <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
            Forecast data will appear here after a bank is selected.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chartWrapper}>
      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={chartData} margin={{ top: 14, right: 16, left: 8, bottom: 14 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "var(--color-text-muted)", fontWeight: 600 }}
              stroke="var(--color-border)"
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--color-text-muted)", fontWeight: 600 }}
              stroke="transparent"
              tickLine={false}
              axisLine={false}
              width={76}
              tickFormatter={(value: number) => formatOutlookValue(value, series.format, { compact: true })}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border)",
                boxShadow: "var(--shadow-md)",
                padding: "0.8rem 0.95rem",
                background: "var(--color-surface)",
              }}
              formatter={(value: number | string | Array<number>, name: string) => {
                if (typeof value !== "number") return [value, name];
                if (name === "Forecast band") return [formatOutlookValue(value, series.format), name];
                return [formatOutlookValue(value, series.format), name];
              }}
              labelStyle={{ color: "var(--color-text)", fontWeight: 700 }}
            />
            <ReferenceLine
              y={0}
              stroke="var(--color-border-strong)"
              strokeOpacity={0.45}
              strokeDasharray="4 4"
              ifOverflow="extendDomain"
            />
            <Area
              type="monotone"
              dataKey="bandBase"
              stackId="forecast-band"
              stroke="none"
              fill="transparent"
              isAnimationActive={false}
              connectNulls={false}
            />
            <Area
              type="monotone"
              dataKey="bandSize"
              stackId="forecast-band"
              name="Forecast band"
              stroke="none"
              fill="rgba(87, 155, 252, 0.18)"
              isAnimationActive
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="peerMedianValue"
              name="Peer median"
              stroke="var(--color-text-muted)"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="actualValue"
              name="Actual"
              stroke="var(--color-text)"
              strokeWidth={2.6}
              dot={{ r: 4, fill: "var(--color-text)" }}
              activeDot={{ r: 5 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="forecastValue"
              name="Forecast"
              stroke="var(--color-accent)"
              strokeWidth={2.6}
              strokeDasharray="7 5"
              dot={{ r: 4, fill: "var(--color-accent)" }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
