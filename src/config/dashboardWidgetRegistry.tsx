import type { ReactNode } from "react";
import type { MetricRow } from "../api/types";
import type { MetricsTableRow } from "../components/MetricsTable";
import type { DashboardCamelsResult } from "../utils/dashboardCamelsKpis";
import { RevenueBarChart } from "../components/RevenueBarChart";
import { DonutChart } from "../components/DonutChart";
import { GrowthLineChart } from "../components/GrowthLineChart";
import { MetricsTable } from "../components/MetricsTable";

export type DashboardWidgetId =
  | "summary.roaa"
  | "summary.roae"
  | "summary.nim"
  | "summary.costOfFunds"
  | "summary.yieldOnLoans"
  | "summary.loanToDeposit"
  | "summary.loanGrowth"
  | "summary.depositGrowth"
  | "chart.revenueByBank"
  | "chart.revenueShare"
  | "chart.metricBreakdown"
  | "chart.quarterlyGrowth"
  | "table.metrics";

export type DashboardWidgetCategory = "KPI" | "Chart" | "Table";

export interface DashboardWidgetSlotSize {
  w: number;
  h: number;
  /** Approximate pixel height available for the full tile (including header). */
  pxHeight: number;
}

export interface DashboardWidgetRenderCtx {
  camelsKpis: DashboardCamelsResult;
  hasSelectedBank: boolean;
  revenueData: { bank: string; revenue: number }[];
  revenueShareData: { name: string; value: number }[];
  metricBreakdownData: { name: string; value: number }[];
  growthData: Array<Record<string, any>>;
  growthSeriesKeys?: string[];
  quarterlyGrowthControls?: ReactNode;
  tableData: MetricsTableRow[];
  rawMetrics: MetricRow[];
  banks: string[];
  slotSize?: DashboardWidgetSlotSize;
}

export interface DashboardWidgetDefinition {
  id: DashboardWidgetId;
  label: string;
  category: DashboardWidgetCategory;
  minW: number;
  minH: number;
  defaultW: number;
  defaultH: number;
  render: (ctx: DashboardWidgetRenderCtx) => ReactNode;
}

