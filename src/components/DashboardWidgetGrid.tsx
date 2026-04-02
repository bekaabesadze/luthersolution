import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { DashboardWidgetCategory } from "../config/dashboardWidgetRegistry";

function CategoryIcon({ category }: { category: DashboardWidgetCategory }) {
  if (category === "KPI") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="1" y="5" width="4" height="10" rx="1" />
        <rect x="6" y="1" width="4" height="14" rx="1" />
        <rect x="11" y="8" width="4" height="7" rx="1" />
      </svg>
    );
  }
  if (category === "Chart") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="1,12 5,7 9,9 15,3" />
        <circle cx="5" cy="7" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="15" cy="3" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (category === "Table") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="1" y="1" width="14" height="14" rx="2" />
        <line x1="1" y1="5.5" x2="15" y2="5.5" />
        <line x1="6" y1="5.5" x2="6" y2="15" />
      </svg>
    );
  }
  return null;
}
import type { Layout } from "react-grid-layout";
import GridLayout, { WidthProvider } from "react-grid-layout";
import type { DashboardWidgetId, DashboardWidgetRenderCtx } from "../config/dashboardWidgetRegistry";
import { dashboardWidgetRegistry, getDashboardWidgetDefinition } from "../config/dashboardWidgetRegistry";
import styles from "./DashboardWidgetGrid.module.css";

export interface DashboardWidgetGridProps {
  ctx: DashboardWidgetRenderCtx;
  layoutState: DashboardLayoutState;
  onLayoutStateChange: (next: DashboardLayoutState) => void;
  onExpandWidget?: (widgetId: DashboardWidgetId) => void;
  editMode: boolean;
}

export interface DashboardLayoutItem {
  slotId: string;
  widgetId: DashboardWidgetId | null;
}

export interface DashboardLayoutState {
  version: 1;
  grid: Layout[];
  slots: DashboardLayoutItem[];
}

const pickerTabs = [
  { id: "total", label: "Total", hint: "Totals, counts, charts, and tables" },
  { id: "average", label: "Average", hint: "Average-focused KPI widgets" },
] as const;

type WidgetPickerTab = (typeof pickerTabs)[number]["id"];

const gridCols = 12;
const AutoWidthGridLayout = WidthProvider(GridLayout);
const rowHeightPx = 44;
const marginPx: [number, number] = [16, 16];
const averageWidgetIds = new Set<DashboardWidgetId>([
  "summary.avgGrowth",
  "summary.avgRevenue",
  "summary.avgProfit",
]);

const byId = <T extends { slotId: string }>(arr: T[]) => new Map(arr.map((x) => [x.slotId, x]));
const getPickerTabForWidget = (widgetId: DashboardWidgetId): WidgetPickerTab =>
  averageWidgetIds.has(widgetId) ? "average" : "total";

