/**
 * ScoreboardPage.tsx (CAMEL page)
 * Replicates the boss's Excel CAMELS table: two-column layout with
 * CAMELS categories (vertical text, colored) and Strategic Metrics/Indicators.
 * When a bank and quarter are selected, displays values from uploaded CAMEL Excel data.
 * Supports multi-bank comparison with delta display.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getBanks, getMetrics } from "../api/client";
import type { MetricRow } from "../api/types";
import { CustomSelect } from "../components/CustomSelect";
import styles from "./ScoreboardPage.module.css";

/** One row: category + metric label. Category is shown once per group with vertical text. */
interface CamelRow {
  category: string;
  categoryKey: string;
  metric: string;
}

/** One value column: bank + period (stacked Excel-style). */
interface CamelSlice {
  id: string;
  bankId: string;
  year: number;
  quarter: number;
}

const CAMEL_ROWS: CamelRow[] = [
  { category: "Capital", categoryKey: "capital", metric: "Equity to Assets" },
  { category: "Capital", categoryKey: "capital", metric: "Tier 1 Leverage Ratio" },
  { category: "Capital", categoryKey: "capital", metric: "Legal Lending Limit" },
  { category: "Asset Quality", categoryKey: "assetQuality", metric: "90+ PD and Non-Accrual / Total Loans" },
  { category: "Asset Quality", categoryKey: "assetQuality", metric: "Past Due 30-89 / Total Loans" },
  { category: "Asset Quality", categoryKey: "assetQuality", metric: "Non Performing Assets to Equity + Reserves" },
  { category: "Asset Quality", categoryKey: "assetQuality", metric: "ACL / Total Loans" },
  { category: "Management", categoryKey: "management", metric: "Percentage on Budget" },
  { category: "Management", categoryKey: "management", metric: "Number of Employees" },
  { category: "Management", categoryKey: "management", metric: "Efficiency Ratio" },
  { category: "Management", categoryKey: "management", metric: "Loan Growth Rate" },
  { category: "Management", categoryKey: "management", metric: "Deposit Growth Rate" },
  { category: "Management", categoryKey: "management", metric: "Non-Interest Income" },
  { category: "Earnings", categoryKey: "earnings", metric: "Cost of Funds" },
  { category: "Earnings", categoryKey: "earnings", metric: "Yield on Loans" },
  { category: "Earnings", categoryKey: "earnings", metric: "TE Yield on Securities" },
  { category: "Earnings", categoryKey: "earnings", metric: "Net Interest Margin" },
  { category: "Earnings", categoryKey: "earnings", metric: "Return on Assets" },
  { category: "Earnings", categoryKey: "earnings", metric: "Return on Equity" },
  { category: "Liquidity", categoryKey: "liquidity", metric: "Loan to Deposit Ratio" },
  { category: "Liquidity", categoryKey: "liquidity", metric: "Brokered Deposits to Total Deposits" },
  { category: "Liquidity", categoryKey: "liquidity", metric: "Short Term Non-Core Funding" },
  { category: "Liquidity", categoryKey: "liquidity", metric: "Net Loans to Average Assets" },
  { category: "Liquidity", categoryKey: "liquidity", metric: "Core Deposits to Average Assets" },
  { category: "Liquidity", categoryKey: "liquidity", metric: "Pledged Assets to Total Assets" },
  { category: "Liquidity", categoryKey: "liquidity", metric: "FHLB Open Borrowing Capacity" },
  { category: "Sensitivity", categoryKey: "sensitivity", metric: "Earnings at Risk (12m) -100" },
  { category: "Sensitivity", categoryKey: "sensitivity", metric: "Earnings at Risk (12m) +100" },
  { category: "Sensitivity", categoryKey: "sensitivity", metric: "Economic Value of Equity Ratio -100" },
  { category: "Sensitivity", categoryKey: "sensitivity", metric: "Economic Value of Equity Ratio +100" },
  { category: "Sensitivity", categoryKey: "sensitivity", metric: "Non Parallel EAR (12m) Most Likely" },
  { category: "Sensitivity", categoryKey: "sensitivity", metric: "Non Parallel EVE Ratio Most Likely" },
];

