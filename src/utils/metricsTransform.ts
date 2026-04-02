/**
 * utils/metricsTransform.ts
 * Transforms GET /metrics response into chart and table shapes.
 * Backend returns flat rows: bank_id, year, quarter, metric_name, value.
 * We aggregate for bar chart (revenue by bank), line chart (growth by quarter), donuts, summary stats, and table.
 */

import type { MetricRow } from "../api/types";
import type { MetricsTableRow } from "../components/MetricsTable";

const isRevenue = (name: string) => {
  const n = name.toLowerCase();
  return n === "revenue" || n === "value" || n === "revenues" || n === "totalrevenue" || n === "operatingrevenue" || n === "netrevenue";
};
const isGrowth = (name: string) => {
  const n = name.toLowerCase().replace(/[_\s]+/g, " ").trim();
  return n === "growth" || n === "growth pct" || n === "growth %" || n.includes("growth");
};

const groupTopNWithOther = <T extends { value: number }>(
  items: T[],
  topN: number,
  makeOther: (otherValue: number) => T
): T[] => {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  if (sorted.length <= topN) return sorted;
  const top = sorted.slice(0, topN);
  const otherValue = sorted.slice(topN).reduce((sum, item) => sum + item.value, 0);
  if (!Number.isFinite(otherValue) || otherValue === 0) return top;
  return [...top, makeOther(otherValue)];
};

const metricBreakdownBucket = (name: string): string | null => {
  const n = name.toLowerCase().replace(/[_\s]+/g, " ").trim();
  if (!n || isGrowth(n)) return null;
  if (isRevenue(n)) return "Revenue";
  if (n.includes("profit") || n.includes("net income")) return "Net Profit";
  if (n.includes("deposit")) return "Deposits";
  if (n.includes("loan") && !n.includes("nonaccrual")) return "Loans";
  if (n.includes("asset")) return "Total Assets";
  if (n.includes("equity") || n.includes("capital")) return "Total Equity";
  if (n.includes("customer account") || n === "customer_accounts") return "Customer Accounts";
  return null;
};

/** Bar chart shape: { bank, revenue }[] */
export function metricsToRevenueByBank(metrics: MetricRow[]): { bank: string; revenue: number }[] {
  const byBank: Record<string, number> = {};
  for (const m of metrics) {
    if (isRevenue(m.metric_name || "")) {
      byBank[m.bank_id] = (byBank[m.bank_id] ?? 0) + m.value;
    }
  }
  return Object.entries(byBank).map(([bank, revenue]) => ({ bank, revenue }));
}

/** Donut shape: { name, value }[] for revenue share by bank (value = revenue; component can show %). */
export function metricsToRevenueShare(metrics: MetricRow[]): { name: string; value: number }[] {
  const byBank = metricsToRevenueByBank(metrics);
  return byBank.map(({ bank, revenue }) => ({ name: bank, value: revenue }));
}

/** Revenue share (grouped): top N banks + "Other". */
export function metricsToRevenueShareGrouped(
  metrics: MetricRow[],
  topN: number = 5
): { name: string; value: number }[] {
  const byBank = metricsToRevenueByBank(metrics).map(({ bank, revenue }) => ({ name: bank, value: revenue }));
  return groupTopNWithOther(byBank, topN, (otherValue) => ({ name: "Other", value: otherValue }));
}

/** Donut shape: { name, value }[] for metric type breakdown (Revenue, Net Profit, Deposits, Loans, etc.). */
export function metricsToMetricBreakdown(metrics: MetricRow[]): { name: string; value: number }[] {
  const byMetric: Record<string, number> = {};
  for (const m of metrics) {
    const bucket = metricBreakdownBucket(m.metric_name || "");
    if (!bucket) continue;
    byMetric[bucket] = (byMetric[bucket] ?? 0) + m.value;
  }
  return Object.entries(byMetric)
    .filter(([, v]) => Number.isFinite(v) && Math.abs(v) > 0)
    .map(([name, value]) => ({ name, value: Math.abs(value) }))
    .sort((a, b) => b.value - a.value);
}

/** Summary stats for KPI cards. */
export interface SummaryStats {
  totalRevenue: number;
  bankCount: number;
  avgGrowthPct: number;
  hasAvgGrowthData: boolean;
  totalDeposits: number;
  totalLoans: number;
  totalNetProfit: number;
  /** Average revenue per bank-period (total revenue ÷ distinct bank×quarter observations). */
  avgRevenue: number;
  /** Average net profit per bank-period (total net profit ÷ distinct bank×quarter observations with profit data). */
  avgProfit: number;
  /** Number of bank-period observations used for avgRevenue calculation. */
  revObservations: number;
  /** Number of bank-period observations used for avgProfit calculation. */
  profitObservations: number;
}

