import type { Layout } from "react-grid-layout";
import type { DashboardWidgetId } from "../config/dashboardWidgetRegistry";
import type { DashboardLayoutState } from "../components/DashboardWidgetGrid";

const STORAGE_KEY = "dashboardLayout:v1";

export function getDefaultDashboardLayoutState(): DashboardLayoutState {
  const slots: Array<{ slotId: string; widgetId: DashboardWidgetId | null }> = [
    { slotId: "kpi-1", widgetId: "summary.totalRevenue" },
    { slotId: "kpi-2", widgetId: "summary.bankCount" },
    { slotId: "kpi-3", widgetId: "summary.avgGrowth" },
    { slotId: "kpi-4", widgetId: "summary.netProfit" },
    { slotId: "chart-1", widgetId: "chart.revenueByBank" },
    { slotId: "chart-2", widgetId: "chart.revenueShare" },
    { slotId: "chart-3", widgetId: "chart.metricBreakdown" },
    { slotId: "chart-4", widgetId: "chart.quarterlyGrowth" },
    { slotId: "table-1", widgetId: "table.metrics" },
  ];

  const grid: Layout[] = [
    { i: "kpi-1", x: 0, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
    { i: "kpi-2", x: 3, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
    { i: "kpi-3", x: 6, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
    { i: "kpi-4", x: 9, y: 0, w: 3, h: 3, minW: 2, minH: 2 },

    // Default dashboard order:
    // - Revenue by bank + Revenue share in a 2-up row
    // - Metric breakdown full width
    // - Quarterly growth full width
    // - Metrics table full width
    { i: "chart-1", x: 0, y: 3, w: 6, h: 7, minW: 4, minH: 4 },
    { i: "chart-2", x: 6, y: 3, w: 6, h: 7, minW: 4, minH: 4 },
    { i: "chart-3", x: 0, y: 10, w: 12, h: 7, minW: 4, minH: 4 },
    { i: "chart-4", x: 0, y: 17, w: 12, h: 7, minW: 6, minH: 5 },
    { i: "table-1", x: 0, y: 25, w: 12, h: 8, minW: 6, minH: 5 },
  ];

  return { version: 1, grid, slots };
}

export function loadDashboardLayoutState(): DashboardLayoutState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultDashboardLayoutState();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1) return getDefaultDashboardLayoutState();
    if (!Array.isArray(parsed.grid) || !Array.isArray(parsed.slots)) return getDefaultDashboardLayoutState();

    // Basic shape validation.
    const grid = parsed.grid as Layout[];
    const slots = parsed.slots as Array<{ slotId: string; widgetId: DashboardWidgetId | null }>;
    if (grid.some((g) => typeof g.i !== "string")) return getDefaultDashboardLayoutState();
    if (slots.some((s) => typeof s.slotId !== "string" || (s.widgetId !== null && typeof s.widgetId !== "string"))) {
      return getDefaultDashboardLayoutState();
    }

    // Ensure every grid item has a slot and vice-versa; fallback if mismatched.
    const gridIds = new Set(grid.map((g) => String(g.i)));
    const slotIds = new Set(slots.map((s) => s.slotId));
    if (gridIds.size !== slotIds.size) return getDefaultDashboardLayoutState();
    for (const id of gridIds) if (!slotIds.has(id)) return getDefaultDashboardLayoutState();

    return { version: 1, grid, slots };
  } catch {
    return getDefaultDashboardLayoutState();
  }
}

export function saveDashboardLayoutState(state: DashboardLayoutState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota / privacy mode failures.
  }
}