/** Format a CAMEL value for display (percent, integer, or plain number). */
function formatCamelValue(metric: string, value: number): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  if (metric === "Number of Employees") return Math.round(value).toLocaleString();
  if (metric === "Legal Lending Limit" || metric === "FHLB Open Borrowing Capacity") {
    return value >= 1e6 ? (value / 1e6).toFixed(2) + "M" : value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  // Ratios/rates typically in [0,1] or small: show as %
  if (Math.abs(value) <= 2) return (value * 100).toFixed(2) + "%";
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function formatAverageBankLabel(bankId: string): string {
  const trimmed = bankId.replace(/\s+Bank$/i, "").trim();
  return trimmed || bankId;
}

function formatSlicePeriod(year: number, quarter: number): string {
  return `${year} Q${quarter}`;
}

function formatCompactSliceHeader(bankId: string): string {
  const shortened = formatAverageBankLabel(bankId).trim();
  const [firstWord] = shortened.split(/\s+/);
  return firstWord || shortened || bankId;
}

function toMetricMap(metrics: MetricRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  const latestId: Record<string, number> = {};
  metrics.forEach((m) => {
    const prevId = latestId[m.metric_name];
    // Keep the newest uploaded value for each metric (highest row id).
    if (prevId === undefined || m.id > prevId) {
      out[m.metric_name] = m.value;
      latestId[m.metric_name] = m.id;
    }
  });
  return out;
}

/** Derive a sorted quarters list from a metrics array. */
function deriveQuarters(metrics: MetricRow[]): { year: number; quarter: number }[] {
  const qSet = new Map<string, { year: number; quarter: number }>();
  metrics.forEach((m) => {
    const key = `${m.year}-${m.quarter}`;
    if (!qSet.has(key)) qSet.set(key, { year: m.year, quarter: m.quarter });
  });
  return Array.from(qSet.values()).sort((a, b) => b.year - a.year || b.quarter - a.quarter);
}

// Metrics that we do not want to display even if a numeric value is present.
// Keep empty for now so all computed/loaded metrics are shown.
const UNVERIFIED_METRICS = new Set<string>([]);

/**
 * Color palette for multi-bank comparison.
 * Index 0 = default (primary) bank — no tint.
 * Indices 1+ = comparison banks — colored tint.
 */
const BANK_COLORS = [
  { accent: "var(--color-primary)", bg: "transparent", headerBg: "transparent" },
  { accent: "#10b981", bg: "rgba(16,185,129,0.05)", headerBg: "rgba(16,185,129,0.15)" },
  { accent: "#f59e0b", bg: "rgba(245,158,11,0.05)", headerBg: "rgba(245,158,11,0.15)" },
  { accent: "#8b5cf6", bg: "rgba(139,92,246,0.05)", headerBg: "rgba(139,92,246,0.15)" },
  { accent: "#ef4444", bg: "rgba(239,68,68,0.05)", headerBg: "rgba(239,68,68,0.15)" },
  { accent: "#06b6d4", bg: "rgba(6,182,212,0.05)", headerBg: "rgba(6,182,212,0.15)" },
] as const;

export function deriveCamelValues(
  current: Record<string, number>,
  previous: Record<string, number>,
  quarter: number | null
): Record<string, number> {
  const derived: Record<string, number> = {};
  const taxRate = 0.21;
  const teGrossUp = 1 / (1 - taxRate) - 1;
  const isSubS = String(current.subchapter_s) === "true" || current.subchapter_s === 1;

  const quarterFlow = (currentYtd?: number, previousYtd?: number): number | null => {
    if (currentYtd == null) return null;
    if (quarter == null || quarter <= 1 || previousYtd == null) return currentYtd;
    return currentYtd - previousYtd;
  };

  const annualizedFlow = (currentYtd?: number, previousYtd?: number): number | null => {
    const flow = quarterFlow(currentYtd, previousYtd);
    if (flow == null) return null;
    // FFIEC RI values are YTD: use one-quarter annualized when prior quarter exists.
    if (quarter == null) return flow;
    if (quarter === 1) return flow * 4;
    if (previousYtd == null) return flow;
    return flow * 4;
  };

  const totalAssets = current.total_assets;
  const totalEquity = current.total_equity;
  const loans = current.loans_outstanding;
  const deposits = current.deposits;
  const acl = current.allowance_for_credit_losses;

  if (totalAssets != null && totalAssets !== 0 && totalEquity != null) {
    // Capital adequacy: equity relative to total assets.
    derived["Equity to Assets"] = totalEquity / totalAssets;
    // Legal lending limit ~ 15% of capital plus ACL per internal policy.
    derived["Legal Lending Limit"] = (totalEquity + (acl ?? 0)) * 0.15;
  }
  if (current.tier1_leverage_ratio != null) {
    derived["Tier 1 Leverage Ratio"] = current.tier1_leverage_ratio;
  } else if (totalAssets != null && totalAssets !== 0 && totalEquity != null) {
    derived["Tier 1 Leverage Ratio"] = totalEquity / totalAssets;
  }

  const pastDue30_89 = current.past_due_30_89_amount ?? 0;
  const pastDue90Plus = current.past_due_90_plus_amount ?? 0;
  const nonAccrual = current.nonaccrual_loans_amount ?? 0;
  const nonPerforming = pastDue90Plus + nonAccrual;

  if (loans != null && loans !== 0) {
    derived["Past Due 30-89 / Total Loans"] = pastDue30_89 / loans;
    derived["90+ PD and Non-Accrual / Total Loans"] = nonPerforming / loans;
  }
  if (totalEquity != null) {
    const denom = totalEquity + (acl ?? 0);
    if (denom !== 0) {
      derived["Non Performing Assets to Equity + Reserves"] = nonPerforming / denom;
    }
  }
  if (acl != null && loans != null && loans !== 0) derived["ACL / Total Loans"] = acl / loans;
  if (loans != null && deposits != null && deposits !== 0) {
    const netLoans = loans - (acl ?? 0);
    derived["Loan to Deposit Ratio"] = netLoans / deposits;
  }
  if (current.brokered_deposits_amount != null && deposits != null && deposits !== 0) {
    derived["Brokered Deposits to Total Deposits"] =
      current.brokered_deposits_amount / deposits;
  }
  if (current.num_employees != null) derived["Number of Employees"] = current.num_employees;

  // Efficiency Ratio: UBPR = noninterest expense / (net interest income + noninterest income)
  const nonInterestExpense = annualizedFlow(
    current.non_interest_expense_amount,
    previous.non_interest_expense_amount
  );
  const nonInterestIncome = annualizedFlow(
    current.non_interest_income_amount,
    previous.non_interest_income_amount
  );
  const netInterestIncome = annualizedFlow(
    current.net_interest_income,
    previous.net_interest_income
  );
  const revenueLegacy = current.revenue;
  const totalRevenue =
    (netInterestIncome ?? revenueLegacy ?? 0) + (nonInterestIncome ?? 0);
  if (
    nonInterestExpense != null &&
    totalRevenue > 0
  ) {
    derived["Efficiency Ratio"] = nonInterestExpense / totalRevenue;
  }
  if (nonInterestIncome != null) {
    const nonInterestBaseAssets = current.average_total_assets ?? totalAssets;
    derived["Non-Interest Income"] = nonInterestBaseAssets
      ? nonInterestIncome / nonInterestBaseAssets
      : nonInterestIncome;
  }
  const netProfitAnnualized = annualizedFlow(current.net_profit, previous.net_profit);
  const adjustedNetProfit = (isSubS && netProfitAnnualized != null)
    ? netProfitAnnualized * (1 - taxRate)
    : netProfitAnnualized;

  const teAdjustAnnualized =
    ((annualizedFlow(current.tax_exempt_loans_income, previous.tax_exempt_loans_income) ?? 0) +
      (annualizedFlow(current.tax_exempt_securities_income, previous.tax_exempt_securities_income) ?? 0)) *
    teGrossUp;
  const avgAssetsForReturns = current.average_total_assets ?? totalAssets;

  if (adjustedNetProfit != null && avgAssetsForReturns != null && avgAssetsForReturns !== 0) {
    derived["Return on Assets"] = (adjustedNetProfit + teAdjustAnnualized) / avgAssetsForReturns;
  }
  if (adjustedNetProfit != null && totalEquity != null && totalEquity !== 0) {
    derived["Return on Equity"] = (adjustedNetProfit + teAdjustAnnualized) / totalEquity;
  }

  const prevLoans = previous.loans_outstanding;
  const prevDeposits = previous.deposits;
  if (loans != null && prevLoans != null && prevLoans !== 0) {
    derived["Loan Growth Rate"] = (loans - prevLoans) / prevLoans;
  }
  if (deposits != null && prevDeposits != null && prevDeposits !== 0) {
    derived["Deposit Growth Rate"] = (deposits - prevDeposits) / prevDeposits;
  }

  const interestExpense = annualizedFlow(
    current.interest_expense_total_amount,
    previous.interest_expense_total_amount
  );
  const interestIncomeLoans = annualizedFlow(
    current.interest_income_loans_amount,
    previous.interest_income_loans_amount
  );
  const avgLoans = current.average_loans;
  const avgTotalAssets = current.average_total_assets;

  const avgEarningAssets =
    (current.average_balances_due_from_banks ?? 0) +
    (current.average_securities_agency ?? 0) +
    (current.average_securities_mbs ?? 0) +
    (current.average_securities_other ?? 0) +
    (current.average_fed_funds_sold ?? 0) +
    (avgLoans ?? 0) +
    (current.average_lease_financing ?? 0);

  const avgAssetsOrEarning = avgEarningAssets > 0 ? avgEarningAssets : avgTotalAssets;

  // Cost of Funds: Interest Expense / Average Earning Assets (per boss's dashboard logic ~2.05%)
  if (interestExpense != null && avgAssetsOrEarning != null && avgAssetsOrEarning !== 0) {
    derived["Cost of Funds"] = interestExpense / avgAssetsOrEarning;
  }

  if (interestIncomeLoans != null && avgLoans != null && avgLoans !== 0) {
    derived["Yield on Loans"] = interestIncomeLoans / avgLoans;
  }

  const interestSecAgency = annualizedFlow(
    current.interest_income_securities_agency,
    previous.interest_income_securities_agency
  ) ?? 0;
  const interestSecMbs = annualizedFlow(
    current.interest_income_securities_mbs,
    previous.interest_income_securities_mbs
  ) ?? 0;
  const interestSecOther = annualizedFlow(
    current.interest_income_securities_other,
    previous.interest_income_securities_other
  ) ?? 0;
  const interestOnSecurities = interestSecAgency + interestSecMbs + interestSecOther;

  const avgSecurities =
    (current.average_securities_agency ?? 0) +
    (current.average_securities_mbs ?? 0) +
    (current.average_securities_other ?? 0);

  const taxExemptSecIncome = annualizedFlow(
    current.tax_exempt_securities_income,
    previous.tax_exempt_securities_income
  ) ?? 0;

  if (interestOnSecurities > 0 && avgSecurities > 0) {
    const teAdjustment = taxExemptSecIncome * teGrossUp;
    derived["TE Yield on Securities"] = (interestOnSecurities + teAdjustment) / avgSecurities;
  }

  const nii = annualizedFlow(current.net_interest_income, previous.net_interest_income) ?? current.revenue;
  const taxExemptLoans = annualizedFlow(
    current.tax_exempt_loans_income,
    previous.tax_exempt_loans_income
  ) ?? 0;

  const niiTe = (nii ?? 0) + taxExemptLoans * teGrossUp + taxExemptSecIncome * teGrossUp;

  if (niiTe > 0 && avgAssetsOrEarning != null && avgAssetsOrEarning !== 0) {
    derived["Net Interest Margin"] = niiTe / avgAssetsOrEarning;
  }

  // --- Liquidity: Short Term Non-Core, Net Loans to Avg Assets, Core Deposits to Avg Assets, Pledged to Total ---
  const fedFundsRepos = current.fed_funds_purchased_repos ?? 0;
  const shortTermLargeTime = current.time_deposits_over_250k_remaining_1y ?? 0;
  const reciprocalDeposits = current.reciprocal_deposits_amount ?? 0;
  const sweepNonBrokered = current.sweep_nonbrokered_amount ?? 0;
  const shortTermNonCoreNumerator =
    shortTermLargeTime + reciprocalDeposits + sweepNonBrokered + fedFundsRepos;
  if (totalAssets != null && totalAssets !== 0 && shortTermNonCoreNumerator > 0) {
    derived["Short Term Non-Core Funding"] = shortTermNonCoreNumerator / totalAssets;
  }

  if (avgTotalAssets != null && avgTotalAssets !== 0 && (avgLoans != null || loans != null)) {
    const baseLoans = avgLoans ?? loans ?? 0;
    const netLoans = baseLoans - (acl ?? 0);
    derived["Net Loans to Average Assets"] = netLoans / avgTotalAssets;
  }

  if (totalAssets != null && totalAssets !== 0 && deposits != null) {
    const nonCoreLargeTime = current.time_deposits_over_250k ?? 0;
    const brokered = current.brokered_deposits_amount ?? 0;
    const coreDeposits = deposits - nonCoreLargeTime - brokered;
    derived["Core Deposits to Average Assets"] = coreDeposits / totalAssets;
  }

  const pledgedLoans = current.pledged_loans_leases;
  const pledgedSecurities = current.pledged_securities ?? 0;
  if (pledgedLoans != null && totalAssets != null && totalAssets !== 0) {
    derived["Pledged Assets to Total Assets"] = (pledgedLoans + pledgedSecurities) / totalAssets;
  }

  // --- Sensitivity: Earnings at Risk (EaR) and Economic Value of Equity (EVE) approximations ---
  //
  // We approximate interest-rate sensitivity using call-report averages:
  // - GAP ≈ average earning assets − average interest-bearing liabilities
  // - EaR (±100 bp) ≈ ΔNII / NII, where ΔNII ≈ GAP × Δr over 12 months
  // - EVE Ratio uses simple duration assumptions on assets vs liabilities.

  const avgInterestBearingLiabs =
    (current.average_interest_bearing_transaction ?? 0) +
    (current.average_savings_deposits ?? 0) +
    (current.average_time_deposits_250k_or_less ?? 0) +
    (current.average_time_deposits_over_250k ?? 0);

  const gap = (avgAssetsOrEarning ?? 0) - avgInterestBearingLiabs;
  const baselineNii =
    (niiTe !== 0 ? niiTe : 0) ||
    (nii ?? 0) ||
    (netInterestIncome ?? 0) ||
    0;

  if (baselineNii !== 0 && gap !== 0) {
    const deltaR100 = 0.01; // 100 bp parallel shock
    const deltaNiiPlus = gap * deltaR100;
    const deltaNiiMinus = gap * -deltaR100;

    // Report EaR as percentage change in NII.
    derived["Earnings at Risk (12m) +100"] = deltaNiiPlus / baselineNii;
    derived["Earnings at Risk (12m) -100"] = deltaNiiMinus / baselineNii;

    const deltaRMost = 0.005; // simple "most likely" non-parallel equivalent (50 bp)
    const deltaNiiMost = gap * deltaRMost;
    derived["Non Parallel EAR (12m) Most Likely"] = deltaNiiMost / baselineNii;
  }

  const eveBaseAssets = totalAssets ?? avgAssetsOrEarning ?? 0;
  if (eveBaseAssets !== 0 && totalAssets != null) {
    const depositsPlusBorrowed =
      (deposits ?? 0) + (current.other_borrowed_money ?? 0);

    // Simple duration assumptions (in years) to approximate PV sensitivity.
    const durationAssets = 3;
    const durationLiabs = 2;

    const deltaR100 = 0.01;
    const deltaPVAssets100 = -durationAssets * deltaR100 * totalAssets;
    const deltaPVLiabs100 = -durationLiabs * deltaR100 * depositsPlusBorrowed;
    const deltaEve100 = deltaPVAssets100 - deltaPVLiabs100;

    // EVE Ratio ±100 as change in economic value divided by present value of assets.
    derived["Economic Value of Equity Ratio +100"] = deltaEve100 / eveBaseAssets;
    derived["Economic Value of Equity Ratio -100"] = -deltaEve100 / eveBaseAssets;

    const deltaRMost = 0.005;
    const deltaPVAssetsMost = -durationAssets * deltaRMost * totalAssets;
    const deltaPVLiabsMost = -durationLiabs * deltaRMost * depositsPlusBorrowed;
    const deltaEveMost = deltaPVAssetsMost - deltaPVLiabsMost;
    derived["Non Parallel EVE Ratio Most Likely"] = deltaEveMost / eveBaseAssets;
  }

  return derived;
}

export function ScoreboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBank, setSelectedBank] = useState<string>("");
  const [banks, setBanks] = useState<string[]>([]);
  const [quarters, setQuarters] = useState<{ year: number; quarter: number }[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState<number | null>(null);
  /** Metrics per bank (for selector and for each slice). */
  const [metricsByBank, setMetricsByBank] = useState<Record<string, MetricRow[]>>({});
  /** Stacked value columns: each slice = one bank + period. */
  const [slices, setSlices] = useState<CamelSlice[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const copyToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Comparison state ──────────────────────────────────────────────────────
  /** The bank used as the baseline for Δ calculations. Auto-set to primary bank. */
  const [defaultBankId, setDefaultBankId] = useState<string>("");
  /** Whether to show Δ vs default bank in comparison columns. */
  const [showDelta, setShowDelta] = useState(false);
  /** Controls visibility of the "add comparison bank" panel. */
  const [showCompPanel, setShowCompPanel] = useState(false);
  /** Currently selected bank in the comparison selector. */
  const [compBank, setCompBank] = useState<string>("");
  /** Selected year in the comparison period selector. */
  const [compYear, setCompYear] = useState<number | null>(null);
  /** Selected quarter in the comparison period selector. */
  const [compQuarter, setCompQuarter] = useState<number | null>(null);
  /** Available periods for the comparison bank. */
  const [compQuartersList, setCompQuartersList] = useState<{ year: number; quarter: number }[]>([]);
  /** Loading state while fetching comparison bank metrics. */
  const [compLoading, setCompLoading] = useState(false);
  // ─────────────────────────────────────────────────────────────────────────

  const handleCopy = useCallback(async (text: string) => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      if (copyToastTimeoutRef.current) clearTimeout(copyToastTimeoutRef.current);
      setCopyToast(true);
      copyToastTimeoutRef.current = setTimeout(() => {
        setCopyToast(false);
        copyToastTimeoutRef.current = null;
      }, 2000);
    } catch {
      /* clipboard may be unavailable */
    }
  }, []);

  useEffect(() => {
    return () => {
      if (copyToastTimeoutRef.current) clearTimeout(copyToastTimeoutRef.current);
    };
  }, []);

  const loadBanks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const banksRes = await getBanks();
      setBanks(banksRes.banks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load banks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBanks();
  }, [loadBanks]);

  // When bank changes, load metrics for this bank and cache; derive quarters for selector.
  useEffect(() => {
    if (!selectedBank) {
      setQuarters([]);
      setSelectedYear(null);
      setSelectedQuarter(null);
      setSlices([]);
      setDefaultBankId("");
      return;
    }
    let cancelled = false;
    setMetricsLoading(true);
    getMetrics({ bank_id: selectedBank })
      .then((res) => {
        if (cancelled) return;
        const metrics = res.metrics as MetricRow[];
        setMetricsByBank((prev) => ({ ...prev, [selectedBank]: metrics }));
        const qList = deriveQuarters(metrics);
        setQuarters(qList);
        if (qList.length > 0) {
          const latest = qList[0];
          setSelectedYear(latest.year);
          setSelectedQuarter(latest.quarter);
          // Show only the most recent quarter by default — use "Add column" for more.
          setSlices([{
            id: `slice-${selectedBank}-${latest.year}-${latest.quarter}`,
            bankId: selectedBank,
            year: latest.year,
            quarter: latest.quarter,
          }]);
        } else {
          setSlices([]);
        }
        // The newly-selected bank is the default reference.
        setDefaultBankId(selectedBank);
        setMetricsLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setQuarters([]);
          setMetricsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedBank]);

  // When a comparison bank is picked, load its quarters list.
  useEffect(() => {
    if (!compBank) {
      setCompQuartersList([]);
      setCompYear(null);
      setCompQuarter(null);
      return;
    }
    const load = async () => {
      setCompLoading(true);
      try {
        // Use cached data if available; otherwise fetch.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cached = (metricsByBank as any)[compBank] as MetricRow[] | undefined;
        let metrics = cached;
        if (!metrics) {
          const res = await getMetrics({ bank_id: compBank });
          metrics = res.metrics as MetricRow[];
          setMetricsByBank((prev) => ({ ...prev, [compBank]: metrics! }));
        }
        const qList = deriveQuarters(metrics);
        setCompQuartersList(qList);
        if (qList.length > 0) {
          setCompYear(qList[0].year);
          setCompQuarter(qList[0].quarter);
        }
      } finally {
        setCompLoading(false);
      }
    };
    load();
  }, [compBank]); // intentionally omitting metricsByBank — we read it once via closure

  // Build value map per slice from cached metrics.
  const valueByMetricBySlice = useMemo(() => {
    const out: Record<string, Record<string, number>> = {};
    slices.forEach((slice) => {
      const metrics = metricsByBank[slice.bankId];
      if (!metrics?.length) {
        out[slice.id] = {};
        return;
      }
      const qList = deriveQuarters(metrics);
      const currentRows = metrics.filter(
        (m) => m.year === slice.year && m.quarter === slice.quarter
      );
      const currentMap = toMetricMap(currentRows);
      const curIdx = qList.findIndex((q) => q.year === slice.year && q.quarter === slice.quarter);
      const prevQ = curIdx >= 0 && curIdx + 1 < qList.length ? qList[curIdx + 1] : null;
      const previousRows =
        prevQ == null
          ? []
          : metrics.filter((m) => m.year === prevQ.year && m.quarter === prevQ.quarter);
      const previousMap = toMetricMap(previousRows);
      const derived = deriveCamelValues(currentMap, previousMap, slice.quarter);
      const merged: Record<string, number> = { ...derived };
      CAMEL_ROWS.forEach((row) => {
        if (currentMap[row.metric] != null) merged[row.metric] = currentMap[row.metric];
      });
      out[slice.id] = merged;
    });
    return out;
  }, [slices, metricsByBank]);

  /** Map each bankId to its color from the palette. Default bank = index 0 (no tint). */
  const bankColorMap = useMemo(() => {
    const map: Record<string, typeof BANK_COLORS[number]> = {};
    let colorIdx = 1;
    const seen = new Set<string>();
    slices.forEach((s) => {
      if (!seen.has(s.bankId)) {
        seen.add(s.bankId);
        if (s.bankId === defaultBankId) {
          map[s.bankId] = BANK_COLORS[0];
        } else {
          map[s.bankId] = BANK_COLORS[colorIdx % (BANK_COLORS.length - 1) + 1];
          colorIdx++;
        }
      }
    });
    return map;
  }, [slices, defaultBankId]);

  /**
   * Reference values from the default bank's slice that matches the selected period,
   * falling back to the first slice of the default bank. Used for Δ computation.
   */
  const defaultValues = useMemo(() => {
    const defaultSlice =
      slices.find(
        (s) => s.bankId === defaultBankId && s.year === selectedYear && s.quarter === selectedQuarter
      ) ?? slices.find((s) => s.bankId === defaultBankId);
    if (!defaultSlice) return {} as Record<string, number>;
    return valueByMetricBySlice[defaultSlice.id] ?? {};
  }, [slices, defaultBankId, selectedYear, selectedQuarter, valueByMetricBySlice]);

  /**
   * Ordered list of bankIds for the “Period Averages” island.
   * Default bank first, then any other banks in the order their columns appear.
   */
  const orderedBankIds = useMemo(() => {
    const seen = new Set<string>();
    const inOrder: string[] = [];
    slices.forEach((s) => {
      if (!seen.has(s.bankId)) {
        seen.add(s.bankId);
        inOrder.push(s.bankId);
      }
    });

    if (defaultBankId && inOrder.includes(defaultBankId)) {
      return [defaultBankId, ...inOrder.filter((id) => id !== defaultBankId)];
    }
    return inOrder;
  }, [slices, defaultBankId]);

  /**
   * Compute period averages per bank across the currently-added table columns.
   * “Period averages” here means: average of each metric across all selected
   * slices for that specific bank (not across banks).
   */
  const avgByBankIdMetric = useMemo(() => {
    const out: Record<string, Record<string, number | null>> = {};
    orderedBankIds.forEach((bankId) => {
      out[bankId] = {};
    });

    // Pre-group slice ids by bank for less repeated filtering.
    const sliceIdsByBank: Record<string, string[]> = {};
    orderedBankIds.forEach((bankId) => {
      sliceIdsByBank[bankId] = [];
    });
    slices.forEach((slice) => {
      if (!sliceIdsByBank[slice.bankId]) sliceIdsByBank[slice.bankId] = [];
      sliceIdsByBank[slice.bankId].push(slice.id);
    });

    orderedBankIds.forEach((bankId) => {
      const sliceIds = sliceIdsByBank[bankId] ?? [];

      CAMEL_ROWS.forEach((row) => {
        let sum = 0;
        let count = 0;
        sliceIds.forEach((sliceId) => {
          const valMap = valueByMetricBySlice[sliceId];
          const v = valMap?.[row.metric];
          if (v != null && !Number.isNaN(v)) {
            sum += v;
            count++;
          }
        });
        out[bankId][row.metric] = count > 0 ? sum / count : null;
      });
    });

    return out;
  }, [orderedBankIds, slices, valueByMetricBySlice]);

  /** True when at least one non-default-bank column is present. */
  const hasCompBanks = useMemo(
    () => slices.some((s) => s.bankId !== defaultBankId),
    [slices, defaultBankId]
  );

  const addColumn = useCallback(() => {
    if (!selectedBank || selectedYear == null || selectedQuarter == null) return;
    setSlices((prev) => [
      ...prev,
      {
        id: `slice-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        bankId: selectedBank,
        year: selectedYear,
        quarter: selectedQuarter,
      },
    ]);
  }, [selectedBank, selectedYear, selectedQuarter]);

  /** Add a column from the comparison bank selector. */
  const addComparisonColumn = useCallback(() => {
    if (!compBank || compYear == null || compQuarter == null) return;
    setSlices((prev) => [
      ...prev,
      {
        id: `slice-comp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        bankId: compBank,
        year: compYear,
        quarter: compQuarter,
      },
    ]);
    setShowCompPanel(false);
  }, [compBank, compYear, compQuarter]);

  const removeSlice = useCallback((id: string) => {
    setSlices((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const rowsByCategory = CAMEL_ROWS.reduce<Map<string, CamelRow[]>>((acc, row) => {
    const list = acc.get(row.category) ?? [];
    list.push(row);
    acc.set(row.category, list);
    return acc;
  }, new Map());

  const categoryOrder = [
    "Capital",
    "Asset Quality",
    "Management",
    "Earnings",
    "Liquidity",
    "Sensitivity",
  ];

  const bankOptions = useMemo(
    () => [
      { value: "", label: "Select a bank" },
      ...banks.map((b) => ({ value: b, label: b })),
    ],
    [banks]
  );

  const compBankOptions = useMemo(
    () => [
      { value: "", label: "Select a bank" },
      ...banks.filter((b) => b !== selectedBank).map((b) => ({ value: b, label: b })),
    ],
    [banks, selectedBank]
  );

  const periodOptions = useMemo(
    () =>
      quarters.map(({ year, quarter }) => ({
        value: `${year}-${quarter}`,
        label: `${year} Q${quarter}`,
      })),
    [quarters]
  );

  const compPeriodOptions = useMemo(
    () =>
      compQuartersList.map(({ year, quarter }) => ({
        value: `${year}-${quarter}`,
        label: `${year} Q${quarter}`,
      })),
    [compQuartersList]
  );

  const periodValue =
    selectedYear != null && selectedQuarter != null
      ? `${selectedYear}-${selectedQuarter}`
      : "";

  const compPeriodValue =
    compYear != null && compQuarter != null ? `${compYear}-${compQuarter}` : "";

  return (
    <div className={styles.page}>
      {copyToast && (
        <div className={styles.copyToast} role="status" aria-live="polite">
          Copied to clipboard
        </div>
      )}

      <div className={`card ${styles.filtersCard}`}>
        {/* ── Primary bank controls ─────────────────────────────────────── */}
        <div className={styles.filters}>
          <label className={styles.filterLabel}>
            <span className={styles.filterLabelText}>
              Primary Bank
              {selectedBank && <span className={styles.defaultBadge}>★ Default</span>}
            </span>
            <div className={styles.filterSelectWrap}>
              <CustomSelect
                value={selectedBank}
                onChange={setSelectedBank}
                options={bankOptions}
                placeholder="Select a bank"
                id="camel-bank"
              />
            </div>
          </label>
          {selectedBank && quarters.length > 0 && (
            <>
              <label className={styles.filterLabel}>
                Period
                <div className={styles.filterSelectWrap}>
                  <CustomSelect
                    value={periodValue}
                    onChange={(v) => {
                      if (v) {
                        const [y, q] = v.split("-").map(Number);
                        setSelectedYear(y);
                        setSelectedQuarter(q);
                      }
                    }}
                    options={periodOptions}
                    placeholder="Select period"
                    id="camel-period"
                  />
                </div>
              </label>
              <div className={styles.filterLabel}>
                <button
                  type="button"
                  className={styles.addColumnBtn}
                  onClick={addColumn}
                  disabled={metricsLoading}
                >
                  Add column
                </button>
              </div>
            </>
          )}
        </div>

        {slices.length > 0 && (
          <div className={styles.activeSlicesSection}>
            <div className={styles.activeSlicesHeader}>
              <span className={styles.activeSlicesTitle}>Active Columns</span>
              <span className={styles.activeSlicesHint}>
                Visible in the sheet and period averages
              </span>
            </div>
            <div className={styles.activeSlicesList} aria-label="Active comparison columns">
              {slices.map((slice) => {
                const isDefault = slice.bankId === defaultBankId;
                const color = bankColorMap[slice.bankId] ?? BANK_COLORS[0];
                const label = `${slice.bankId} ${formatSlicePeriod(slice.year, slice.quarter)}`;
                const chipAccent = isDefault ? "var(--color-primary)" : color.accent;
                const chipBackground = isDefault
                  ? "rgba(13, 148, 136, 0.08)"
                  : color.bg === "transparent"
                    ? "var(--color-bg-subtle)"
                    : color.bg;

                return (
                  <div
                    key={`active-${slice.id}`}
                    className={`${styles.activeSliceChip} ${isDefault ? styles.activeSliceChipDefault : ""}`}
                    style={{ borderColor: chipAccent, background: chipBackground }}
                  >
                    <div className={styles.activeSliceChipBody}>
                      <div className={styles.activeSliceChipTop}>
                        {isDefault && (
                          <span className={styles.activeSliceDefaultBadge}>★ Default</span>
                        )}
                        <span className={styles.activeSlicePeriod}>
                          {formatSlicePeriod(slice.year, slice.quarter)}
                        </span>
                      </div>
                      <span className={styles.activeSliceBank}>{slice.bankId}</span>
                    </div>
                    <button
                      type="button"
                      className={styles.activeSliceRemoveBtn}
                      onClick={() => removeSlice(slice.id)}
                      title="Remove column"
                      aria-label={`Remove ${label}`}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Comparison bank panel ──────────────────────────────────────── */}
        {selectedBank && banks.length > 1 && (
          <div className={styles.compSection}>
            <div className={styles.compSectionRow}>
              {!showCompPanel && (
                <button
                  type="button"
                  className={styles.addBankBtn}
                  onClick={() => setShowCompPanel(true)}
                >
                  + Compare Bank
                </button>
              )}

              {showCompPanel && (
                <div className={styles.compControls}>
                  <label className={styles.filterLabel}>
                    Compare with
                    <div className={styles.filterSelectWrap}>
                      <CustomSelect
                        value={compBank}
                        onChange={setCompBank}
                        options={compBankOptions}
                        placeholder="Select bank"
                        id="comp-bank"
                      />
                    </div>
                  </label>

                  {compBank && compQuartersList.length > 0 && (
                    <>
                      <label className={styles.filterLabel}>
                        Period
                        <div className={styles.filterSelectWrap}>
                          <CustomSelect
                            value={compPeriodValue}
                            onChange={(v) => {
                              if (v) {
                                const [y, q] = v.split("-").map(Number);
                                setCompYear(y);
                                setCompQuarter(q);
                              }
                            }}
                            options={compPeriodOptions}
                            placeholder="Select period"
                            id="comp-period"
                          />
                        </div>
                      </label>
                      <div className={styles.filterLabel}>
                        <button
                          type="button"
                          className={styles.addColumnBtn}
                          onClick={addComparisonColumn}
                          disabled={compLoading}
                        >
                          Add
                        </button>
                      </div>
                    </>
                  )}

                  {compLoading && (
                    <span className={styles.compLoadingText}>Loading…</span>
                  )}

                  <div className={styles.filterLabel}>
                    <button
                      type="button"
                      className={styles.cancelCompBtn}
                      onClick={() => {
                        setShowCompPanel(false);
                        setCompBank("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Δ toggle — only visible when comparison columns exist */}
              {hasCompBanks && (
                <label className={styles.deltaToggle}>
                  <input
                    type="checkbox"
                    checked={showDelta}
                    onChange={(e) => setShowDelta(e.target.checked)}
                  />
                  <span>Show Δ vs Default</span>
                </label>
              )}
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="card">
          <p className={styles.loading}>Loading…</p>
        </div>
      )}

      {error && (
        <div className="card">
          <div className={styles.error} role="alert">
            {error}
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className={styles.contentLayout}>
          {isExpanded && (
            <div
              className={styles.expandBackdrop}
              onClick={() => setIsExpanded(false)}
              aria-hidden="true"
            />
          )}
          <div className={styles.mainTable}>
            <div className={`card ${styles.cardTable} ${isExpanded ? styles.cardTableExpanded : ""}`}>
              <div className={styles.cardTableHeader}>
                <button
                  type="button"
                  className={styles.expandBtn}
                  onClick={() => setIsExpanded(!isExpanded)}
                  aria-label={isExpanded ? "Collapse table" : "Expand table"}
                  title={isExpanded ? "Collapse table" : "Expand table"}
                >
                  {isExpanded ? (
                    <span className={styles.expandIcon}>⤓</span>
                  ) : (
                    <span className={styles.expandIcon}>⤢</span>
                  )}
                </button>
              </div>
              {metricsLoading && selectedBank && (
                <p className={styles.loading}>Loading metrics…</p>
              )}
              <div className={`${styles.camelTableWrap} ${isExpanded ? styles.camelTableWrapExpanded : ""}`}>
                <table className={styles.camelTable}>
                  <thead>
                    <tr>
                      <th
                        className={`${styles.thCamels} ${styles.copyableCell}`}
                        onClick={() => handleCopy("CAMELS")}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleCopy("CAMELS");
                          }
                        }}
                        title="Click to copy"
                      >
                        CAMELS
                      </th>
                      <th
                        className={`${styles.thMetrics} ${styles.copyableCell}`}
                        onClick={() => handleCopy("Strategic Metrics/Indicators")}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleCopy("Strategic Metrics/Indicators");
                          }
                        }}
                        title="Click to copy"
                      >
                        Strategic Metrics/Indicators
                      </th>
                      {slices.map((slice) => {
                        const isDefault = slice.bankId === defaultBankId;
                        const color = bankColorMap[slice.bankId] ?? BANK_COLORS[0];
                        const label = `${slice.bankId} ${formatSlicePeriod(slice.year, slice.quarter)}`;
                        const compactLabel = formatCompactSliceHeader(slice.bankId);
                        return (
                          <th
                            key={slice.id}
                            className={`${styles.thValue} ${styles.copyableCell}`}
                            style={
                              color.headerBg !== "transparent"
                                ? { background: color.headerBg }
                                : undefined
                            }
                            onClick={() => handleCopy(label)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleCopy(label);
                              }
                            }}
                            title="Click to copy"
                          >
                            <div className={styles.thValueInner}>
                              <div className={styles.sliceHeaderInfo}>
                                {isDefault && (
                                  <span
                                    className={styles.defaultStar}
                                    title="Default bank (reference for Δ)"
                                  >
                                    ★
                                  </span>
                                )}
                                <span className={styles.sliceLabel}>{compactLabel}</span>
                                {!isDefault && (
                                  <button
                                    type="button"
                                    className={styles.setDefaultBtn}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDefaultBankId(slice.bankId);
                                    }}
                                    title="Set as default reference for Δ comparisons"
                                  >
                                    Set default
                                  </button>
                                )}
                              </div>
                              <button
                                type="button"
                                className={styles.removeSliceBtn}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeSlice(slice.id);
                                }}
                                title="Remove column"
                                aria-label={`Remove ${label}`}
                              >
                                ×
                              </button>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {categoryOrder.map((category) => {
                      const rows = rowsByCategory.get(category) ?? [];
                      const categoryKey = rows[0]?.categoryKey ?? "";
                      return rows.map((row, i) => (
                        <tr key={`${row.category}-${row.metric}`}>
                          {i === 0 ? (
                            <td
                              className={`${styles.tdCategory} ${styles[categoryKey]} ${styles.copyableCell}`}
                              rowSpan={rows.length}
                              onClick={() => handleCopy(row.category)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  handleCopy(row.category);
                                }
                              }}
                              title="Click to copy"
                            >
                              <span className={styles.categoryLabel}>{row.category}</span>
                            </td>
                          ) : null}
                          <td
                            className={`${styles.tdMetric} ${styles.copyableCell}`}
                            onClick={() => handleCopy(row.metric)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleCopy(row.metric);
                              }
                            }}
                            title="Click to copy"
                          >
                            {row.metric}
                          </td>
                          {slices.map((slice) => {
                            const isCompBank = slice.bankId !== defaultBankId;
                            const color = bankColorMap[slice.bankId] ?? BANK_COLORS[0];
                            const valueMap = valueByMetricBySlice[slice.id];
                            const value = valueMap?.[row.metric];
                            const valueDisplay =
                              valueMap && !UNVERIFIED_METRICS.has(row.metric)
                                ? formatCamelValue(row.metric, value)
                                : "—";

                            // Δ vs default bank — only for comparison columns when toggle is on
                            let deltaEl: React.ReactNode = null;
                            if (showDelta && isCompBank && valueMap) {
                              const defaultVal = defaultValues[row.metric];
                              if (
                                value != null &&
                                !isNaN(value) &&
                                defaultVal != null &&
                                !isNaN(defaultVal)
                              ) {
                                const delta = value - defaultVal;
                                const absDeltaStr = formatCamelValue(
                                  row.metric,
                                  Math.abs(delta)
                                );
                                const sign = delta >= 0 ? "+" : "−";
                                deltaEl = (
                                  <span
                                    className={
                                      delta >= 0 ? styles.deltaPos : styles.deltaNeg
                                    }
                                  >
                                    {sign}{absDeltaStr}
                                  </span>
                                );
                              }
                            }

                            return (
                              <td
                                key={slice.id}
                                className={`${styles.tdValue} ${styles.copyableCell}`}
                                style={
                                  isCompBank && color.bg !== "transparent"
                                    ? { background: color.bg }
                                    : undefined
                                }
                                onClick={() => handleCopy(valueDisplay)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleCopy(valueDisplay);
                                  }
                                }}
                                title="Click to copy"
                              >
                                <div className={styles.cellContent}>
                                  {valueDisplay}
                                  {deltaEl}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Averages Floating Island */}
          {slices.length > 0 && (
            <div className={styles.averagesIsland}>
              <div className={styles.averagesHeader}>
                <h3 className={styles.averagesTitle}>Period Averages</h3>
                <p className={styles.averagesSubtitle}>
                  Each metric is grouped by bank so the period average is clear at a glance.
                </p>
              </div>
              <div className={styles.averagesScroll}>
                {categoryOrder.map((category) => {
                  const rows = rowsByCategory.get(category) ?? [];
                  const categoryKey = rows[0]?.categoryKey ?? "";
                  return (
                    <div key={category} className={styles.averagesGroup}>
                      <h4 className={`${styles.averagesCategoryTitle} ${styles[categoryKey]}`}>
                        {category}
                      </h4>
                      {rows.map((row) => {
                        return (
                          <div key={row.metric} className={styles.averageRow}>
                            <span className={styles.averageMetric}>{row.metric}</span>
                            <div className={styles.averageValuesByBank}>
                              {orderedBankIds.map((bankId) => {
                                const isDefault = bankId === defaultBankId;
                                const bankColor = bankColorMap[bankId] ?? BANK_COLORS[0];
                                const avg = avgByBankIdMetric[bankId]?.[row.metric] ?? null;
                                const valueDisplay =
                                  avg !== null && !UNVERIFIED_METRICS.has(row.metric)
                                    ? formatCamelValue(row.metric, avg)
                                    : "—";
                                const accentColor = isDefault ? "var(--color-primary)" : bankColor.accent;
                                const cardBackground = isDefault
                                  ? "rgba(13, 148, 136, 0.08)"
                                  : bankColor.bg === "transparent"
                                    ? "var(--color-bg-subtle)"
                                    : bankColor.bg;
                                const badgeBackground = isDefault
                                  ? "rgba(13, 148, 136, 0.14)"
                                  : bankColor.headerBg === "transparent"
                                    ? "var(--color-surface-elevated)"
                                    : bankColor.headerBg;
                                return (
                                  <div
                                    key={`${bankId}-${row.metric}`}
                                    className={`${styles.averageValueCard} ${isDefault ? styles.defaultBankAverageCard : ""}`}
                                    style={{
                                      background: cardBackground,
                                      borderColor: accentColor,
                                    }}
                                    title={isDefault ? "Default bank average" : `${bankId} average`}
                                  >
                                    <div className={styles.averageValueCardTop}>
                                      <span
                                        className={styles.averageBankBadge}
                                        style={{
                                          color: accentColor,
                                          background: badgeBackground,
                                          borderColor: accentColor,
                                        }}
                                      >
                                        {isDefault ? <span className={styles.averageBankStar}>★</span> : null}
                                        <span className={styles.averageBankName}>
                                          {formatAverageBankLabel(bankId)}
                                        </span>
                                      </span>
                                    </div>
                                    <span
                                      className={`${styles.averageValue} ${isDefault ? styles.defaultBankAverageValue : ""}`}
                                    >
                                      {valueDisplay}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