export function metricsToSummaryStats(metrics: MetricRow[]): SummaryStats {
  const revenueByBank: Record<string, number> = {};
  const growthValues: number[] = [];
  let totalDeposits = 0;
  let totalLoans = 0;
  let totalNetProfit = 0;
  const normalizeGrowthPercent = (value: number) => (Math.abs(value) <= 1 ? value * 100 : value);

  // Track distinct (bank, year, quarter) observations per metric type for averages.
  const revObsSet = new Set<string>();
  const profitObsSet = new Set<string>();

  for (const m of metrics) {
    const name = (m.metric_name || "").toLowerCase();
    const periodKey = `${m.bank_id}|${m.year}|${m.quarter}`;
    if (isRevenue(name)) {
      revenueByBank[m.bank_id] = (revenueByBank[m.bank_id] ?? 0) + m.value;
      revObsSet.add(periodKey);
    } else if (isGrowth(name)) {
      growthValues.push(normalizeGrowthPercent(m.value));
    } else if (name.includes("deposit")) {
      totalDeposits += m.value;
    } else if (name.includes("loan") && !name.includes("growth")) {
      totalLoans += m.value;
    } else if (name.includes("profit") || name.includes("net income")) {
      totalNetProfit += m.value;
      profitObsSet.add(periodKey);
    }
  }

  const totalRevenue = Object.values(revenueByBank).reduce((a, b) => a + b, 0);
  const bankCount = Object.keys(revenueByBank).length;
  const revObservations = revObsSet.size;
  const profitObservations = profitObsSet.size;
  const avgRevenue = revObservations > 0 ? totalRevenue / revObservations : 0;
  const avgProfit = profitObservations > 0 ? totalNetProfit / profitObservations : 0;

  const growthSeries = growthValues.length > 0 ? growthValues : metricsToQuarterlyGrowth(metrics).map((m) => m.growth);
  const hasAvgGrowthData = growthSeries.length > 0;
  const avgGrowthPct = hasAvgGrowthData
    ? growthSeries.reduce((sum, value) => sum + value, 0) / growthSeries.length
    : 0;

  return {
    totalRevenue,
    bankCount,
    avgGrowthPct,
    hasAvgGrowthData,
    totalDeposits,
    totalLoans,
    totalNetProfit,
    avgRevenue,
    avgProfit,
    revObservations,
    profitObservations,
  };
}

/** Line chart shape: { quarter, growth }[] */
export function metricsToQuarterlyGrowth(metrics: MetricRow[]): { quarter: string; growth: number }[] {
  const byQuarter: Record<string, number[]> = {};
  for (const m of metrics) {
    if (isGrowth(m.metric_name || "")) {
      const key = `${m.year}-Q${m.quarter}`;
      if (!byQuarter[key]) byQuarter[key] = [];
      // Normalize to percent values for chart readability.
      byQuarter[key].push(Math.abs(m.value) <= 1 ? m.value * 100 : m.value);
    }
  }
  const growthSeries = Object.entries(byQuarter)
    .map(([quarter, values]) => ({
      quarter,
      growth: values.reduce((a, b) => a + b, 0) / values.length,
    }))
    .sort((a, b) => a.quarter.localeCompare(b.quarter));

  if (growthSeries.length > 0) {
    return growthSeries;
  }

  // Fallback: derive quarter-over-quarter growth from total revenue when explicit growth
  // metrics are not present in the selected data.
  const revenueByQuarter: Record<string, number> = {};
  for (const m of metrics) {
    if (!isRevenue(m.metric_name || "")) continue;
    const key = `${m.year}-Q${m.quarter}`;
    revenueByQuarter[key] = (revenueByQuarter[key] ?? 0) + m.value;
  }

  const orderedRevenue = Object.entries(revenueByQuarter)
    .map(([quarter, revenue]) => ({ quarter, revenue }))
    .sort((a, b) => a.quarter.localeCompare(b.quarter));

  const derivedGrowth: { quarter: string; growth: number }[] = [];
  for (let i = 1; i < orderedRevenue.length; i += 1) {
    const prev = orderedRevenue[i - 1].revenue;
    const curr = orderedRevenue[i].revenue;
    if (!Number.isFinite(prev) || !Number.isFinite(curr) || prev === 0) continue;
    derivedGrowth.push({
      quarter: orderedRevenue[i].quarter,
      growth: ((curr - prev) / Math.abs(prev)) * 100,
    });
  }

  return derivedGrowth;
}

