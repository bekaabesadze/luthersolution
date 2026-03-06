/**
 * ExpandedRevenueShare.tsx
 * Enhanced expanded view for Revenue Share chart with historical market share trends.
 */

import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { ExpandedCard } from "./ExpandedCard";
import type { MetricRow } from "../api/types";
import { metricsToMarketShare } from "../utils/metricsTransform";
import styles from "./ExpandedViews.module.css";

export interface ExpandedRevenueShareProps {
  revenueShareData: { name: string; value: number }[];
  metrics: MetricRow[];
  onClose: () => void;
}

const isRevenue = (name: string) => {
  const n = name.toLowerCase();
  return n === "revenue" || n === "value" || n === "revenues" || n === "totalrevenue" || n === "operatingrevenue" || n === "netrevenue";
};

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

export function ExpandedRevenueShare({ revenueShareData, metrics, onClose }: ExpandedRevenueShareProps) {
  const [activeTab, setActiveTab] = useState<"current" | "historical">("current");

  const total = revenueShareData.reduce((s, d) => s + d.value, 0);
  const topBank = revenueShareData.reduce((a, b) => (a.value >= b.value ? a : b), revenueShareData[0]);

  const marketShareData = useMemo(() => {
    return metricsToMarketShare(metrics, isRevenue);
  }, [metrics]);

  const historicalChartData = useMemo(() => {
    if (marketShareData.length === 0) return [];
    const banks = marketShareData[0]?.shares.map((s) => s.bank) || [];
    return marketShareData.map((ms) => {
      const data: any = { quarter: ms.quarter };
      banks.forEach((bank) => {
        const share = ms.shares.find((s) => s.bank === bank);
        data[bank] = share?.share || 0;
      });
      return data;
    });
  }, [marketShareData]);

  const calculateHHI = (shares: { bank: string; share: number }[]) => {
    return shares.reduce((sum, s) => sum + Math.pow(s.share, 2), 0);
  };

  const currentHHI = useMemo(() => {
    const shares = revenueShareData.map((d) => ({
      bank: d.name,
      share: total > 0 ? (d.value / total) * 100 : 0,
    }));
    return calculateHHI(shares);
  }, [revenueShareData, total]);

  const top3Share = useMemo(() => {
    const sorted = [...revenueShareData].sort((a, b) => b.value - a.value);
    const top3 = sorted.slice(0, 3);
    return top3.reduce((sum, d) => sum + (total > 0 ? (d.value / total) * 100 : 0), 0);
  }, [revenueShareData, total]);

  const shareChanges = useMemo(() => {
    if (marketShareData.length < 2) return [];
    const current = marketShareData[marketShareData.length - 1];
    const previous = marketShareData[marketShareData.length - 2];
    return current.shares.map((curr) => {
      const prev = previous.shares.find((p) => p.bank === curr.bank);
      return {
        bank: curr.bank,
        currentShare: curr.share,
        previousShare: prev?.share || 0,
        change: curr.share - (prev?.share || 0),
      };
    });
  }, [marketShareData]);

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
    <ExpandedCard
      title="Revenue Share - Market Analysis"
      onClose={onClose}
      tabs={[
        { id: "current", label: "Current Share" },
        { id: "historical", label: "Historical Trends" },
      ]}
      activeTab={activeTab}
      onTabChange={(tab) => setActiveTab(tab as "current" | "historical")}
    >
      {activeTab === "current" && (
        <div style={{ position: "relative", height: "100%" }}>
          <div className={styles.statsPanel}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Total Revenue</span>
              <span className={styles.statValue}>{total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Banks</span>
              <span className={styles.statValue}>{revenueShareData.length}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Top Bank</span>
              <span className={styles.statValue}>{topBank?.name || "—"}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Top Share</span>
              <span className={styles.statValue}>
                {topBank && total > 0 ? `${((topBank.value / total) * 100).toFixed(1)}%` : "—"}
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>HHI Index</span>
              <span className={styles.statValue}>{currentHHI.toFixed(0)}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Top 3 Share</span>
              <span className={styles.statValue}>{top3Share.toFixed(1)}%</span>
            </div>
          </div>
          <div style={{ height: "500px", marginTop: "1rem" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <Pie
                  data={revenueShareData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={140}
                  paddingAngle={2}
                  label={({ name, percent }) => (percent >= 0.06 ? `${name}: ${(percent * 100).toFixed(0)}%` : "")}
                  labelLine={{ stroke: "var(--color-border)", strokeWidth: 1 }}
                  animationBegin={200}
                  animationDuration={900}
                  animationEasing="ease-out"
                >
                  {revenueShareData.map((_, i) => (
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
                    const d = revenueShareData.find((x) => x.name === value);
                    const pct = d && total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
                    return `${value} (${pct}%)`;
                  }}
                  wrapperStyle={{ fontSize: "12px" }}
                  iconType="circle"
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === "historical" && (
        <div>
          <div style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
              Market Share Evolution
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", margin: 0 }}>
              Track how market share has changed over time for each bank
            </p>
          </div>
          {historicalChartData.length > 0 ? (
            <div style={{ height: "400px", marginBottom: "2rem" }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historicalChartData} margin={{ top: 16, right: 24, left: 8, bottom: 16 }}>
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
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(1)}%`, ""]}
                    contentStyle={tooltipContentStyle}
                    labelStyle={{ color: "var(--color-text)", fontWeight: 600 }}
                  />
                  <Legend />
                  {Object.keys(historicalChartData[0] || {})
                    .filter((k) => k !== "quarter")
                    .slice(0, 8)
                    .map((bank, i) => (
                      <Area
                        key={bank}
                        type="monotone"
                        dataKey={bank}
                        stackId="1"
                        stroke={DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
                        fill={DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
                        name={bank}
                      />
                    ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-muted)" }}>
              No historical data available
            </div>
          )}

          {shareChanges.length > 0 && (
            <div>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem" }}>
                Share Changes (vs Previous Period)
              </h3>
              <div style={{ overflowX: "auto" }}>
                <table className={styles.bankBreakdownTable}>
                  <thead>
                    <tr>
                      <th>Bank</th>
                      <th className={styles.num}>Current Share</th>
                      <th className={styles.num}>Previous Share</th>
                      <th className={styles.num}>Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shareChanges
                      .sort((a, b) => b.change - a.change)
                      .map((item) => (
                        <tr key={item.bank}>
                          <td>{item.bank}</td>
                          <td className={styles.num}>{item.currentShare.toFixed(2)}%</td>
                          <td className={styles.num}>{item.previousShare.toFixed(2)}%</td>
                          <td
                            className={`${styles.num} ${item.change >= 0 ? styles.comparisonChangePositive : styles.comparisonChangeNegative
                              }`}
                          >
                            {item.change >= 0 ? "+" : ""}
                            {item.change.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </ExpandedCard>
  );
}
