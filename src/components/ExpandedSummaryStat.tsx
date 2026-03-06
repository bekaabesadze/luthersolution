/**
 * ExpandedSummaryStat.tsx
 * Detailed expanded view for summary stat cards showing bank breakdown, trends, and comparisons.
 */

import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ExpandedCard } from "./ExpandedCard";
import { CustomSelect } from "./CustomSelect";
import type { MetricRow } from "../api/types";
import {
  metricsToBankBreakdown,
  metricsToHistoricalTrends,
  metricsToComparison,
} from "../utils/metricsTransform";
import styles from "./ExpandedViews.module.css";

export type SummaryStatKey = "totalRevenue" | "totalDeposits" | "totalLoans" | "netProfit" | "avgGrowth" | "bankCount";

export interface ExpandedSummaryStatProps {
  statKey: SummaryStatKey;
  statLabel: string;
  metrics: MetricRow[];
  onClose: () => void;
}

const isRevenue = (name: string) => {
  const n = name.toLowerCase();
  return n === "revenue" || n === "value" || n === "revenues" || n === "totalrevenue" || n === "operatingrevenue" || n === "netrevenue";
};

const isGrowth = (name: string) => {
  const n = name.toLowerCase().replace(/[_\s]+/g, " ").trim();
  return n === "growth" || n === "growth pct" || n === "growth %" || n.includes("growth");
};

const getMetricMatcher = (key: SummaryStatKey): ((name: string) => boolean) => {
  switch (key) {
    case "totalRevenue":
      return isRevenue;
    case "totalDeposits":
      return (n) => n.toLowerCase().includes("deposit");
    case "totalLoans":
      return (n) => n.toLowerCase().includes("loan") && !n.toLowerCase().includes("growth");
    case "netProfit":
      return (n) => n.toLowerCase().includes("profit") || n.toLowerCase().includes("net income");
    case "avgGrowth":
      return isGrowth;
    case "bankCount":
      return () => false; // Special case, handled separately
    default:
      return () => false;
  }
};

const formatValue = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });

