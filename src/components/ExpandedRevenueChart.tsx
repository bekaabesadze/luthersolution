/**
 * ExpandedRevenueChart.tsx
 * Enhanced expanded view for Revenue by Bank chart with multi-line trends and detailed table.
 */

import { useState, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ExpandedCard } from "./ExpandedCard";
import type { MetricRow } from "../api/types";
import { metricsToHistoricalTrends } from "../utils/metricsTransform";
import styles from "./ExpandedViews.module.css";

export interface ExpandedRevenueChartProps {
  revenueData: { bank: string; revenue: number }[];
  metrics: MetricRow[];
  onClose: () => void;
}

const isRevenue = (name: string) => {
  const n = name.toLowerCase();
  return n === "revenue" || n === "value" || n === "revenues" || n === "totalrevenue" || n === "operatingrevenue" || n === "netrevenue";
};

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

const COLORS = [
  "var(--color-accent)",
  "#00c875",
  "#ffcb00",
  "#6366f1",
  "#a855f7",
  "#f97316",
  "#ec4899",
  "#14b8a6",
];

export function ExpandedRevenueChart({ revenueData, metrics, onClose }: ExpandedRevenueChartProps) {
  const [activeTab, setActiveTab] = useState<"chart" | "trend" | "table">("chart");

  const breakdown = useMemo(() => {
    const total = revenueData.reduce((sum, d) => sum + d.revenue, 0);
    return revenueData
      .map((d) => ({
        bank: d.bank,
        revenue: d.revenue,
        percentage: total > 0 ? (d.revenue / total) * 100 : 0,
        rank: 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .map((item, i) => ({ ...item, rank: i + 1 }));
  }, [revenueData]);

  const historicalTrends = useMemo(() => {
    return metricsToHistoricalTrends(metrics, isRevenue);
  }, [metrics]);

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

  const handleExport = () => {
    const csv = [
      ["Bank", "Revenue", "Market Share %", "Rank"],
      ...breakdown.map((b) => [b.bank, String(b.revenue), `${b.percentage.toFixed(2)}%`, String(b.rank)]),
    ]
      .map((row) => row.join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "revenue_by_bank.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const topBank = breakdown[0];
  const totalRevenue = revenueData.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <ExpandedCard
      title="Revenue by Bank - Detailed Analysis"
      onClose={onClose}
      tabs={[
        { id: "chart", label: "Chart View" },
        { id: "trend", label: "Trend View" },
        { id: "table", label: "Table View" },
      ]}
      activeTab={activeTab}
      onTabChange={(tab) => setActiveTab(tab as "chart" | "trend" | "table")}
    >
      {activeTab === "chart" && (
        <div style={{ position: "relative", height: "100%" }}>
          {topBank && (
            <div className={styles.statsPanel}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Total Revenue</span>
                <span className={styles.statValue}>{formatRevenue(totalRevenue)}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Top Bank</span>
                <span className={styles.statValue}>{topBank.bank}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Top Share</span>
                <span className={styles.statValue}>{topBank.percentage.toFixed(1)}%</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Banks</span>
                <span className={styles.statValue}>{revenueData.length}</span>
              </div>
            </div>
          )}
          <div style={{ height: "500px", marginTop: "1rem" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} margin={{ top: 16, right: 24, left: 8, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="bank"
                  tick={{ fontSize: 13, fill: "var(--color-text-muted)", fontWeight: 500 }}
                  stroke="var(--color-border)"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
                  stroke="transparent"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatRevenue}
                  width={60}
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
                  maxBarSize={80}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === "trend" && (
        <div style={{ height: "500px" }}>
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
                tickFormatter={formatRevenue}
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
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2.5}
                    dot={false}
                    name={bank}
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeTab === "table" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Detailed Revenue Data</h3>
            <button type="button" className={styles.exportButton} onClick={handleExport}>
              Export CSV
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className={styles.bankBreakdownTable}>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Bank</th>
                  <th className={styles.num}>Revenue</th>
                  <th className={styles.num}>Market Share</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((item) => (
                  <tr key={item.bank}>
                    <td>{item.rank}</td>
                    <td>{item.bank}</td>
                    <td className={styles.num}>{item.revenue.toLocaleString()}</td>
                    <td className={styles.num}>{item.percentage.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ExpandedCard>
  );
}
