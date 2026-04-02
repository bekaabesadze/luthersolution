/**
 * ExpandedGrowthChart.tsx
 * Enhanced expanded view for Quarterly Growth chart with bank-by-bank comparison and rankings.
 */

import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { ExpandedCard } from "./ExpandedCard";
import type { MetricRow } from "../api/types";
import { metricsToGrowthRankings } from "../utils/metricsTransform";
import styles from "./ExpandedViews.module.css";

export interface ExpandedGrowthChartProps {
  growthData: { quarter: string; growth: number }[];
  metrics: MetricRow[];
  onClose: () => void;
}

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

const tooltipContentStyle = {
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border)",
  boxShadow: "var(--shadow-md)",
  padding: "0.75rem 1rem",
  background: "var(--color-surface)",
  fontSize: "0.875rem",
  fontWeight: 500,
} as const;

export function ExpandedGrowthChart({ growthData, metrics, onClose }: ExpandedGrowthChartProps) {
  const rankings = useMemo(() => {
    return metricsToGrowthRankings(metrics);
  }, [metrics]);

  const bankTrendData = useMemo(() => {
    const byBank: Record<string, Record<string, number>> = {};
    const quarters = new Set<string>();

    rankings.forEach((rank) => {
      rank.quarters.forEach((q) => {
        quarters.add(q.quarter);
        if (!byBank[rank.bank]) byBank[rank.bank] = {};
        byBank[rank.bank][q.quarter] = q.growth;
      });
    });

    const sortedQuarters = Array.from(quarters).sort();
    return sortedQuarters.map((quarter) => {
      const data: any = { quarter };
      rankings.forEach((rank) => {
        data[rank.bank] = byBank[rank.bank]?.[quarter] || null;
      });
      return data;
    });
  }, [rankings]);

  const topGrower = rankings[0];
  const mostVolatile = [...rankings].sort((a, b) => b.volatility - a.volatility)[0];
  const mostConsistent = [...rankings].sort((a, b) => a.volatility - b.volatility)[0];

  const handleExport = () => {
    const csv = [
      ["Rank", "Bank", "Avg Growth %", "Latest Growth %", "Volatility"],
      ...rankings.map((r) => [
        String(r.rank),
        r.bank,
        r.avgGrowth.toFixed(2),
        r.latestGrowth.toFixed(2),
        r.volatility.toFixed(2),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "growth_rankings.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ExpandedCard title="Quarterly Growth - Bank Comparison" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        {/* Stats Panel */}
        <div className={styles.comparisonPanel}>
          {topGrower && (
            <div className={styles.comparisonItem}>
              <div className={styles.comparisonLabel}>Top Grower</div>
              <div className={styles.comparisonValue}>{topGrower.bank}</div>
              <div className={styles.comparisonChangePositive}>
                {topGrower.avgGrowth.toFixed(1)}% avg
              </div>
            </div>
          )}
          {mostVolatile && (
            <div className={styles.comparisonItem}>
              <div className={styles.comparisonLabel}>Most Volatile</div>
              <div className={styles.comparisonValue}>{mostVolatile.bank}</div>
              <div className={styles.comparisonChange}>
                σ: {mostVolatile.volatility.toFixed(2)}
              </div>
            </div>
          )}
          {mostConsistent && (
            <div className={styles.comparisonItem}>
              <div className={styles.comparisonLabel}>Most Consistent</div>
              <div className={styles.comparisonValue}>{mostConsistent.bank}</div>
              <div className={styles.comparisonChange}>
                σ: {mostConsistent.volatility.toFixed(2)}
              </div>
            </div>
          )}
        </div>

        {/* Multi-line Growth Chart */}
        {(bankTrendData.length > 0 || growthData.length > 0) && (
          <div>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem" }}>
              {bankTrendData.length > 0 ? "Bank-by-Bank Growth Trends" : "Quarterly Growth Trend"}
            </h3>
            <div style={{ height: "400px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={bankTrendData.length > 0 ? bankTrendData : growthData}
                  margin={{ top: 16, right: 24, left: 8, bottom: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="quarter"
                    tick={{ fontSize: 12, fill: "var(--color-text-muted)", fontWeight: 500 }}
                    stroke="var(--color-border)"
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
                    stroke="transparent"
                    tickFormatter={(v) => `${v}%`}
                    width={50}
                    domain={[(min: number) => Math.max(-100, Math.min(min, 0)), "auto"]}
                  />
                  <Tooltip
                    formatter={(value: number) => (value !== null ? [`${value.toFixed(1)}%`, ""] : ["—", ""])}
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
                  <Legend />
                  {bankTrendData.length > 0 ? (
                    rankings.slice(0, 8).map((rank, i) => (
                      <Line
                        key={rank.bank}
                        type="monotone"
                        dataKey={rank.bank}
                        stroke={COLORS[i % COLORS.length]}
                        strokeWidth={2.5}
                        dot={{ fill: COLORS[i % COLORS.length], r: 4 }}
                        activeDot={{ r: 6 }}
                        name={rank.bank}
                        connectNulls
                      />
                    ))
                  ) : (
                    <Line
                      type="monotone"
                      dataKey="growth"
                      stroke={COLORS[0]}
                      strokeWidth={2.8}
                      dot={{ fill: COLORS[0], r: 4 }}
                      activeDot={{ r: 6 }}
                      name="Growth"
                      connectNulls
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Rankings Table */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Growth Rankings</h3>
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
                  <th className={styles.num}>Avg Growth %</th>
                  <th className={styles.num}>Latest Growth %</th>
                  <th className={styles.num}>Volatility (σ)</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((rank) => (
                  <tr key={rank.bank}>
                    <td>{rank.rank}</td>
                    <td>{rank.bank}</td>
                    <td
                      className={`${styles.num} ${
                        rank.avgGrowth >= 0 ? styles.comparisonChangePositive : styles.comparisonChangeNegative
                      }`}
                    >
                      {rank.avgGrowth >= 0 ? "+" : ""}
                      {rank.avgGrowth.toFixed(2)}%
                    </td>
                    <td
                      className={`${styles.num} ${
                        rank.latestGrowth >= 0 ? styles.comparisonChangePositive : styles.comparisonChangeNegative
                      }`}
                    >
                      {rank.latestGrowth >= 0 ? "+" : ""}
                      {rank.latestGrowth.toFixed(2)}%
                    </td>
                    <td className={styles.num}>{rank.volatility.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ExpandedCard>
  );
}