export function ExpandedSummaryStat({ statKey, statLabel, metrics, onClose }: ExpandedSummaryStatProps) {
  const [selectedBank, setSelectedBank] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const metricMatcher = getMetricMatcher(statKey);
  const bankOptions = useMemo(
    () => [
      { value: "", label: "All banks" },
      ...Array.from(new Set(metrics.map((m) => m.bank_id)))
        .sort((a, b) => a.localeCompare(b))
        .map((bank) => ({ value: bank, label: bank })),
    ],
    [metrics]
  );
  const yearOptions = useMemo(
    () => [
      { value: "", label: "All years" },
      ...Array.from(new Set(metrics.map((m) => m.year)))
        .sort((a, b) => b - a)
        .map((year) => ({ value: String(year), label: String(year) })),
    ],
    [metrics]
  );

  useEffect(() => {
    if (selectedBank && !metrics.some((m) => m.bank_id === selectedBank)) {
      setSelectedBank("");
    }
    if (selectedYear && !metrics.some((m) => String(m.year) === selectedYear)) {
      setSelectedYear("");
    }
  }, [metrics, selectedBank, selectedYear]);

  const filteredMetrics = useMemo(
    () =>
      metrics.filter((m) => {
        if (selectedBank && m.bank_id !== selectedBank) return false;
        if (selectedYear && String(m.year) !== selectedYear) return false;
        return true;
      }),
    [metrics, selectedBank, selectedYear]
  );

  const analysisMetrics = useMemo(() => {
    if (statKey !== "avgGrowth") return filteredMetrics;

    const normalizeGrowthPercent = (value: number) => (Math.abs(value) <= 1 ? value * 100 : value);
    const explicitGrowth = filteredMetrics
      .filter((m) => isGrowth(m.metric_name || ""))
      .map((m) => ({ ...m, value: normalizeGrowthPercent(m.value) }));
    if (explicitGrowth.length > 0) return explicitGrowth;

    const revenueByBank: Record<string, Array<{ year: number; quarter: number; revenue: number }>> = {};
    for (const m of filteredMetrics) {
      if (!isRevenue(m.metric_name || "")) continue;
      if (!revenueByBank[m.bank_id]) revenueByBank[m.bank_id] = [];
      revenueByBank[m.bank_id].push({ year: m.year, quarter: m.quarter, revenue: m.value });
    }

    const derivedGrowth: MetricRow[] = [];
    Object.entries(revenueByBank).forEach(([bankId, points]) => {
      const byPeriod = new Map<string, { year: number; quarter: number; revenue: number }>();
      points.forEach((p) => {
        const key = `${p.year}-Q${p.quarter}`;
        const existing = byPeriod.get(key);
        if (existing) existing.revenue += p.revenue;
        else byPeriod.set(key, { ...p });
      });

      const ordered = Array.from(byPeriod.values()).sort(
        (a, b) => a.year - b.year || a.quarter - b.quarter
      );
      for (let i = 1; i < ordered.length; i += 1) {
        const prev = ordered[i - 1].revenue;
        const curr = ordered[i].revenue;
        if (!Number.isFinite(prev) || !Number.isFinite(curr) || prev === 0) continue;
        derivedGrowth.push({
          id: 0,
          bank_id: bankId,
          year: ordered[i].year,
          quarter: ordered[i].quarter,
          metric_name: "derived_growth_pct",
          value: ((curr - prev) / Math.abs(prev)) * 100,
        });
      }
    });

    return derivedGrowth;
  }, [filteredMetrics, statKey]);

  const breakdown = useMemo(() => {
    if (statKey === "bankCount") {
      const banks = new Set(analysisMetrics.map((m) => m.bank_id));
      return Array.from(banks)
        .map((bank) => ({ bank, value: 1, percentage: 100 / banks.size, rank: 0 }))
        .map((item, i) => ({ ...item, rank: i + 1 }));
    }
    return metricsToBankBreakdown(analysisMetrics, metricMatcher);
  }, [analysisMetrics, metricMatcher, statKey]);

  const historicalTrends = useMemo(() => {
    if (statKey === "bankCount") {
      const byQuarter: Record<string, Set<string>> = {};
      analysisMetrics.forEach((m) => {
        const key = `${m.year}-Q${m.quarter}`;
        if (!byQuarter[key]) byQuarter[key] = new Set();
        byQuarter[key].add(m.bank_id);
      });
      return Object.entries(byQuarter)
        .map(([quarter, banks]) => {
          const [year, q] = quarter.split("-Q");
          return {
            quarter,
            year: Number(year),
            quarterNum: Number(q),
            count: banks.size,
          };
        })
        .sort((a, b) => a.year - b.year || a.quarterNum - b.quarterNum);
    }
    return metricsToHistoricalTrends(analysisMetrics, metricMatcher);
  }, [analysisMetrics, metricMatcher, statKey]);

  const comparison = useMemo(() => {
    if (statKey === "bankCount") {
      const quarters = Array.from(new Set(analysisMetrics.map((m) => `${m.year}-Q${m.quarter}`))).sort();
      if (quarters.length < 2) {
        return { current: 0, previous: 0, change: 0, changePercent: 0 };
      }
      const currentQ = quarters[quarters.length - 1];
      const prevQ = quarters[quarters.length - 2];
      const currentBanks = new Set(
        analysisMetrics.filter((m) => `${m.year}-Q${m.quarter}` === currentQ).map((m) => m.bank_id)
      );
      const prevBanks = new Set(
        analysisMetrics.filter((m) => `${m.year}-Q${m.quarter}` === prevQ).map((m) => m.bank_id)
      );
      const current = currentBanks.size;
      const previous = prevBanks.size;
      const change = current - previous;
      const changePercent = previous !== 0 ? (change / previous) * 100 : 0;
      return { current, previous, change, changePercent };
    }

    const quarters = Array.from(new Set(analysisMetrics.map((m) => `${m.year}-Q${m.quarter}`))).sort();
    if (quarters.length < 2) {
      return { current: 0, previous: 0, change: 0, changePercent: 0 };
    }
    const currentQ = quarters[quarters.length - 1];
    const prevQ = quarters[quarters.length - 2];

    return metricsToComparison(
      analysisMetrics,
      metricMatcher,
      (m) => `${m.year}-Q${m.quarter}` === currentQ,
      (m) => `${m.year}-Q${m.quarter}` === prevQ
    );
  }, [analysisMetrics, metricMatcher, statKey]);

  const chartData = useMemo(() => {
    if (statKey === "bankCount") {
      return historicalTrends.map((t: any) => ({
        quarter: t.quarter,
        value: t.count,
      }));
    }
    const trends = historicalTrends as any[];
    if (trends.length === 0) return [];
    const banks = Object.keys(trends[0]).filter((k) => k !== "quarter" && k !== "year" && k !== "quarterNum");
    return trends.map((t) => {
      const data: any = { quarter: t.quarter };
      banks.forEach((bank) => {
        data[bank] = t[bank] || 0;
      });
      return data;
    });
  }, [historicalTrends, statKey]);

  const handleExport = () => {
    const csv = [
      ["Bank", "Value", "Percentage", "Rank"],
      ...breakdown.map((b) => [b.bank, String(b.value), `${b.percentage.toFixed(2)}%`, String(b.rank)]),
    ]
      .map((row) => row.join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${statLabel.toLowerCase().replace(/\s+/g, "_")}_breakdown.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ExpandedCard title={`${statLabel} - Detailed Analysis`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        <div className={styles.expandedFilters}>
          <label className={styles.expandedFilterField}>
            <span>Bank</span>
            <div className={styles.expandedFilterSelect}>
              <CustomSelect
                value={selectedBank}
                onChange={setSelectedBank}
                options={bankOptions}
                placeholder="All banks"
                id={`expanded-bank-${statKey}`}
              />
            </div>
          </label>
          <label className={styles.expandedFilterField}>
            <span>Year</span>
            <div className={styles.expandedFilterSelect}>
              <CustomSelect
                value={selectedYear}
                onChange={setSelectedYear}
                options={yearOptions}
                placeholder="All years"
                id={`expanded-year-${statKey}`}
              />
            </div>
          </label>
        </div>

        {/* Comparison Panel */}
        <div className={styles.comparisonPanel}>
          <div className={styles.comparisonItem}>
            <div className={styles.comparisonLabel}>Current Period</div>
            <div className={styles.comparisonValue}>{formatValue(comparison.current)}</div>
          </div>
          <div className={styles.comparisonItem}>
            <div className={styles.comparisonLabel}>Previous Period</div>
            <div className={styles.comparisonValue}>{formatValue(comparison.previous)}</div>
          </div>
          <div className={styles.comparisonItem}>
            <div className={styles.comparisonLabel}>Change</div>
            <div className={styles.comparisonValue}>{formatValue(comparison.change)}</div>
            <div
              className={`${styles.comparisonChange} ${comparison.changePercent >= 0
                  ? styles.comparisonChangePositive
                  : styles.comparisonChangeNegative
                }`}
            >
              {comparison.changePercent >= 0 ? "+" : ""}
              {comparison.changePercent.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Historical Trend Chart */}
        {chartData.length > 0 && (
          <div>
            <h3 style={{ marginBottom: "1rem", fontSize: "1.125rem", fontWeight: 600 }}>
              Historical Trend
            </h3>
            <div style={{ height: "300px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 16, right: 24, left: 8, bottom: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="quarter"
                    tick={{ fontSize: 12, fill: "var(--color-text-muted)", fontWeight: 500 }}
                    stroke="var(--color-border)"
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
                    stroke="transparent"
                    tickFormatter={formatValue}
                  />
                  <Tooltip
                    formatter={(value: number) => formatValue(value)}
                    contentStyle={{
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                    }}
                  />
                  {statKey === "bankCount" ? (
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="var(--color-accent)"
                      strokeWidth={2.5}
                      dot={{ fill: "var(--color-accent)", r: 4 }}
                    />
                  ) : (
                    Object.keys(chartData[0] || {})
                      .filter((k) => k !== "quarter")
                      .slice(0, 8)
                      .map((bank, i) => {
                        const colors = [
                          "var(--color-accent)",
                          "#00c875",
                          "#ffcb00",
                          "#6366f1",
                          "#a855f7",
                          "#f97316",
                          "#ec4899",
                          "#14b8a6",
                        ];
                        return (
                          <Line
                            key={bank}
                            type="monotone"
                            dataKey={bank}
                            stroke={colors[i % colors.length]}
                            strokeWidth={2}
                            dot={false}
                            name={bank}
                          />
                        );
                      })
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Bank Breakdown Table */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Bank Breakdown</h3>
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
                  <th className={styles.num}>Value</th>
                  <th className={styles.num}>Percentage</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-muted)" }}>
                      No data available
                    </td>
                  </tr>
                ) : (
                  breakdown.map((item) => (
                    <tr key={item.bank}>
                      <td>{item.rank}</td>
                      <td>{item.bank}</td>
                      <td className={styles.num}>{formatValue(item.value)}</td>
                      <td className={styles.num}>{item.percentage.toFixed(2)}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ExpandedCard>
  );
}
