/**
 * ExpandedMetricBreakdown.tsx
 * Detailed expanded view for Metric Breakdown chart with definitions and bank-by-bank drill-down.
 */

import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { ExpandedCard } from "./ExpandedCard";
import type { MetricRow } from "../api/types";
import { metricsToBankBreakdown, metricsToHistoricalTrends } from "../utils/metricsTransform";
import styles from "./ExpandedViews.module.css";

export interface ExpandedMetricBreakdownProps {
  metricBreakdownData: { name: string; value: number }[];
  metrics: MetricRow[];
  onClose: () => void;
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

const METRIC_DEFINITIONS: Record<string, string> = {
  Revenue: "Total income generated from banking operations, including interest and non-interest income",
  "Net Profit": "Profit after all expenses, taxes, and deductions",
  Deposits: "Total customer deposits held by the bank",
  Loans: "Total loans and advances extended to customers",
  "Total Assets": "Sum of all assets owned by the bank",
  "Total Equity": "Owners' equity or shareholders' equity",
  "Net Interest Income": "Difference between interest earned and interest paid",
  "Non Interest Income": "Income from fees, commissions, and other non-interest sources",
};

const normalizeMetricName = (name: string): string => {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
};

const getMetricMatcher = (metricName: string): ((name: string) => boolean) => {
  const normalized = normalizeMetricName(metricName).toLowerCase();
  return (name: string) => {
    const n = normalizeMetricName(name).toLowerCase();
    return n === normalized || n.includes(normalized) || normalized.includes(n);
  };
};

const tooltipContentStyle = {
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border)",
  boxShadow: "var(--shadow-md)",
  padding: "0.75rem 1rem",
  background: "var(--color-surface)",
  fontSize: "0.875rem",
  fontWeight: 500,
} as const;

export function ExpandedMetricBreakdown({ metricBreakdownData, metrics, onClose }: ExpandedMetricBreakdownProps) {
  const [selectedMetric, setSelectedMetric] = useState<string | null>(
    metricBreakdownData.length > 0 ? metricBreakdownData[0].name : null
  );

  const bankBreakdown = useMemo(() => {
    if (!selectedMetric) return [];
    const matcher = getMetricMatcher(selectedMetric);
    return metricsToBankBreakdown(metrics, matcher);
  }, [metrics, selectedMetric]);

  const historicalTrends = useMemo(() => {
    if (!selectedMetric) return [];
    const matcher = getMetricMatcher(selectedMetric);
    return metricsToHistoricalTrends(metrics, matcher);
  }, [metrics, selectedMetric]);

  const trendChartData = useMemo(() => {
    if (historicalTrends.length === 0) return [];
    const banks = Object.keys(historicalTrends[0]).filter(
      (k) => k !== "quarter" && k !== "year" && k !== "quarterNum"
    );
    return historicalTrends.map((t: any) => {
      const data: any = { quarter: t.quarter };
      banks.forEach((bank) => {
        data[bank] = t[bank] || 0;
      });
      return data;
    });
  }, [historicalTrends]);

  const total = metricBreakdownData.reduce((sum, d) => sum + d.value, 0);

  const renderTooltip = ({ payload }: any) => {
    if (!payload?.length) return null;
    const d = payload[0].payload;
    const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
    return (
      <div style={tooltipContentStyle}>
        <div style={{ fontWeight: 600, color: "var(--color-text)", marginBottom: 4 }}>{d.name}</div>
        <div style={{ color: "var(--color-text-muted)" }}>
          {d.value.toLocaleString()} ({pct}%)
        </div>
      </div>
    );
  };

  return (
    <ExpandedCard title="Metric Breakdown - Detailed Analysis" onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", height: "100%" }}>
        {/* Left: Donut Chart */}
        <div>
          <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem" }}>Metric Distribution</h3>
          <div style={{ height: "400px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <Pie
                  data={metricBreakdownData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={2}
                  label={({ name, percent }) => (percent >= 0.08 ? `${name}: ${(percent * 100).toFixed(0)}%` : "")}
                  labelLine={{ stroke: "var(--color-border)", strokeWidth: 1 }}
                >
                  {metricBreakdownData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
                      stroke="var(--color-surface)"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip content={renderTooltip} />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  formatter={(value) => {
                    const d = metricBreakdownData.find((x) => x.name === value);
                    const pct = d && total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
                    return `${value} (${pct}%)`;
                  }}
                  wrapperStyle={{ fontSize: "11px" }}
                  iconType="circle"
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Bank Breakdown and Definitions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Metric Selector */}
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--color-text-muted)" }}>
              Select Metric
            </label>
            <select
              value={selectedMetric || ""}
              onChange={(e) => setSelectedMetric(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                background: "var(--color-surface-elevated)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--color-text)",
                fontSize: "0.875rem",
              }}
            >
              {metricBreakdownData.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Metric Definition */}
          {selectedMetric && METRIC_DEFINITIONS[selectedMetric] && (
            <div style={{ padding: "1rem", background: "var(--color-bg-subtle)", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "0.5rem" }}>
                Definition
              </div>
              <div style={{ fontSize: "0.875rem", color: "var(--color-text)", lineHeight: 1.5 }}>
                {METRIC_DEFINITIONS[selectedMetric]}
              </div>
            </div>
          )}

          {/* Bank Breakdown Table */}
          {bankBreakdown.length > 0 && (
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>
                Bank Breakdown: {selectedMetric}
              </h3>
              <div style={{ overflowX: "auto", maxHeight: "300px", overflowY: "auto" }}>
                <table className={styles.bankBreakdownTable}>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Bank</th>
                      <th className={styles.num}>Value</th>
                      <th className={styles.num}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankBreakdown.map((item) => (
                      <tr key={item.bank}>
                        <td>{item.rank}</td>
                        <td>{item.bank}</td>
                        <td className={styles.num}>{item.value.toLocaleString()}</td>
                        <td className={styles.num}>{item.percentage.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Historical Trend Chart */}
      {trendChartData.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem" }}>
            Historical Trend: {selectedMetric}
          </h3>
          <div style={{ height: "300px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendChartData} margin={{ top: 16, right: 24, left: 8, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="quarter"
                  tick={{ fontSize: 12, fill: "var(--color-text-muted)", fontWeight: 500 }}
                  stroke="var(--color-border)"
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
                  stroke="transparent"
                  tickFormatter={(v) => v.toLocaleString()}
                  width={60}
                />
                <Tooltip
                  formatter={(value: number) => [value.toLocaleString(), ""]}
                  contentStyle={tooltipContentStyle}
                  labelStyle={{ color: "var(--color-text)", fontWeight: 600 }}
                />
                <Legend />
                {Object.keys(trendChartData[0] || {})
                  .filter((k) => k !== "quarter")
                  .slice(0, 8)
                  .map((bank, i) => (
                    <Line
                      key={bank}
                      type="monotone"
                      dataKey={bank}
                      stroke={DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      name={bank}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </ExpandedCard>
  );
}