/** Table rows: one per (bank, year, quarter) with revenue and growthPct from metric_name. */
export function metricsToTableRows(metrics: MetricRow[]): MetricsTableRow[] {
  const normalizeGrowthPercent = (value: number) => (Math.abs(value) <= 1 ? value * 100 : value);
  const key = (b: string, y: number, q: number) => `${b}-${y}-${q}`;
  type RowAccumulator = MetricsTableRow & {
    growthSum: number;
    growthCount: number;
    hasExplicitGrowth: boolean;
  };
  const rowMap = new Map<string, RowAccumulator>();

  for (const m of metrics) {
    const k = key(m.bank_id, m.year, m.quarter);
    let r = rowMap.get(k);
    if (!r) {
      r = {
        bankName: m.bank_id,
        year: m.year,
        quarter: m.quarter,
        revenue: 0,
        growthPct: 0,
        growthSum: 0,
        growthCount: 0,
        hasExplicitGrowth: false,
      };
      rowMap.set(k, r);
    }
    const name = (m.metric_name || "").toLowerCase();
    if (isRevenue(name)) r.revenue += m.value;
    else if (isGrowth(name)) {
      r.growthSum += normalizeGrowthPercent(m.value);
      r.growthCount += 1;
      r.hasExplicitGrowth = true;
    }
  }

  const rows = Array.from(rowMap.values());
  const rowsByBank = new Map<string, RowAccumulator[]>();

  rows.forEach((row) => {
    const list = rowsByBank.get(row.bankName) ?? [];
    list.push(row);
    rowsByBank.set(row.bankName, list);
  });

  rowsByBank.forEach((bankRows) => {
    bankRows.sort((a, b) => a.year - b.year || a.quarter - b.quarter);
    for (let i = 0; i < bankRows.length; i += 1) {
      const row = bankRows[i];
      if (row.hasExplicitGrowth) {
        row.growthPct = row.growthCount > 0 ? row.growthSum / row.growthCount : 0;
        continue;
      }

      if (i === 0) continue;
      const prevRevenue = bankRows[i - 1].revenue;
      if (!Number.isFinite(prevRevenue) || prevRevenue === 0) continue;
      row.growthPct = ((row.revenue - prevRevenue) / Math.abs(prevRevenue)) * 100;
    }
  });

  return rows
    .map(({ growthSum: _growthSum, growthCount: _growthCount, hasExplicitGrowth: _hasExplicitGrowth, ...row }) => row)
    .sort((a, b) => b.year - a.year || b.quarter - a.quarter || a.bankName.localeCompare(b.bankName));
}

/** Bank breakdown for a specific metric type */
export interface BankBreakdown {
  bank: string;
  value: number;
  percentage: number;
  rank: number;
}

export function metricsToBankBreakdown(
  metrics: MetricRow[],
  metricMatcher: (name: string) => boolean
): BankBreakdown[] {
  const byBank: Record<string, number> = {};
  for (const m of metrics) {
    if (metricMatcher(m.metric_name || "")) {
      byBank[m.bank_id] = (byBank[m.bank_id] ?? 0) + m.value;
    }
  }
  const total = Object.values(byBank).reduce((a, b) => a + b, 0);
  const entries = Object.entries(byBank)
    .map(([bank, value]) => ({
      bank,
      value,
      percentage: total > 0 ? (value / total) * 100 : 0,
      rank: 0,
    }))
    .sort((a, b) => b.value - a.value);
  entries.forEach((entry, i) => {
    entry.rank = i + 1;
  });
  return entries;
}

/** Historical trend data per bank */
export interface HistoricalTrend {
  quarter: string;
  year: number;
  quarterNum: number;
  [bank: string]: string | number;
}

export function metricsToHistoricalTrends(
  metrics: MetricRow[],
  metricMatcher: (name: string) => boolean
): HistoricalTrend[] {
  const byQuarter: Record<string, Record<string, number>> = {};
  const banks = new Set<string>();

  for (const m of metrics) {
    if (metricMatcher(m.metric_name || "")) {
      const key = `${m.year}-Q${m.quarter}`;
      if (!byQuarter[key]) byQuarter[key] = {};
      byQuarter[key][m.bank_id] = (byQuarter[key][m.bank_id] ?? 0) + m.value;
      banks.add(m.bank_id);
    }
  }

  return Object.entries(byQuarter)
    .map(([quarter, bankValues]) => {
      const [year, q] = quarter.split("-Q");
      const trend: HistoricalTrend = {
        quarter,
        year: Number(year),
        quarterNum: Number(q),
      };
      banks.forEach((bank) => {
        trend[bank] = bankValues[bank] || 0;
      });
      return trend;
    })
    .sort((a, b) => a.year - b.year || a.quarterNum - b.quarterNum);
}

