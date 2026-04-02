/**
 * MetricsTable.tsx
 * Table displaying bank metrics by quarter. Responsive: horizontal scroll on small screens.
 * Accepts rows with bankName, year, quarter, revenue, growthPct (or compatible fields).
 */

import { useEffect, useMemo, useState } from "react";
import styles from "./MetricsTable.module.css";

export interface MetricsTableRow {
  bankId?: string;
  bankName: string;
  year: number;
  quarter: number;
  revenue: number;
  growthPct: number;
}

export interface MetricsTableProps {
  data: MetricsTableRow[];
  title?: string;
  density?: "normal" | "compact";
  /** Max rows to show before toggling. */
  maxRows?: number;
  /** When true, render a narrow layout (no horizontal scrolling). */
  narrow?: boolean;
}

const DEFAULT_VISIBLE_ROWS = 8;

export function MetricsTable({
  data,
  title = "Bank metrics by quarter",
  density = "normal",
  maxRows = DEFAULT_VISIBLE_ROWS,
  narrow = false,
}: MetricsTableProps) {
  const [showAllRows, setShowAllRows] = useState(false);
  const [narrowMetric, setNarrowMetric] = useState<"revenue" | "growthPct">("revenue");
  const [thresholdInput, setThresholdInput] = useState("");

  const flagThreshold = thresholdInput !== "" ? parseFloat(thresholdInput) : null;
  const isFlagged = (row: MetricsTableRow) =>
    flagThreshold !== null && !isNaN(flagThreshold) && row.growthPct < flagThreshold;

  useEffect(() => {
    setShowAllRows(false);
  }, [data]);

  const visibleRows = showAllRows ? data : data.slice(0, maxRows);

  const stats = useMemo(() => {
    if (data.length === 0) {
      return { banks: 0, newest: "—", oldest: "—" };
    }
    const uniqueBanks = new Set(data.map((r) => r.bankName)).size;
    const periods = data.map((r) => ({ year: r.year, quarter: r.quarter }));
    const newest = periods.reduce((best, current) => {
      if (current.year > best.year) return current;
      if (current.year === best.year && current.quarter > best.quarter) return current;
      return best;
    }, periods[0]);
    const oldest = periods.reduce((best, current) => {
      if (current.year < best.year) return current;
      if (current.year === best.year && current.quarter < best.quarter) return current;
      return best;
    }, periods[0]);
    return {
      banks: uniqueBanks,
      newest: `${newest.year} Q${newest.quarter}`,
      oldest: `${oldest.year} Q${oldest.quarter}`,
    };
  }, [data]);

  return (
    <div className={`${styles.wrapper} ${density === "compact" ? styles.wrapperCompact : ""}`}>
      {title ? <h3 className="card-title">{title}</h3> : null}
      {data.length > 0 && (
        <>
          <div className={styles.metaRow}>
            <span className={styles.metaChip}>{data.length} rows</span>
            <span className={styles.metaChip}>{stats.banks} banks</span>
            <span className={styles.metaChip}>
              {stats.oldest} to {stats.newest}
            </span>
          </div>
          <div className={`${styles.thresholdBar} ${flagThreshold !== null && !isNaN(flagThreshold) ? styles.thresholdBarActive : ""}`}>
            <div className={styles.thresholdBarLeft}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className={styles.thresholdBarIcon}>
                <path d="M6.5 1.5 7.9 5.3H12L8.8 7.6 10.1 11.5 6.5 9.1 2.9 11.5 4.2 7.6 1 5.3H5.1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
              </svg>
              <span className={styles.thresholdBarLabel}>Flag growth below</span>
            </div>
            <div className={styles.thresholdBarRight}>
              <div className={styles.thresholdInputGroup}>
                <input
                  id="growth-threshold"
                  type="number"
                  className={styles.thresholdInput}
                  placeholder="—"
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(e.target.value)}
                />
                <span className={styles.thresholdUnit}>%</span>
              </div>
              {flagThreshold !== null && !isNaN(flagThreshold) && (
                <>
                  <span className={styles.flaggedCount}>
                    {data.filter(isFlagged).length} flagged
                  </span>
                  <button
                    type="button"
                    className={styles.thresholdClear}
                    onClick={() => setThresholdInput("")}
                    aria-label="Clear threshold"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
      {narrow ? (
        <div className={styles.narrowWrap}>
          <div className={styles.narrowControls}>
            <span className={styles.narrowLabel}>Metric:</span>
            <button
              type="button"
              className={`${styles.narrowMetricBtn} ${narrowMetric === "revenue" ? styles.narrowMetricBtnActive : ""}`}
              onClick={() => setNarrowMetric("revenue")}
            >
              Revenue
            </button>
            <button
              type="button"
              className={`${styles.narrowMetricBtn} ${narrowMetric === "growthPct" ? styles.narrowMetricBtnActive : ""}`}
              onClick={() => setNarrowMetric("growthPct")}
            >
              Growth %
            </button>
          </div>
          <div className={styles.narrowList}>
            {data.length === 0 ? (
              <div className={styles.empty}>No data. Upload CSV/Excel on the Upload Data page.</div>
            ) : (
              visibleRows.map((row, i) => (
                <div
                  key={`${row.bankName}-${row.year}-${row.quarter}-${i}`}
                  className={`${styles.narrowRow}${isFlagged(row) ? ` ${styles.flaggedNarrowRow}` : ""}`}
                >
                  <div className={styles.narrowLeft}>
                    <div className={styles.bankCell}>{row.bankName}</div>
                    <div className={styles.narrowPeriod}>
                      {row.year} Q{row.quarter}
                    </div>
                  </div>
                  <div className={styles.narrowRight}>
                    {narrowMetric === "revenue" ? (
                      <div className={styles.narrowValue}>{row.revenue.toLocaleString()}</div>
                    ) : (
                      <div className={styles.narrowValue}>
                        <span className={row.growthPct >= 0 ? styles.growthUp : styles.growthDown}>
                          {row.growthPct >= 0 ? "+" : ""}
                          {row.growthPct.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                  {isFlagged(row) && (
                    <div className={styles.narrowFlagCol}>
                      <span className={styles.flagIcon} title="Growth below threshold">
                        <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
                          <path d="M1 1v12M1 1h7l-2 3 2 3H1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Bank</th>
                <th>Period</th>
                <th className={styles.num}>Revenue</th>
                <th className={styles.num}>Growth %</th>
                <th className={styles.flagCol}></th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={4} className={styles.empty}>
                    No data. Upload CSV/Excel on the Upload Data page.
                  </td>
                </tr>
              ) : (
                visibleRows.map((row, i) => (
                  <tr
                    key={`${row.bankName}-${row.year}-${row.quarter}-${i}`}
                    className={isFlagged(row) ? styles.flaggedRow : undefined}
                  >
                    <td className={styles.bankCell}>{row.bankName}</td>
                    <td>
                      <span className={styles.periodBadge}>
                        {row.year} Q{row.quarter}
                      </span>
                    </td>
                    <td className={styles.num}>{row.revenue.toLocaleString()}</td>
                    <td className={styles.num}>
                      <span className={row.growthPct >= 0 ? styles.growthUp : styles.growthDown}>
                        {row.growthPct >= 0 ? "+" : ""}
                        {row.growthPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className={styles.flagCol}>
                      {isFlagged(row) && (
                        <span className={styles.flagIcon} title="Growth below threshold">
                          <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
                            <path d="M1 1v12M1 1h7l-2 3 2 3H1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      {data.length > maxRows && (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.toggleButton}
            onClick={() => setShowAllRows((prev) => !prev)}
          >
            {showAllRows
              ? `Show less`
              : `Show ${data.length - maxRows} more row(s)`}
          </button>
        </div>
      )}
    </div>
  );
}
