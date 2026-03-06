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
}

const DEFAULT_VISIBLE_ROWS = 8;

export function MetricsTable({ data, title = "Bank metrics by quarter" }: MetricsTableProps) {
  const [showAllRows, setShowAllRows] = useState(false);

  useEffect(() => {
    setShowAllRows(false);
  }, [data]);

  const visibleRows = showAllRows ? data : data.slice(0, DEFAULT_VISIBLE_ROWS);

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
    <div className={styles.wrapper}>
      {title ? <h3 className="card-title">{title}</h3> : null}
      {data.length > 0 && (
        <div className={styles.metaRow}>
          <span className={styles.metaChip}>{data.length} rows</span>
          <span className={styles.metaChip}>{stats.banks} banks</span>
          <span className={styles.metaChip}>
            {stats.oldest} to {stats.newest}
          </span>
        </div>
      )}
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Bank</th>
              <th>Period</th>
              <th className={styles.num}>Revenue</th>
              <th className={styles.num}>Growth %</th>
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
                <tr key={`${row.bankName}-${row.year}-${row.quarter}-${i}`}>
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {data.length > DEFAULT_VISIBLE_ROWS && (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.toggleButton}
            onClick={() => setShowAllRows((prev) => !prev)}
          >
            {showAllRows
              ? `Show less`
              : `Show ${data.length - DEFAULT_VISIBLE_ROWS} more row(s)`}
          </button>
        </div>
      )}
    </div>
  );
}
