/**
 * ReportsPage.tsx
 * View and export quarterly bank metrics. Filter by bank, year, or quarter;
 * preview the report table and download as CSV.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { getBanks, getQuarters, getMetrics } from "../api/client";
import { MetricsTable } from "../components/MetricsTable";
import { CustomSelect } from "../components/CustomSelect";
import { metricsToTableRows } from "../utils/metricsTransform";
import type { MetricsTableRow } from "../components/MetricsTable";
import type { MetricRow } from "../api/types";
import styles from "./ReportsPage.module.css";

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

  const handleDownloadCsv = () => {
    if (metrics.length === 0) return;
    const csv = buildReportCsv(metrics);
    const label = [filterBank || "all", filterYear || "all", filterQuarter ? `Q${filterQuarter}` : "all"]
      .filter(Boolean)
      .join("-");
    downloadCsv(csv, `bank-metrics-report-${label}.csv`);
  };

  return (
    <div className={styles.page}>
      <header className="page-header">
        <h2 className="page-title">Reports</h2>
        <p className="page-description">
          View and export quarterly bank metrics. Filter by bank, year, or quarter, then preview the
          data below or download as CSV to use in Excel or other tools.
        </p>
        <div className={styles.aboutReport}>
          <strong>What this report shows:</strong> Revenue and growth % by bank and quarter, from
          your uploaded XBRL and CAMEL data. Use it to share numbers with stakeholders or analyze
          trends offline.
        </div>
      </header>

      <div className={`card ${styles.filtersCard}`}>
        <div className={styles.filters}>
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
              {loading ? "Loading…" : "Refresh"}
            </button>
            <button
              type="button"
              className={styles.downloadButton}
              onClick={handleDownloadCsv}
              disabled={loading || tableData.length === 0}
            >
              Download CSV
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      )}

      {loading && !error && (
        <p className={styles.loadingText}>Loading report data…</p>
      )}

      {!loading && !error && !hasSelectedBank && (
        <div className={styles.cardChart}>
          <div className={styles.cardChartHeader}>
            <h3 className={styles.cardChartTitle}>Select a bank</h3>
          </div>
          <div className={styles.emptyState}>
            <p>Select a bank manually from the list to view Bank metrics by quarter.</p>
          </div>
        </div>
      )}

      {!loading && !error && hasSelectedBank && tableData.length === 0 && (
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

      {!loading && !error && tableData.length > 0 && (
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
