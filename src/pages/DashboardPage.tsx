/**
 * DashboardPage.tsx
 * Fetches data from backend GET /banks, GET /quarters, GET /metrics.
 * Shows summary stats, bar chart, donut charts (revenue share, metric breakdown), line chart, and table.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ExpandedRevenueChart } from "../components/ExpandedRevenueChart";
import { ExpandedRevenueShare } from "../components/ExpandedRevenueShare";
import { ExpandedMetricBreakdown } from "../components/ExpandedMetricBreakdown";
import { ExpandedGrowthChart } from "../components/ExpandedGrowthChart";
import { ExpandedMetricsTable } from "../components/ExpandedMetricsTable";
import { ExpandedSummaryStat } from "../components/ExpandedSummaryStat";
import { CustomSelect } from "../components/CustomSelect";
import { DashboardWidgetGrid } from "../components/DashboardWidgetGrid";
import { getBanks, getQuarters, getMetrics } from "../api/client";
import {
  metricsToRevenueByBank,
  metricsToRevenueShareGrouped,
  metricsToMetricBreakdown,
  metricsToQuarterlyGrowth,
  metricsToTableRows,
  metricsToSummaryStats,
} from "../utils/metricsTransform";
import type { MetricsTableRow } from "../components/MetricsTable";
import type { MetricRow } from "../api/types";
import type { DashboardWidgetId } from "../config/dashboardWidgetRegistry";
import { getDefaultDashboardLayoutState, loadDashboardLayoutState, saveDashboardLayoutState } from "../utils/dashboardLayoutStorage";
import styles from "./DashboardPage.module.css";

const emptyRevenue = [] as { bank: string; revenue: number }[];
const emptyGrowth = [] as { quarter: string; growth: number }[];

export function DashboardPage() {
  const [banks, setBanks] = useState<string[]>([]);
  const [quarters, setQuarters] = useState<{ year: number; quarter: number }[]>([]);
  const [revenueData, setRevenueData] = useState(emptyRevenue);
  const [growthData, setGrowthData] = useState(emptyGrowth);
  const [tableData, setTableData] = useState<MetricsTableRow[]>([]);
  const [summaryStats, setSummaryStats] = useState(metricsToSummaryStats([]));
  const [revenueShareData, setRevenueShareData] = useState<{ name: string; value: number }[]>([]);
  const [metricBreakdownData, setMetricBreakdownData] = useState<{ name: string; value: number }[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterBank, setFilterBank] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("");
  const [filterQuarter, setFilterQuarter] = useState<string>("");
  const [growthFromYear, setGrowthFromYear] = useState<string>("");
  const [growthToYear, setGrowthToYear] = useState<string>("");
  const [growthBanks, setGrowthBanks] = useState<string[]>([]);
  const [growthBankPickerOpen, setGrowthBankPickerOpen] = useState(false);
  const growthBankPickerRef = useRef<HTMLDivElement>(null);
  const [expandedChart, setExpandedChart] = useState<"revenue" | "revenueShare" | "metricBreakdown" | "quarterlyGrowth" | "metricsTable" | null>(null);
  const [expandedSummaryStat, setExpandedSummaryStat] = useState<"totalRevenue" | "bankCount" | "avgGrowth" | "totalDeposits" | "totalLoans" | "netProfit" | "avgRevenue" | "avgProfit" | null>(null);
  const [rawMetrics, setRawMetrics] = useState<MetricRow[]>([]);
  const [dashboardLayout, setDashboardLayout] = useState(() => loadDashboardLayoutState());
  const [editMode, setEditMode] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Connection: fetch filter options and metrics from backend
      const [banksRes, quartersRes, metricsRes] = await Promise.all([
        getBanks(),
        getQuarters(),
        getMetrics({
          bank_id: filterBank || undefined,
          year: filterYear ? Number(filterYear) : undefined,
          quarter: filterQuarter ? Number(filterQuarter) : undefined,
        }),
      ]);

      setBanks(banksRes.banks);
      setQuarters(quartersRes.quarters);

      const metrics = metricsRes.metrics;
      setRawMetrics(metrics);
      if (metrics.length > 0) {
        setRevenueData(metricsToRevenueByBank(metrics));
        setGrowthData(metricsToQuarterlyGrowth(metrics));
        setTableData(metricsToTableRows(metrics));
        setSummaryStats(metricsToSummaryStats(metrics));
        setRevenueShareData(metricsToRevenueShareGrouped(metrics, 5));
        setMetricBreakdownData(metricsToMetricBreakdown(metrics));
      } else {
        setRevenueData(emptyRevenue);
        setGrowthData(emptyGrowth);
        setTableData([]);
        setSummaryStats(metricsToSummaryStats([]));
        setRevenueShareData([]);
        setMetricBreakdownData([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
      setRevenueData(emptyRevenue);
      setGrowthData(emptyGrowth);
      setTableData([]);
      setSummaryStats(metricsToSummaryStats([]));
      setRevenueShareData([]);
      setMetricBreakdownData([]);
      setRawMetrics([]);
    } finally {
      setLoading(false);
    }
  }, [filterBank, filterYear, filterQuarter]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    saveDashboardLayoutState(dashboardLayout);
  }, [dashboardLayout]);

  useEffect(() => {
    if (!growthBankPickerOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (growthBankPickerRef.current && !growthBankPickerRef.current.contains(e.target as Node)) {
        setGrowthBankPickerOpen(false);
      }
    };
    const onDocKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGrowthBankPickerOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onDocKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onDocKeyDown);
    };
  }, [growthBankPickerOpen]);

  const bankOptions = useMemo(
    () => [{ value: "", label: "All banks" }, ...banks.map((b) => ({ value: b, label: b }))],
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

  const allGrowthYears = useMemo(() => {
    return Array.from(new Set(rawMetrics.map((m) => m.year))).sort((a, b) => a - b);
  }, [rawMetrics]);

  const growthFromYearOptions = useMemo(() => {
    const maxYear = growthToYear ? Number(growthToYear) : Infinity;
    return [
      { value: "", label: "Any" },
      ...allGrowthYears
        .filter((y) => y <= maxYear)
        .map((y) => ({ value: String(y), label: String(y) })),
    ];
  }, [allGrowthYears, growthToYear]);

  const growthToYearOptions = useMemo(() => {
    const minYear = growthFromYear ? Number(growthFromYear) : -Infinity;
    return [
      { value: "", label: "Any" },
      ...allGrowthYears
        .filter((y) => y >= minYear)
        .map((y) => ({ value: String(y), label: String(y) })),
    ];
  }, [allGrowthYears, growthFromYear]);

  const growthBankOptions = useMemo(() => banks.slice().sort((a, b) => a.localeCompare(b)), [banks]);

  const growthChartData = useMemo(() => {
    if (!growthBanks || growthBanks.length === 0) return growthData;
    if (growthBanks.length === 1) {
      return metricsToQuarterlyGrowth(rawMetrics.filter((m) => m.bank_id === growthBanks[0]));
    }
    // Multi-bank: merge into { quarter, [bank]: growth } rows
    const byQuarter = new Map<string, any>();
    growthBanks.forEach((bank) => {
      const series = metricsToQuarterlyGrowth(rawMetrics.filter((m) => m.bank_id === bank));
      series.forEach((pt) => {
        const existing = byQuarter.get(pt.quarter) ?? { quarter: pt.quarter };
        existing[bank] = pt.growth;
        byQuarter.set(pt.quarter, existing);
      });
    });
    return Array.from(byQuarter.values()).sort((a, b) => String(a.quarter).localeCompare(String(b.quarter)));
  }, [growthBanks, growthData, rawMetrics]);

  const parseYearFromQuarterLabel = (label: string): number | null => {
    const match = label.match(/^(\d{4})-Q[1-4]$/);
    return match ? Number(match[1]) : null;
  };

  const filteredGrowthData = useMemo(() => {
    const from = growthFromYear ? Number(growthFromYear) : null;
    const to = growthToYear ? Number(growthToYear) : null;
    return growthChartData.filter((point: any) => {
      const year = parseYearFromQuarterLabel(point.quarter as string);
      if (year === null) return true;
      if (from !== null && year < from) return false;
      if (to !== null && year > to) return false;
      return true;
    });
  }, [growthChartData, growthFromYear, growthToYear]);

  const growthMetricsForExpandedView = useMemo(() => {
    const scopedMetrics =
      growthBanks.length > 0 ? rawMetrics.filter((m) => growthBanks.includes(m.bank_id)) : rawMetrics;
    const from = growthFromYear ? Number(growthFromYear) : null;
    const to = growthToYear ? Number(growthToYear) : null;
    if (from === null && to === null) return scopedMetrics;
    return scopedMetrics.filter((m) => {
      if (from !== null && m.year < from) return false;
      if (to !== null && m.year > to) return false;
      return true;
    });
  }, [rawMetrics, growthBanks, growthFromYear, growthToYear]);

  const quarterlyGrowthControls = (
    <div className={styles.growthRangeControls}>
      <label className={styles.growthRangeField}>
        <span>Bank</span>
        <div className={styles.growthRangeSelectWrap}>
          <div style={{ position: "relative" }}>
            <div
              ref={growthBankPickerRef}
              className={`${styles.growthMultiSelect} ${growthBankPickerOpen ? styles.growthMultiSelectOpen : ""}`}
            >
              <button
                type="button"
                className={styles.growthMultiSelectTrigger}
                onClick={() => setGrowthBankPickerOpen((o) => !o)}
                aria-expanded={growthBankPickerOpen}
                aria-haspopup="listbox"
              >
                <span
                  className={
                    growthBanks.length === 0
                      ? styles.growthMultiSelectPlaceholder
                      : styles.growthMultiSelectValue
                  }
                >
                  {growthBanks.length === 0
                    ? "All banks"
                    : growthBanks.length === 1
                      ? growthBanks[0]
                      : `${growthBanks.length} banks selected`}
                </span>
                <span className={styles.growthMultiSelectChevron} aria-hidden />
              </button>
              {growthBankPickerOpen && (
                <div className={styles.growthMultiSelectMenu} role="listbox" aria-label="Select banks">
                  <div className={styles.growthMultiSelectActions}>
                    <button
                      type="button"
                      className={styles.growthMultiSelectActionBtn}
                      onClick={() => setGrowthBanks([])}
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      className={styles.growthMultiSelectActionBtn}
                      onClick={() => setGrowthBanks(growthBankOptions.slice(0, 8))}
                    >
                      Top 8
                    </button>
                  </div>
                  {growthBankOptions.map((b) => {
                    const checked = growthBanks.includes(b);
                    return (
                      <label key={b} className={styles.growthMultiSelectOption}>
                        <input
                          type="checkbox"
                          className={styles.growthMultiSelectCheckboxInput}
                          checked={checked}
                          onChange={() => {
                            setGrowthBanks((prev) =>
                              prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]
                            );
                          }}
                        />
                        <span className={styles.growthMultiSelectCheckbox} aria-hidden />
                        <span className={styles.growthMultiSelectOptionLabel}>{b}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </label>
      <label className={styles.growthRangeField}>
        <span>From year</span>
        <div className={styles.growthRangeSelectWrap}>
          <CustomSelect
            value={growthFromYear}
            onChange={setGrowthFromYear}
            options={growthFromYearOptions}
            placeholder="Any"
            id="growth-from-year"
          />
        </div>
      </label>
      <label className={styles.growthRangeField}>
        <span>To year</span>
        <div className={styles.growthRangeSelectWrap}>
          <CustomSelect
            value={growthToYear}
            onChange={setGrowthToYear}
            options={growthToYearOptions}
            placeholder="Any"
            id="growth-to-year"
          />
        </div>
      </label>
    </div>
  );

  const onExpandWidget = (widgetId: DashboardWidgetId) => {
    switch (widgetId) {
      case "summary.totalRevenue":
        setExpandedSummaryStat("totalRevenue");
        return;
      case "summary.bankCount":
        setExpandedSummaryStat("bankCount");
        return;
      case "summary.avgGrowth":
        setExpandedSummaryStat("avgGrowth");
        return;
      case "summary.totalDeposits":
        setExpandedSummaryStat("totalDeposits");
        return;
      case "summary.totalLoans":
        setExpandedSummaryStat("totalLoans");
        return;
      case "summary.netProfit":
        setExpandedSummaryStat("netProfit");
        return;
      case "summary.avgRevenue":
        setExpandedSummaryStat("avgRevenue");
        return;
      case "summary.avgProfit":
        setExpandedSummaryStat("avgProfit");
        return;
      case "chart.revenueByBank":
        setExpandedChart("revenue");
        return;
      case "chart.revenueShare":
        setExpandedChart("revenueShare");
        return;
      case "chart.metricBreakdown":
        setExpandedChart("metricBreakdown");
        return;
      case "chart.quarterlyGrowth":
        setExpandedChart("quarterlyGrowth");
        return;
      case "table.metrics":
        setExpandedChart("metricsTable");
        return;
      default:
        return;
    }
  };

  return (
    <div className={styles.page}>

      {/* Connection: filter dropdowns use GET /banks and GET /quarters; changing filters refetches GET /metrics */}
      <div className={`card ${styles.filtersCard}`}>
        <div className={styles.filters}>
          <label className={styles.filterLabel}>
            Bank
            <div className={styles.filterSelectWrap}>
              <CustomSelect
                value={filterBank}
                onChange={setFilterBank}
                options={bankOptions}
                placeholder="All banks"
                id="dashboard-bank"
              />
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
                id="dashboard-year"
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
                id="dashboard-quarter"
              />
            </div>
          </label>
          <div className={styles.refreshWrap}>
            <button
              type="button"
              className={styles.refreshButton}
              onClick={() => loadDashboard()}
              disabled={loading}
            >
              {loading ? "Loading…" : "Refresh"}
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
        <p className={styles.loadingText}>Loading dashboard data…</p>
      )}

      {!loading && !error && revenueData.length === 0 && tableData.length === 0 && (
        <div className={styles.cardChart}>
          <div className={styles.cardChartHeader}>
            <h3 className={styles.cardChartTitle}>No data</h3>
          </div>
          <div className={styles.emptyState}>
            <p>No data for the selected filters.</p>
            <p className={styles.emptyStateHint}>
              {filterBank || filterYear || filterQuarter
                ? "Try changing the bank, year, or quarter filter, or upload XBRL data for the selected period."
                : "Upload XBRL files from the Upload Data page to see metrics here."}
            </p>
          </div>
        </div>
      )}

      {!loading && !error && (revenueData.length > 0 || tableData.length > 0) && (
        <>

          {expandedSummaryStat && (
            <ExpandedSummaryStat
              statKey={expandedSummaryStat}
              statLabel={
                expandedSummaryStat === "totalRevenue"
                  ? "Total Revenue"
                  : expandedSummaryStat === "bankCount"
                    ? "Banks"
                    : expandedSummaryStat === "avgGrowth"
                      ? "Average Growth"
                      : expandedSummaryStat === "totalDeposits"
                        ? "Total Deposits"
                        : expandedSummaryStat === "totalLoans"
                          ? "Total Loans"
                          : expandedSummaryStat === "avgRevenue"
                            ? "Average Revenue"
                            : expandedSummaryStat === "avgProfit"
                              ? "Average Profit"
                              : "Net Profit"
              }
              metrics={rawMetrics}
              onClose={() => setExpandedSummaryStat(null)}
            />
          )}

          {expandedChart === "revenue" && (
            <ExpandedRevenueChart
              revenueData={revenueData}
              metrics={rawMetrics}
              onClose={() => setExpandedChart(null)}
            />
          )}

          {expandedChart === "revenueShare" && (
            <ExpandedRevenueShare
              revenueShareData={revenueShareData}
              metrics={rawMetrics}
              onClose={() => setExpandedChart(null)}
            />
          )}

          {expandedChart === "metricBreakdown" && (
            <ExpandedMetricBreakdown
              metricBreakdownData={metricBreakdownData}
              metrics={rawMetrics}
              onClose={() => setExpandedChart(null)}
            />
          )}

          {expandedChart === "quarterlyGrowth" && (
            <ExpandedGrowthChart
              growthData={filteredGrowthData}
              metrics={growthMetricsForExpandedView}
              onClose={() => setExpandedChart(null)}
            />
          )}

          {expandedChart === "metricsTable" && (
            <ExpandedMetricsTable
              tableData={tableData}
              metrics={rawMetrics}
              banks={banks}
              onClose={() => setExpandedChart(null)}
            />
          )}

          <div style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text)" }}>
                  Dashboard widgets
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                  {editMode
                    ? "Drag to move • Resize from corners • Click ⤢ to expand"
                    : "View mode • Click Edit layout to customize"}
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className={styles.refreshButton}
                  onClick={() => setEditMode((v) => !v)}
                  style={{ padding: "0.6rem 1rem" }}
                  title={editMode ? "Exit layout edit mode" : "Edit which widgets are shown"}
                >
                  {editMode ? "Done" : "Edit layout"}
                </button>
                <button
                  type="button"
                  className={styles.refreshButton}
                  onClick={() => setDashboardLayout(getDefaultDashboardLayoutState())}
                  style={{ padding: "0.6rem 1rem" }}
                  title="Reset layout to default"
                >
                  Reset layout
                </button>
              </div>
            </div>
          </div>

          <DashboardWidgetGrid
            ctx={{
              summaryStats,
              revenueData,
              revenueShareData,
              metricBreakdownData,
              growthData: filteredGrowthData as any,
              growthSeriesKeys: growthBanks.length > 1 ? growthBanks : undefined,
              quarterlyGrowthControls,
              tableData,
              rawMetrics,
              banks,
            }}
            layoutState={dashboardLayout}
            onLayoutStateChange={setDashboardLayout}
            onExpandWidget={onExpandWidget}
            editMode={editMode}
          />
        </>
      )}
    </div>
  );
}