export function DashboardWidgetGrid({
  ctx,
  layoutState,
  onLayoutStateChange,
  onExpandWidget,
  editMode,
}: DashboardWidgetGridProps) {
  const [pickerForSlot, setPickerForSlot] = useState<string | null>(null);
  const [pickerTab, setPickerTab] = useState<WidgetPickerTab>("total");

  const slotById = useMemo(() => byId(layoutState.slots), [layoutState.slots]);
  const usedWidgetIds = useMemo(() => {
    const s = new Set<string>();
    layoutState.slots.forEach((slot) => {
      if (slot.widgetId) s.add(slot.widgetId);
    });
    return s;
  }, [layoutState.slots]);

  const availableWidgetsByTab = useMemo<Record<WidgetPickerTab, typeof dashboardWidgetRegistry>>(() => {
    const grouped: Record<WidgetPickerTab, typeof dashboardWidgetRegistry> = {
      total: [],
      average: [],
    };

    dashboardWidgetRegistry
      .slice()
      .sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label))
      .forEach((widget) => {
        grouped[getPickerTabForWidget(widget.id)].push(widget);
      });

    return grouped;
  }, []);

  const handleLayoutChange = (nextGrid: Layout[]) => {
    onLayoutStateChange({ ...layoutState, grid: nextGrid });
  };

  const setWidgetForSlot = (slotId: string, widgetId: DashboardWidgetId | null) => {
    const nextSlots = layoutState.slots.map((s) => (s.slotId === slotId ? { ...s, widgetId } : s));
    const def = widgetId ? getDashboardWidgetDefinition(widgetId) : undefined;
    const nextGrid = layoutState.grid.map((g) => {
      if (String(g.i) !== slotId) return g;
      if (!def) return g;
      const nextW = Math.max(g.w, def.minW);
      const nextH = Math.max(g.h, def.minH);
      return { ...g, minW: def.minW, minH: def.minH, w: nextW, h: nextH };
    });
    onLayoutStateChange({ ...layoutState, slots: nextSlots, grid: nextGrid });
  };

  const handleRemove = (slotId: string) => {
    setWidgetForSlot(slotId, null);
  };

  const handlePick = (slotId: string, widgetId: DashboardWidgetId) => {
    setWidgetForSlot(slotId, widgetId);
    setPickerForSlot(null);
  };

  const openPicker = (slotId: string) => {
    setPickerTab("total");
    setPickerForSlot(slotId);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickerForSlot(null);
    };
    if (pickerForSlot) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pickerForSlot]);

  return (
    <div className={styles.gridWrap}>
      <AutoWidthGridLayout
        className="layout"
        cols={gridCols}
        rowHeight={rowHeightPx}
        margin={marginPx}
        containerPadding={[0, 0]}
        layout={layoutState.grid}
        onLayoutChange={handleLayoutChange}
        compactType="vertical"
        isBounded
        isDraggable={editMode}
        isResizable={editMode}
        draggableHandle={`.${styles.cardHeader}`}
      >
        {layoutState.grid.map((li) => {
          const slotId = String(li.i);
          const slot = slotById.get(slotId);
          const widgetId = slot?.widgetId ?? null;
          const def = widgetId ? getDashboardWidgetDefinition(widgetId) : undefined;
          const title = def?.label ?? "Empty";
          const pxHeight = li.h * rowHeightPx + Math.max(0, li.h - 1) * marginPx[1];
          const renderCtx = { ...ctx, slotSize: { w: li.w, h: li.h, pxHeight } as const };

          return (
            <div key={slotId} className={styles.gridItem}>
              {widgetId && def ? (
                <div className={styles.card} aria-label={title}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>{title}</h3>
                    {onExpandWidget && (
                      <button
                        type="button"
                        onClick={() => onExpandWidget(widgetId)}
                        aria-label={`Expand ${title}`}
                        title="Expand"
                        style={{ all: "unset" }}
                      >
                        <span
                          style={{
                            width: "2.25rem",
                            height: "2.25rem",
                            border: "1px solid var(--color-border)",
                            borderRadius: "0.875rem",
                            background: "var(--color-surface-elevated)",
                            cursor: "pointer",
                            boxShadow: "var(--shadow-md)",
                            fontWeight: 800,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          ⤢
                        </span>
                      </button>
                    )}
                  </div>
                  <div
                    className={`${styles.cardBody} ${
                      editMode
                        ? def.category === "KPI"
                          ? styles.kpiBody
                          : def.category === "Chart"
                            ? styles.chartBody
                            : ""
                        : ""
                    }`}
                  >
                    {def.render(renderCtx)}
                  </div>
                  {editMode && (
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => handleRemove(slotId)}
                      aria-label={`Remove ${title} widget`}
                      title="Remove"
                    >
                      <span className={styles.removeIcon}>×</span>
                    </button>
                  )}
                </div>
              ) : editMode ? (
                <>
                  <button
                    type="button"
                    className={styles.placeholderBtn}
                    onClick={() => openPicker(slotId)}
                    aria-label="Add widget"
                  >
                    <div className={styles.placeholderPlus}>+</div>
                    <div className={styles.placeholderText}>Add widget</div>
                    <div className={styles.placeholderHint}>Choose a KPI, chart, or table to display here.</div>
                  </button>
                  {pickerForSlot === slotId && createPortal(
                    <>
                      <div className={styles.pickerBackdrop} onClick={() => setPickerForSlot(null)} aria-hidden="true" />
                      <div className={styles.picker} role="dialog" aria-modal="true" aria-label="Select widget">
                        <div className={styles.pickerHeader}>
                          <h4 className={styles.pickerTitle}>Choose a widget</h4>
                          <button
                            type="button"
                            className={styles.pickerClose}
                            onClick={() => setPickerForSlot(null)}
                            aria-label="Close widget picker"
                            title="Close"
                          >
                            ×
                          </button>
                        </div>
                        <div className={styles.pickerTabs} role="tablist" aria-label="Widget stat type">
                          {pickerTabs.map((tab) => {
                            const isActive = pickerTab === tab.id;
                            const panelId = `widget-picker-panel-${tab.id}`;
                            const tabId = `widget-picker-tab-${tab.id}`;

                            return (
                              <button
                                key={tab.id}
                                id={tabId}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                aria-controls={panelId}
                                className={`${styles.pickerTab} ${isActive ? styles.pickerTabActive : ""}`}
                                onClick={() => setPickerTab(tab.id)}
                              >
                                <span className={styles.pickerTabLabel}>{tab.label}</span>
                                <span className={styles.pickerTabHint}>{tab.hint}</span>
                              </button>
                            );
                          })}
                        </div>
                        <div
                          id={`widget-picker-panel-${pickerTab}`}
                          role="tabpanel"
                          aria-labelledby={`widget-picker-tab-${pickerTab}`}
                          className={styles.pickerList}
                        >
                          {availableWidgetsByTab[pickerTab].map((w) => {
                            const isUsed = usedWidgetIds.has(w.id);
                            return (
                              <button
                                key={w.id}
                                type="button"
                                className={styles.pickerItem}
                                onClick={() => handlePick(slotId, w.id)}
                                aria-label={`Add ${w.label}`}
                                title={isUsed ? "This widget is already on the dashboard (you can still add another copy)" : "Add widget"}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                                  <span style={{
                                    width: "2rem", height: "2rem", borderRadius: "0.5rem",
                                    background: "var(--color-bg-subtle)", border: "1px solid var(--color-border)",
                                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                                    color: "var(--color-text-muted)", flexShrink: 0,
                                  }}>
                                    <CategoryIcon category={w.category} />
                                  </span>
                                  <div>
                                    <div className={styles.pickerItemLabel}>{w.label}</div>
                                    <div className={styles.pickerItemMeta}>{w.category}</div>
                                  </div>
                                </div>
                                <div style={{ color: "var(--color-text-muted)", fontWeight: 800 }}>+</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>,
                    document.body
                  )}
                </>
              ) : (
                <div className={styles.card} aria-hidden="true" />
              )}
            </div>
          );
        })}
      </AutoWidthGridLayout>
    </div>
  );
}
