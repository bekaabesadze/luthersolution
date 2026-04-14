/**
 * dashboardCamelsKpis.ts
 * Computes CAMELS-derived KPI values for the dashboard.
 * Uses the same deriveCamelValues logic from ScoreboardPage
 * to produce per-bank key metrics for the latest available quarter.
 */

import type { MetricRow } from "../api/types";
import { deriveCamelValues } from "../pages/ScoreboardPage";

/** The key CAMELS metrics shown on the dashboard KPI cards. */
export interface CamelsKpiValues {
  roaa: number | null;
  roae: number | null;
  nim: number | null;
  costOfFunds: number | null;
  yieldOnLoans: number | null;
  loanToDeposit: number | null;
  loanGrowthRate: number | null;
  depositGrowthRate: number | null;
}

const NULL_KPIS: CamelsKpiValues = {
  roaa: null,
  roae: null,
  nim: null,
  costOfFunds: null,
  yieldOnLoans: null,
  loanToDeposit: null,
  loanGrowthRate: null,
  depositGrowthRate: null,
};

function toMetricMap(metrics: MetricRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  const latestId: Record<string, number> = {};
  metrics.forEach((m) => {
    const prevId = latestId[m.metric_name];
    if (prevId === undefined || m.id > prevId) {
      out[m.metric_name] = m.value;
      latestId[m.metric_name] = m.id;
    }
  });
  return out;
}

/** Compute CAMELS KPI values for a single bank's latest quarter. */
function computeBankKpis(bankMetrics: MetricRow[]): CamelsKpiValues {
  if (bankMetrics.length === 0) return { ...NULL_KPIS };

  // Find the latest quarter
  const quarters = new Map<string, { year: number; quarter: number }>();
  bankMetrics.forEach((m) => {
    const key = `${m.year}-${m.quarter}`;
    if (!quarters.has(key)) quarters.set(key, { year: m.year, quarter: m.quarter });
  });
  const sorted = Array.from(quarters.values()).sort(
    (a, b) => b.year - a.year || b.quarter - a.quarter
  );
  if (sorted.length === 0) return { ...NULL_KPIS };

  const latest = sorted[0];
  const prev = sorted.length > 1 ? sorted[1] : null;

  const currentRows = bankMetrics.filter(
    (m) => m.year === latest.year && m.quarter === latest.quarter
  );
  const previousRows = prev
    ? bankMetrics.filter((m) => m.year === prev.year && m.quarter === prev.quarter)
    : [];

  const currentMap = toMetricMap(currentRows);
  const previousMap = toMetricMap(previousRows);
  const derived = deriveCamelValues(currentMap, previousMap, latest.quarter);

  return {
    roaa: derived["Return on Assets"] ?? null,
    roae: derived["Return on Equity"] ?? null,
    nim: derived["Net Interest Margin"] ?? null,
    costOfFunds: derived["Cost of Funds"] ?? null,
    yieldOnLoans: derived["Yield on Loans"] ?? null,
    loanToDeposit: derived["Loan to Deposit Ratio"] ?? null,
    loanGrowthRate: derived["Loan Growth Rate"] ?? null,
    depositGrowthRate: derived["Deposit Growth Rate"] ?? null,
  };
}

/** Average non-null values across multiple KPI sets. */
function averageKpis(kpiSets: CamelsKpiValues[]): CamelsKpiValues {
  if (kpiSets.length === 0) return { ...NULL_KPIS };

  const keys: (keyof CamelsKpiValues)[] = [
    "roaa", "roae", "nim", "costOfFunds", "yieldOnLoans",
    "loanToDeposit", "loanGrowthRate", "depositGrowthRate",
  ];

  const result: CamelsKpiValues = { ...NULL_KPIS };
  for (const key of keys) {
    const values = kpiSets.map((s) => s[key]).filter((v): v is number => v !== null);
    result[key] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
  }
  return result;
}

export interface DashboardCamelsResult {
  /** KPIs for the selected bank (null if no bank selected). */
  subjectBank: CamelsKpiValues | null;
  /** Average KPIs across all peer banks (all banks minus the selected bank). */
  peerAverage: CamelsKpiValues;
  /** Average KPIs across all banks (when no bank is selected). */
  allBanksAverage: CamelsKpiValues;
  /** Number of peer banks used in the average. */
  peerCount: number;
  /** Total bank count. */
  bankCount: number;
}

/** Compute dashboard CAMELS KPIs from raw metrics. */
export function computeDashboardCamelsKpis(
  metrics: MetricRow[],
  selectedBankId?: string
): DashboardCamelsResult {
  // Group metrics by bank
  const byBank = new Map<string, MetricRow[]>();
  metrics.forEach((m) => {
    const list = byBank.get(m.bank_id) ?? [];
    list.push(m);
    byBank.set(m.bank_id, list);
  });

  const bankCount = byBank.size;

  // Compute KPIs per bank
  const allKpis = new Map<string, CamelsKpiValues>();
  byBank.forEach((bankMetrics, bankId) => {
    allKpis.set(bankId, computeBankKpis(bankMetrics));
  });

  const allKpiValues = Array.from(allKpis.values());
  const allBanksAverage = averageKpis(allKpiValues);

  let subjectBank: CamelsKpiValues | null = null;
  let peerAverage = allBanksAverage;
  let peerCount = bankCount;

  if (selectedBankId && allKpis.has(selectedBankId)) {
    subjectBank = allKpis.get(selectedBankId)!;
    const peerKpis = Array.from(allKpis.entries())
      .filter(([id]) => id !== selectedBankId)
      .map(([, kpis]) => kpis);
    peerAverage = averageKpis(peerKpis);
    peerCount = peerKpis.length;
  }

  return { subjectBank, peerAverage, allBanksAverage, peerCount, bankCount };
}
