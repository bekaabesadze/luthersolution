/**
 * SummaryStats.tsx
 * KPI cards for dashboard: total revenue, bank count, avg growth, deposits, loans, net profit.
 */

import type { SummaryStats as SummaryStatsType } from "../utils/metricsTransform";
import styles from "./SummaryStats.module.css";

export type SummaryStatKey =
  | "totalRevenue"
  | "bankCount"
  | "avgGrowth"
  | "totalDeposits"
  | "totalLoans"
  | "netProfit";

export interface SummaryStatsProps {
  stats: SummaryStatsType;
  onExpand?: (key: SummaryStatKey) => void;
}

const formatShort = (v: number) =>
  v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : v.toLocaleString();

export function SummaryStats({ stats, onExpand }: SummaryStatsProps) {
  const cards: Array<{ key: SummaryStatKey; label: string; value: string; sub: string }> = [
    { key: "totalRevenue", label: "Total revenue", value: formatShort(stats.totalRevenue), sub: stats.totalRevenue > 0 ? stats.totalRevenue.toLocaleString() : "—" },
    { key: "bankCount", label: "Banks", value: String(stats.bankCount), sub: "in selection" },
    { key: "avgGrowth", label: "Avg growth", value: stats.hasAvgGrowthData ? `${stats.avgGrowthPct.toFixed(1)}%` : "—", sub: "quarterly" },
    { key: "totalDeposits", label: "Total deposits", value: stats.totalDeposits > 0 ? formatShort(stats.totalDeposits) : "—", sub: stats.totalDeposits > 0 ? stats.totalDeposits.toLocaleString() : "No data" },
    { key: "totalLoans", label: "Total loans", value: stats.totalLoans > 0 ? formatShort(stats.totalLoans) : "—", sub: stats.totalLoans > 0 ? stats.totalLoans.toLocaleString() : "No data" },
    { key: "netProfit", label: "Net profit", value: stats.totalNetProfit !== 0 ? formatShort(stats.totalNetProfit) : "—", sub: stats.totalNetProfit !== 0 ? stats.totalNetProfit.toLocaleString() : "No data" },
  ];

  return (
    <div className={styles.wrapper}>
      {cards.map((card) => (
        <div key={card.key} className={styles.card}>
          {onExpand && (
            <button
              type="button"
              className={styles.expandBtn}
              onClick={() => onExpand(card.key)}
              aria-label={`Expand ${card.label} details`}
              title={`Expand ${card.label} details`}
            >
              <span className={styles.expandIcon}>⤢</span>
            </button>
          )}
          <div className={styles.label}>{card.label}</div>
          <div className={styles.value}>{card.value}</div>
          <div className={styles.sub}>{card.sub}</div>
        </div>
      ))}
    </div>
  );
}
