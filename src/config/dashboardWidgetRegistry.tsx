import type { ReactNode } from "react";
import type { MetricRow } from "../api/types";
import type { MetricsTableRow } from "../components/MetricsTable";
import type { SummaryStats as SummaryStatsType } from "../utils/metricsTransform";
import { RevenueBarChart } from "../components/RevenueBarChart";
import { DonutChart } from "../components/DonutChart";
import { GrowthLineChart } from "../components/GrowthLineChart";
import { MetricsTable } from "../components/MetricsTable";

export type DashboardWidgetId =
  | "summary.totalRevenue"
  | "summary.bankCount"
  | "summary.avgGrowth"
  | "summary.totalDeposits"
  | "summary.totalLoans"
  | "summary.netProfit"
  | "summary.avgRevenue"
  | "summary.avgProfit"
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
  summaryStats: SummaryStatsType;
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

const formatShort = (v: number) =>
  v >= 1e9
    ? `${(v / 1e9).toFixed(1)}B`
    : v >= 1e6
      ? `${(v / 1e6).toFixed(1)}M`
      : v >= 1e3
        ? `${(v / 1e3).toFixed(1)}k`
        : v.toLocaleString();

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
};

const isKpiCompact = (slotSize?: { h: number }) => {
  // h=2 is the typical KPI tile; treat it as compact (keep only the essentials).
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

export const dashboardWidgetRegistry: DashboardWidgetDefinition[] = [
  {
    id: "summary.totalRevenue",
    label: "Total revenue",
    category: "KPI",
    minW: 2,
    minH: 2,
    defaultW: 2,
    defaultH: 2,
    render: ({ summaryStats, slotSize }) => {
      const compact = isKpiCompact(slotSize);
      return (
        <div>
          <div style={compact ? kpiStyles.label : kpiStyles.labelLarge}>Total revenue</div>
          <div style={compact ? kpiStyles.value : kpiStyles.valueLarge}>{formatShort(summaryStats.totalRevenue)}</div>
          <div style={compact ? { ...kpiStyles.sub, opacity: 0.9, marginTop: "0.2rem" } : kpiStyles.subLarge}>
            {summaryStats.totalRevenue > 0 ? summaryStats.totalRevenue.toLocaleString() : "—"}
          </div>
        </div>
      );
    },
  },
  {
    id: "summary.bankCount",
    label: "Banks",
    category: "KPI",
    minW: 2,
    minH: 2,
    defaultW: 2,
    defaultH: 2,
    render: ({ summaryStats, slotSize }) => {
      const compact = isKpiCompact(slotSize);
      return (
        <div>
          <div style={compact ? kpiStyles.label : kpiStyles.labelLarge}>Banks</div>
          <div style={compact ? kpiStyles.value : kpiStyles.valueLarge}>{summaryStats.bankCount}</div>
          <div style={compact ? { ...kpiStyles.sub, opacity: 0.9, marginTop: "0.2rem" } : kpiStyles.subLarge}>
            in selection
          </div>
        </div>
      );
    },
  },
  {
    id: "summary.avgGrowth",
    label: "Avg growth",
    category: "KPI",
    minW: 2,
    minH: 2,
    defaultW: 2,
    defaultH: 2,
    render: ({ summaryStats, slotSize }) => {
      const compact = isKpiCompact(slotSize);
      return (
        <div>
          <div style={compact ? kpiStyles.label : kpiStyles.labelLarge}>Avg growth</div>
          <div style={compact ? kpiStyles.value : kpiStyles.valueLarge}>{summaryStats.hasAvgGrowthData ? `${summaryStats.avgGrowthPct.toFixed(1)}%` : "—"}</div>
          <div style={compact ? { ...kpiStyles.sub, opacity: 0.9, marginTop: "0.2rem" } : kpiStyles.subLarge}>
            quarterly
          </div>
        </div>
      );
    },
  },
  {
    id: "summary.totalDeposits",
    label: "Total deposits",
    category: "KPI",
    minW: 2,
    minH: 2,
    defaultW: 2,
    defaultH: 2,
    render: ({ summaryStats, slotSize }) => {
      const compact = isKpiCompact(slotSize);
      return (
        <div>
          <div style={compact ? kpiStyles.label : kpiStyles.labelLarge}>Total deposits</div>
          <div style={compact ? kpiStyles.value : kpiStyles.valueLarge}>{summaryStats.totalDeposits > 0 ? formatShort(summaryStats.totalDeposits) : "—"}</div>
          <div style={compact ? { ...kpiStyles.sub, opacity: 0.9, marginTop: "0.2rem" } : kpiStyles.subLarge}>
            {summaryStats.totalDeposits > 0 ? summaryStats.totalDeposits.toLocaleString() : "No data"}
          </div>
        </div>
      );
    },
  },
  {
    id: "summary.totalLoans",
    label: "Total loans",
    category: "KPI",
    minW: 2,
    minH: 2,
    defaultW: 2,
    defaultH: 2,
    render: ({ summaryStats, slotSize }) => {
      const compact = isKpiCompact(slotSize);
      return (
        <div>
          <div style={compact ? kpiStyles.label : kpiStyles.labelLarge}>Total loans</div>
          <div style={compact ? kpiStyles.value : kpiStyles.valueLarge}>{summaryStats.totalLoans > 0 ? formatShort(summaryStats.totalLoans) : "—"}</div>
          <div style={compact ? { ...kpiStyles.sub, opacity: 0.9, marginTop: "0.2rem" } : kpiStyles.subLarge}>
            {summaryStats.totalLoans > 0 ? summaryStats.totalLoans.toLocaleString() : "No data"}
          </div>
        </div>
      );
    },
  },
  {
    id: "summary.netProfit",
    label: "Net profit",
    category: "KPI",
    minW: 2,
    minH: 2,
    defaultW: 2,
    defaultH: 2,
    render: ({ summaryStats, slotSize }) => {
      const compact = isKpiCompact(slotSize);
      return (
        <div>
          <div style={compact ? kpiStyles.label : kpiStyles.labelLarge}>Net profit</div>
          <div style={compact ? kpiStyles.value : kpiStyles.valueLarge}>{summaryStats.totalNetProfit !== 0 ? formatShort(summaryStats.totalNetProfit) : "—"}</div>
          <div style={compact ? { ...kpiStyles.sub, opacity: 0.9, marginTop: "0.2rem" } : kpiStyles.subLarge}>
            {summaryStats.totalNetProfit !== 0 ? summaryStats.totalNetProfit.toLocaleString() : "No data"}
          </div>
        </div>
      );
    },
  },
  {
    id: "summary.avgRevenue",
    label: "Avg revenue",
    category: "KPI",
    minW: 2,
    minH: 2,
    defaultW: 2,
    defaultH: 2,
    render: ({ summaryStats, slotSize }) => {
      const compact = isKpiCompact(slotSize);
      const { avgRevenue, revObservations } = summaryStats;
      const hasData = avgRevenue > 0 && revObservations > 0;
      return (
        <div>
          <div style={compact ? kpiStyles.label : kpiStyles.labelLarge}>Avg revenue</div>
          <div style={compact ? kpiStyles.value : kpiStyles.valueLarge}>
            {hasData ? formatShort(avgRevenue) : "—"}
          </div>
          <div style={compact ? { ...kpiStyles.sub, opacity: 0.9, marginTop: "0.2rem" } : kpiStyles.subLarge}>
            {hasData
              ? `per bank-period · ${revObservations} obs.`
              : "No revenue data"}
          </div>
        </div>
      );
    },
  },
  {
    id: "summary.avgProfit",
    label: "Avg profit",
    category: "KPI",
    minW: 2,
    minH: 2,
    defaultW: 2,
    defaultH: 2,
    render: ({ summaryStats, slotSize }) => {
      const compact = isKpiCompact(slotSize);
      const { avgProfit, profitObservations } = summaryStats;
      const hasData = avgProfit !== 0 && profitObservations > 0;
      const isNegative = avgProfit < 0;
      return (
        <div>
          <div style={compact ? kpiStyles.label : kpiStyles.labelLarge}>Avg profit</div>
          <div
            style={{
              ...(compact ? kpiStyles.value : kpiStyles.valueLarge),
              color: isNegative ? "var(--color-danger)" : "var(--color-primary)",
            }}
          >
            {hasData ? (isNegative ? `−${formatShort(Math.abs(avgProfit))}` : formatShort(avgProfit)) : "—"}
          </div>
          <div style={compact ? { ...kpiStyles.sub, opacity: 0.9, marginTop: "0.2rem" } : kpiStyles.subLarge}>
            {hasData
              ? `per bank-period · ${profitObservations} obs.`
              : "No profit data"}
          </div>
        </div>
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