const kpiStyles = {
  label: {
    fontSize: "clamp(0.68rem, 1.2vw, 0.75rem)",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    color: "var(--color-text-muted)",
    marginBottom: "0.2rem",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  labelLarge: {
    fontSize: "clamp(0.68rem, 1.2vw, 0.76rem)",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    color: "var(--color-text-muted)",
    marginBottom: "0.25rem",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  value: {
    fontSize: "clamp(1.05rem, 2.2vw, 1.45rem)",
    fontWeight: 800,
    color: "var(--color-primary)",
    letterSpacing: "-0.02em",
    lineHeight: 1.1,
    fontVariantNumeric: "tabular-nums" as const,
  },
  valueLarge: {
    fontSize: "clamp(1.2rem, 2vw, 1.5rem)",
    fontWeight: 800,
    color: "var(--color-primary)",
    letterSpacing: "-0.02em",
    lineHeight: 1.1,
    fontVariantNumeric: "tabular-nums" as const,
  },
  sub: {
    fontSize: "clamp(0.72rem, 1.3vw, 0.84rem)",
    color: "var(--color-text-subtle)",
    marginTop: "0.25rem",
    overflow: "hidden",
    display: "-webkit-box",
    WebkitBoxOrient: "vertical" as const,
    WebkitLineClamp: 2,
  },
  subLarge: {
    fontSize: "clamp(0.72rem, 1.3vw, 0.84rem)",
    color: "var(--color-text-subtle)",
    marginTop: "0.3rem",
    overflow: "hidden",
    display: "-webkit-box",
    WebkitBoxOrient: "vertical" as const,
    WebkitLineClamp: 2,
  },
  peerRow: {
    display: "flex",
    alignItems: "baseline",
    gap: "0.5rem",
    marginTop: "0.15rem",
  },
  peerLabel: {
    fontSize: "clamp(0.62rem, 1vw, 0.7rem)",
    fontWeight: 600,
    color: "var(--color-text-subtle)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    flexShrink: 0,
  },
  peerValue: {
    fontSize: "clamp(0.78rem, 1.5vw, 0.92rem)",
    fontWeight: 700,
    color: "var(--color-text-muted)",
    fontVariantNumeric: "tabular-nums" as const,
  },
};

const isKpiCompact = (slotSize?: { h: number }) => {
  return !slotSize || slotSize.h <= 2;
};

function chartHeightFromSlot(slotSize?: { pxHeight: number }, extraHeaderPx = 66, min = 160, max = 420) {
  if (!slotSize) return 300;
  const body = Math.max(min, slotSize.pxHeight - extraHeaderPx);
  return Math.max(min, Math.min(max, body));
}

function topNWithOther<T extends { value: number }>(data: T[], n: number): T[] {
  if (data.length <= n) return data;
  const head = data.slice(0, n);
  const tailSum = data.slice(n).reduce((s, d) => s + d.value, 0);
  return [...head, { ...(head[0] as any), name: "Other", value: tailSum }];
}

function formatPct(v: number | null): string {
  if (v === null) return "—";
  return `${(v * 100).toFixed(2)}%`;
}

function formatRatio(v: number | null): string {
  if (v === null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

/** Render a CAMELS KPI card with bank value and peer avg. */
function renderCamelsKpi(
  label: string,
  bankValue: number | null,
  peerAvg: number | null,
  hasSelectedBank: boolean,
  format: (v: number | null) => string,
  compact: boolean,
  _peerCount: number,
  bankCount: number,
) {
  const displayValue = hasSelectedBank ? bankValue : peerAvg;
  return (
    <div>
      <div style={compact ? kpiStyles.label : kpiStyles.labelLarge}>{label}</div>
      <div style={compact ? kpiStyles.value : kpiStyles.valueLarge}>{format(displayValue)}</div>
      {hasSelectedBank && peerAvg !== null ? (
        <div style={kpiStyles.peerRow}>
          <span style={kpiStyles.peerLabel}>Peer avg</span>
          <span style={kpiStyles.peerValue}>{format(peerAvg)}</span>
        </div>
      ) : (
        <div style={compact ? { ...kpiStyles.sub, opacity: 0.9, marginTop: "0.2rem" } : kpiStyles.subLarge}>
          {hasSelectedBank ? "—" : `avg of ${bankCount} bank${bankCount !== 1 ? "s" : ""}`}
        </div>
      )}
    </div>
  );
}

export const dashboardWidgetRegistry: DashboardWidgetDefinition[] = [
  {
    id: "summary.roaa",
    label: "ROAA",
    category: "KPI",
    minW: 2,
    minH: 2,
    defaultW: 3,
    defaultH: 2,
    render: ({ camelsKpis, hasSelectedBank, slotSize }) => {
      const compact = isKpiCompact(slotSize);
      return renderCamelsKpi(
        "ROAA",
        camelsKpis.subjectBank?.roaa ?? null,
        camelsKpis.peerAverage.roaa,
        hasSelectedBank,
        formatPct,
        compact,
        camelsKpis.peerCount,
        camelsKpis.bankCount,
      );
    },
  },
  {
    id: "summary.roae",
    label: "ROAE",
    category: "KPI",
    minW: 2,
    minH: 2,
    defaultW: 3,
    defaultH: 2,
    render: ({ camelsKpis, hasSelectedBank, slotSize }) => {
      const compact = isKpiCompact(slotSize);
      return renderCamelsKpi(
        "ROAE",
        camelsKpis.subjectBank?.roae ?? null,
        camelsKpis.peerAverage.roae,
        hasSelectedBank,
        formatPct,
        compact,
        camelsKpis.peerCount,
        camelsKpis.bankCount,
      );
    },
  },
  {
    id: "summary.nim",
    label: "NIM",
    category: "KPI",
    minW: 2,
    minH: 2,
    defaultW: 3,
    defaultH: 2,
    render: ({ camelsKpis, hasSelectedBank, slotSize }) => {
      const compact = isKpiCompact(slotSize);
      return renderCamelsKpi(
        "Net Interest Margin",
        camelsKpis.subjectBank?.nim ?? null,
        camelsKpis.peerAverage.nim,
        hasSelectedBank,
        formatPct,
        compact,
        camelsKpis.peerCount,
        camelsKpis.bankCount,
      );
    },
  },
  {
    id: "summary.costOfFunds",
    label: "Cost of Funds",
    category: "KPI",
    minW: 2,
    minH: 2,
    defaultW: 3,
    defaultH: 2,
    render: ({ camelsKpis, hasSelectedBank, slotSize }) => {
      const compact = isKpiCompact(slotSize);
      return renderCamelsKpi(
        "Cost of Funds",
        camelsKpis.subjectBank?.costOfFunds ?? null,
        camelsKpis.peerAverage.costOfFunds,
        hasSelectedBank,
        formatPct,
        compact,
        camelsKpis.peerCount,
        camelsKpis.bankCount,
      );
    },
  },
  {
    id: "summary.yieldOnLoans",
    label: "Yield on Loans",
    category: "KPI",
    minW: 2,
    minH: 2,
    defaultW: 3,
    defaultH: 2,
    render: ({ camelsKpis, hasSelectedBank, slotSize }) => {
      const compact = isKpiCompact(slotSize);
      return renderCamelsKpi(
        "Yield on Loans",
        camelsKpis.subjectBank?.yieldOnLoans ?? null,
        camelsKpis.peerAverage.yieldOnLoans,
        hasSelectedBank,
        formatPct,
        compact,
        camelsKpis.peerCount,
        camelsKpis.bankCount,
      );
    },
  },
  {
    id: "summary.loanToDeposit",
    label: "Loan to Deposit",
    category: "KPI",
    minW: 2,
    minH: 2,
    defaultW: 3,
    defaultH: 2,
    render: ({ camelsKpis, hasSelectedBank, slotSize }) => {
      const compact = isKpiCompact(slotSize);
      return renderCamelsKpi(
        "Loan to Deposit",
        camelsKpis.subjectBank?.loanToDeposit ?? null,
        camelsKpis.peerAverage.loanToDeposit,
        hasSelectedBank,
        formatRatio,
        compact,
        camelsKpis.peerCount,
        camelsKpis.bankCount,
      );
    },
  },
  {
    id: "summary.loanGrowth",
    label: "Loan Growth",
    category: "KPI",
    minW: 2,
    minH: 2,
    defaultW: 3,
    defaultH: 2,
    render: ({ camelsKpis, hasSelectedBank, slotSize }) => {
      const compact = isKpiCompact(slotSize);
      return renderCamelsKpi(
        "Loan Growth",
        camelsKpis.subjectBank?.loanGrowthRate ?? null,
        camelsKpis.peerAverage.loanGrowthRate,
        hasSelectedBank,
        formatRatio,
        compact,
        camelsKpis.peerCount,
        camelsKpis.bankCount,
      );
    },
  },
  {
    id: "summary.depositGrowth",
    label: "Deposit Growth",
    category: "KPI",
    minW: 2,
    minH: 2,
    defaultW: 3,
    defaultH: 2,
    render: ({ camelsKpis, hasSelectedBank, slotSize }) => {
      const compact = isKpiCompact(slotSize);
      return renderCamelsKpi(
        "Deposit Growth",
        camelsKpis.subjectBank?.depositGrowthRate ?? null,
        camelsKpis.peerAverage.depositGrowthRate,
        hasSelectedBank,
        formatRatio,
        compact,
        camelsKpis.peerCount,
        camelsKpis.bankCount,
      );
    },
  },
  {
    id: "chart.revenueByBank",
    label: "Revenue by bank",
    category: "Chart",
    minW: 4,
    minH: 5,
    defaultW: 6,
    defaultH: 5,
    render: ({ revenueData, slotSize }) => (
      <RevenueBarChart
        data={revenueData}
        title=""
        height={chartHeightFromSlot(slotSize, 86)}
        axisFontSize={slotSize && slotSize.h <= 4 ? 11 : 13}
      />
    ),
  },
  {
    id: "chart.revenueShare",
    label: "Revenue share",
    category: "Chart",
    minW: 4,
    minH: 5,
    defaultW: 6,
    defaultH: 5,
    render: ({ revenueShareData, slotSize }) => (
      <DonutChart
        data={topNWithOther(revenueShareData, slotSize && slotSize.h <= 4 ? 3 : 5) as any}
        title=""
        valueFormatter={(v) => v.toLocaleString()}
        height={chartHeightFromSlot(slotSize, 86, 180, 420)}
        legendFontSize={slotSize && slotSize.h <= 4 ? 10 : 12}
        sliceLabelMode={slotSize && slotSize.h <= 4 ? "none" : "percentOnly"}
      />
    ),
  },
  {
    id: "chart.metricBreakdown",
    label: "Metric breakdown",
    category: "Chart",
    minW: 6,
    minH: 6,
    defaultW: 12,
    defaultH: 5,
    render: ({ metricBreakdownData, slotSize }) => (
      <DonutChart
        data={topNWithOther(metricBreakdownData, slotSize && slotSize.h <= 5 ? 4 : 7) as any}
        title=""
        valueFormatter={(v) => v.toLocaleString()}
        height={chartHeightFromSlot(slotSize, 86, 200, 520)}
        legendFontSize={slotSize && slotSize.h <= 5 ? 10 : 12}
        sliceLabelMode={slotSize && slotSize.h <= 5 ? "none" : "namePercent"}
      />
    ),
  },
  {
    id: "chart.quarterlyGrowth",
    label: "Quarterly growth (%)",
    category: "Chart",
    minW: 6,
    minH: 6,
    defaultW: 12,
    defaultH: 6,
    render: ({ growthData, growthSeriesKeys, quarterlyGrowthControls, slotSize }) => {
      const showControls = !!slotSize && slotSize.h >= 6 && !!quarterlyGrowthControls;
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {showControls && <div>{quarterlyGrowthControls}</div>}
          <GrowthLineChart
            data={growthData}
            title=""
            seriesKeys={growthSeriesKeys}
            height={chartHeightFromSlot(slotSize, showControls ? 178 : 86, 160, 520)}
            compact
            hideControls
            axisFontSize={slotSize && slotSize.h <= 5 ? 11 : 13}
          />
        </div>
      );
    },
  },
  {
    id: "table.metrics",
    label: "Bank metrics by quarter",
    category: "Table",
    minW: 4,
    minH: 5,
    defaultW: 12,
    defaultH: 6,
    render: ({ tableData, slotSize }) => (
      <MetricsTable
        data={tableData}
        title=""
        density={slotSize && slotSize.h <= 6 ? "compact" : "normal"}
        maxRows={slotSize ? (slotSize.h <= 5 ? 4 : slotSize.h <= 7 ? 6 : 8) : 8}
        narrow={!!slotSize && slotSize.w <= 6}
      />
    ),
  },
];

export function getDashboardWidgetDefinition(id: DashboardWidgetId): DashboardWidgetDefinition | undefined {
  return dashboardWidgetRegistry.find((w) => w.id === id);
}
