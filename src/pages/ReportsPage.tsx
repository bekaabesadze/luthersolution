/**
 * ReportsPage.tsx
 * View and export quarterly bank metrics or CAMELS scorecard data.
 * Filter by bank, year, or quarter; preview the report table and download as CSV.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { getBanks, getQuarters, getMetrics } from "../api/client";
import { MetricsTable } from "../components/MetricsTable";
import { CustomSelect } from "../components/CustomSelect";
import { metricsToTableRows } from "../utils/metricsTransform";
import { deriveCamelValues } from "./ScoreboardPage";
import type { MetricsTableRow } from "../components/MetricsTable";
import type { MetricRow } from "../api/types";
import styles from "./ReportsPage.module.css";

type ReportType = "metrics" | "camels";

const CAMELS_CATEGORIES: Record<string, string[]> = {
  Capital: ["Equity to Assets", "Tier 1 Leverage Ratio", "Legal Lending Limit"],
  "Asset Quality": [
    "90+ PD and Non-Accrual / Total Loans",
    "Past Due 30-89 / Total Loans",
    "Non Performing Assets to Equity + Reserves",
    "ACL / Total Loans",
  ],
  Management: [
    "Percentage on Budget",
    "Number of Employees",
    "Efficiency Ratio",
    "Loan Growth Rate",
    "Deposit Growth Rate",
    "Non-Interest Income",
  ],
  Earnings: [
    "Cost of Funds",
    "Yield on Loans",
    "TE Yield on Securities",
    "Net Interest Margin",
    "Return on Assets",
    "Return on Equity",
  ],
  Liquidity: [
    "Loan to Deposit Ratio",
    "Brokered Deposits to Total Deposits",
    "Short Term Non-Core Funding",
    "Net Loans to Average Assets",
    "Core Deposits to Average Assets",
    "Pledged Assets to Total Assets",
    "FHLB Open Borrowing Capacity",
  ],
  Sensitivity: [
    "Earnings at Risk (12m) -100",
    "Earnings at Risk (12m) +100",
    "Economic Value of Equity Ratio -100",
    "Economic Value of Equity Ratio +100",
    "Non Parallel EAR (12m) Most Likely",
    "Non Parallel EVE Ratio Most Likely",
  ],
};

interface CamelsReportRow {
  category: string;
  metric: string;
  value: string;
  rawValue: number | null;
}

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

function formatCamelValue(metric: string, value: number): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "";
  if (metric === "Number of Employees") return Math.round(value).toLocaleString();
  if (metric === "Legal Lending Limit" || metric === "FHLB Open Borrowing Capacity") {
    return value >= 1e6 ? (value / 1e6).toFixed(2) + "M" : value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  if (Math.abs(value) <= 2) return (value * 100).toFixed(2) + "%";
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function buildReportCsv(metrics: MetricRow[]): string {
  const rows = metricsToTableRows(metrics);
  const headers = ["Bank", "Year", "Quarter", "Revenue", "Growth %"];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [r.bankName, r.year, `Q${r.quarter}`, r.revenue, `${r.growthPct.toFixed(1)}%`].join(",")
    ),
  ];
  return lines.join("\n");
}

function buildCamelsCsv(camelsRows: CamelsReportRow[], bankName: string, year: string, quarter: string): string {
  const headers = ["Category", "Metric", "Value"];
  const lines = [
    `"CAMELS Report: ${bankName} ${year} Q${quarter}"`,
    "",
    headers.join(","),
    ...camelsRows.map((r) =>
      [`"${r.category}"`, `"${r.metric}"`, `"${r.value}"`].join(",")
    ),
  ];
  return lines.join("\n");
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const [banks, setBanks] = useState<string[]>([]);
  const [quarters, setQuarters] = useState<{ year: number; quarter: number }[]>([]);
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [tableData, setTableData] = useState<MetricsTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reportType, setReportType] = useState<ReportType>("camels");
  const [filterBank, setFilterBank] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("");
  const [filterQuarter, setFilterQuarter] = useState<string>("");
  const hasSelectedBank = filterBank.trim().length > 0;

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [banksRes, quartersRes] = await Promise.all([getBanks(), getQuarters()]);
      setBanks(banksRes.banks);
      setQuarters(quartersRes.quarters);

      if (!hasSelectedBank) {
        setMetrics([]);
        setTableData([]);
        return;
      }

      const metricsRes = await getMetrics({
        bank_id: filterBank,
        year: filterYear ? Number(filterYear) : undefined,
        quarter: filterQuarter ? Number(filterQuarter) : undefined,
      });
      setMetrics(metricsRes.metrics);
      setTableData(metricsToTableRows(metricsRes.metrics));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report data");
      setMetrics([]);
      setTableData([]);
    } finally {
      setLoading(false);
    }
  }, [filterBank, filterYear, filterQuarter, hasSelectedBank]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const bankOptions = useMemo(
    () => banks.map((b) => ({ value: b, label: b })),
    [banks]
  );
  const yearOptions = useMemo(
    () => [
      { value: "", label: "All years" },
      ...Array.from(new Set(quarters.map((q) => q.year)))
        .sort((a, b) => b - a)
        .map((y) => ({ value: String(y), label: String(y) })),
    ],
    [quarters]
  );
  const quarterOptions = useMemo(
    () => [
      { value: "", label: "All quarters" },
      { value: "1", label: "Q1" },
      { value: "2", label: "Q2" },
      { value: "3", label: "Q3" },
      { value: "4", label: "Q4" },
    ],
    []
  );

  // Compute CAMELS report rows from metrics
  const camelsRows = useMemo((): CamelsReportRow[] => {
    if (!hasSelectedBank || metrics.length === 0) return [];

    // Find the latest quarter in the data
    const qSet = new Map<string, { year: number; quarter: number }>();
    metrics.forEach((m) => {
      const key = `${m.year}-${m.quarter}`;
      if (!qSet.has(key)) qSet.set(key, { year: m.year, quarter: m.quarter });
    });
    const sortedQ = Array.from(qSet.values()).sort(
      (a, b) => b.year - a.year || b.quarter - a.quarter
    );
    if (sortedQ.length === 0) return [];

    const latest = sortedQ[0];
    const prev = sortedQ.length > 1 ? sortedQ[1] : null;

    const currentRows = metrics.filter(
      (m) => m.year === latest.year && m.quarter === latest.quarter
    );
    const previousRows = prev
      ? metrics.filter((m) => m.year === prev.year && m.quarter === prev.quarter)
      : [];

    const currentMap = toMetricMap(currentRows);
    const previousMap = toMetricMap(previousRows);
    const derived = deriveCamelValues(currentMap, previousMap, latest.quarter);

    const rows: CamelsReportRow[] = [];
    for (const [category, metricNames] of Object.entries(CAMELS_CATEGORIES)) {
      for (const metric of metricNames) {
        const val = derived[metric] ?? null;
        rows.push({
          category,
          metric,
          value: val !== null ? formatCamelValue(metric, val) : "",
          rawValue: val,
        });
      }
    }
    return rows;
  }, [metrics, hasSelectedBank]);

  const reportPeriodLabel = useMemo(() => {
    if (metrics.length === 0) return "";
    const qSet = new Map<string, { year: number; quarter: number }>();
    metrics.forEach((m) => {
      const key = `${m.year}-${m.quarter}`;
      if (!qSet.has(key)) qSet.set(key, { year: m.year, quarter: m.quarter });
    });
    const sortedQ = Array.from(qSet.values()).sort(
      (a, b) => b.year - a.year || b.quarter - a.quarter
    );
    if (sortedQ.length === 0) return "";
    return `${sortedQ[0].year} Q${sortedQ[0].quarter}`;
  }, [metrics]);

  const handleDownloadCsv = () => {
    if (reportType === "camels") {
      if (camelsRows.length === 0) return;
      const csv = buildCamelsCsv(camelsRows, filterBank, filterYear || "All", filterQuarter || "All");
      const label = [filterBank || "all", filterYear || "all", filterQuarter ? `Q${filterQuarter}` : "all"]
        .filter(Boolean)
        .join("-");
      downloadCsv(csv, `camels-report-${label}.csv`);
    } else {
      if (metrics.length === 0) return;
      const csv = buildReportCsv(metrics);
      const label = [filterBank || "all", filterYear || "all", filterQuarter ? `Q${filterQuarter}` : "all"]
        .filter(Boolean)
        .join("-");
      downloadCsv(csv, `bank-metrics-report-${label}.csv`);
    }
  };

  const hasData = reportType === "camels" ? camelsRows.length > 0 : tableData.length > 0;

  return (
    <div className={styles.page}>
      <header className="page-header">
        <h2 className="page-title">Reports</h2>
        <p className="page-description">
          Select a report type, filter by bank and period, then preview the data below or download as CSV.
        </p>
      </header>

      <div className={`card ${styles.filtersCard}`}>
        <div className={styles.filters}>
          <label className={styles.filterLabel}>
            Report Type
            <div className={styles.filterSelectWrap}>
              <CustomSelect
                value={reportType}
                onChange={(v) => setReportType(v as ReportType)}
                options={[
                  { value: "camels", label: "CAMELS Scorecard" },
                  { value: "metrics", label: "Bank Metrics" },
                ]}
                placeholder="Select report type"
                id="reports-type"
              />
            </div>
          </label>
          <label className={styles.filterLabel}>
            Bank
            <div className={styles.filterSelectWrap}>
              <CustomSelect value={filterBank} onChange={setFilterBank} options={bankOptions} placeholder="Select bank" id="reports-bank" />
            </div>
          </label>
          <label className={styles.filterLabel}>
            Year
            <div className={styles.filterSelectWrap}>
              <CustomSelect
                value={filterYear}
                onChange={setFilterYear}
                options={yearOptions}
                placeholder="All years"
                id="reports-year"
              />
            </div>
          </label>
          <label className={styles.filterLabel}>
            Quarter
            <div className={styles.filterSelectWrap}>
              <CustomSelect
                value={filterQuarter}
                onChange={setFilterQuarter}
                options={quarterOptions}
                placeholder="All quarters"
                id="reports-quarter"
              />
            </div>
          </label>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.refreshButton}
              onClick={() => loadReport()}
              disabled={loading}
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
            <button
              type="button"
              className={styles.downloadButton}
              onClick={handleDownloadCsv}
              disabled={loading || !hasData}
            >
              Download CSV
            </button>
          </div>
        </div>
        <div className={styles.aboutReport}>
          {reportType === "camels" ? (
            <>
              <strong>CAMELS Scorecard:</strong> Capital adequacy, Asset quality, Management, Earnings,
              Liquidity, and Sensitivity metrics derived from the uploaded call report data for the selected bank and period.
            </>
          ) : (
            <>
              <strong>Bank Metrics:</strong> Revenue and growth % by bank and quarter from your uploaded data.
            </>
          )}
        </div>
      </div>

      {error && (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      )}

      {loading && !error && (
        <p className={styles.loadingText}>Loading report data...</p>
      )}

      {!loading && !error && !hasSelectedBank && (
        <div className={styles.cardChart}>
          <div className={styles.cardChartHeader}>
            <h3 className={styles.cardChartTitle}>Select a bank</h3>
          </div>
          <div className={styles.emptyState}>
            <p>Select a bank from the list to generate a report.</p>
          </div>
        </div>
      )}

      {!loading && !error && hasSelectedBank && !hasData && (
        <div className={styles.cardChart}>
          <div className={styles.cardChartHeader}>
            <h3 className={styles.cardChartTitle}>No data</h3>
          </div>
          <div className={styles.emptyState}>
            <p>No metrics for the selected filters.</p>
            <p className={styles.emptyStateHint}>
              Try different filters or upload data for the selected bank, year, or quarter from Upload Data.
            </p>
          </div>
        </div>
      )}

      {/* CAMELS Scorecard Table */}
      {!loading && !error && reportType === "camels" && camelsRows.length > 0 && (
        <div className={styles.cardTable}>
          <div className={styles.cardChartHeader}>
            <h3 className={styles.cardChartTitle}>
              CAMELS Scorecard: {filterBank} {reportPeriodLabel && `- ${reportPeriodLabel}`}
            </h3>
          </div>
          <div className={styles.cardChartBody}>
            <div style={{ overflowX: "auto" }}>
              <table className={styles.camelsTable}>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Metric</th>
                    <th className={styles.valueCol}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {camelsRows.map((row, i) => {
                    const showCategory =
                      i === 0 || camelsRows[i - 1].category !== row.category;
                    const categoryRowCount = camelsRows.filter(
                      (r) => r.category === row.category
                    ).length;
                    return (
                      <tr
                        key={`${row.category}-${row.metric}`}
                        className={showCategory ? styles.categoryFirstRow : ""}
                      >
                        {showCategory && (
                          <td
                            rowSpan={categoryRowCount}
                            className={styles.categoryCell}
                          >
                            {row.category}
                          </td>
                        )}
                        <td>{row.metric}</td>
                        <td className={styles.valueCol}>
                          {row.value || <span style={{ color: "var(--color-text-subtle)" }}>-</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Bank Metrics Table */}
      {!loading && !error && reportType === "metrics" && tableData.length > 0 && (
        <div className={styles.cardTable}>
          <div className={styles.cardChartHeader}>
            <h3 className={styles.cardChartTitle}>Report: Bank metrics by quarter</h3>
          </div>
          <div className={styles.cardChartBody}>
            <MetricsTable data={tableData} title="" />
          </div>
        </div>
      )}
    </div>
  );
}