/** Market share over time */
export interface MarketShareData {
  quarter: string;
  year: number;
  quarterNum: number;
  shares: { bank: string; share: number; value: number }[];
}

export function metricsToMarketShare(
  metrics: MetricRow[],
  metricMatcher: (name: string) => boolean
): MarketShareData[] {
  const trends = metricsToHistoricalTrends(metrics, metricMatcher);
  return trends.map((trend) => {
    const banks = Object.keys(trend).filter((k) => k !== "quarter" && k !== "year" && k !== "quarterNum");
    const total = banks.reduce((sum, bank) => sum + (trend[bank] as number), 0);
    const shares = banks
      .map((bank) => ({
        bank,
        value: trend[bank] as number,
        share: total > 0 ? ((trend[bank] as number) / total) * 100 : 0,
      }))
      .sort((a, b) => b.share - a.share);
    return {
      quarter: trend.quarter,
      year: trend.year,
      quarterNum: trend.quarterNum,
      shares,
    };
  });
}

/** Market share (grouped): top N banks (by latest period value) + "Other" per quarter. */
export function metricsToMarketShareGrouped(
  metrics: MetricRow[],
  metricMatcher: (name: string) => boolean,
  topN: number = 5
): MarketShareData[] {
  const series = metricsToMarketShare(metrics, metricMatcher);
  if (series.length === 0) return [];

  const latest = series[series.length - 1];
  const topBanks = latest.shares
    .slice()
    .sort((a, b) => b.value - a.value)
    .slice(0, topN)
    .map((s) => s.bank);
  const topSet = new Set(topBanks);

  return series.map((point) => {
    const totalValue = point.shares.reduce((sum, s) => sum + s.value, 0);
    const topShares = point.shares
      .filter((s) => topSet.has(s.bank))
      .map((s) => ({
        bank: s.bank,
        value: s.value,
        share: totalValue > 0 ? (s.value / totalValue) * 100 : 0,
      }))
      .sort((a, b) => b.share - a.share);

    const otherValue = point.shares.filter((s) => !topSet.has(s.bank)).reduce((sum, s) => sum + s.value, 0);
    if (otherValue > 0) {
      topShares.push({
        bank: "Other",
        value: otherValue,
        share: totalValue > 0 ? (otherValue / totalValue) * 100 : 0,
      });
    }

    return {
      quarter: point.quarter,
      year: point.year,
      quarterNum: point.quarterNum,
      shares: topShares,
    };
  });
}

/** Growth rankings */
export interface GrowthRanking {
  bank: string;
  avgGrowth: number;
  latestGrowth: number;
  volatility: number;
  rank: number;
  quarters: { quarter: string; growth: number }[];
}

export function metricsToGrowthRankings(metrics: MetricRow[]): GrowthRanking[] {
  const byBank: Record<string, number[]> = {};
  const byBankQuarter: Record<string, { quarter: string; growth: number }[]> = {};

  for (const m of metrics) {
    if (isGrowth(m.metric_name || "")) {
      const quarter = `${m.year}-Q${m.quarter}`;
      if (!byBank[m.bank_id]) {
        byBank[m.bank_id] = [];
        byBankQuarter[m.bank_id] = [];
      }
      byBank[m.bank_id].push(m.value);
      byBankQuarter[m.bank_id].push({ quarter, growth: m.value });
    }
  }

  const rankings: GrowthRanking[] = Object.entries(byBank).map(([bank, values]) => {
    const avgGrowth = values.reduce((a, b) => a + b, 0) / values.length;
    const latestGrowth = values[values.length - 1] || 0;
    const mean = avgGrowth;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const volatility = Math.sqrt(variance);
    return {
      bank,
      avgGrowth,
      latestGrowth,
      volatility,
      rank: 0,
      quarters: byBankQuarter[bank] || [],
    };
  });

  rankings.sort((a, b) => b.avgGrowth - a.avgGrowth);
  rankings.forEach((r, i) => {
    r.rank = i + 1;
  });

  return rankings;
}

/** Period comparison */
export interface PeriodComparison {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
}

export function metricsToComparison(
  metrics: MetricRow[],
  metricMatcher: (name: string) => boolean,
  getCurrentPeriod: (m: MetricRow) => boolean,
  getPreviousPeriod: (m: MetricRow) => boolean
): PeriodComparison {
  let current = 0;
  let previous = 0;

  for (const m of metrics) {
    if (metricMatcher(m.metric_name || "")) {
      if (getCurrentPeriod(m)) {
        current += m.value;
      } else if (getPreviousPeriod(m)) {
        previous += m.value;
      }
    }
  }

  const change = current - previous;
  const changePercent = previous !== 0 ? (change / previous) * 100 : 0;

  return { current, previous, change, changePercent };
}
