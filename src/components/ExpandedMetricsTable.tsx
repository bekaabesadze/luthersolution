/**
 * ExpandedMetricsTable.tsx
 * Enhanced expanded view for Metrics Table with filtering, export, and additional columns.
 */

import { useState, useMemo } from "react";
import { ExpandedCard } from "./ExpandedCard";
import type { MetricsTableRow } from "./MetricsTable";
import type { MetricRow } from "../api/types";
import styles from "./ExpandedViews.module.css";

export interface ExpandedMetricsTableProps {
  tableData: MetricsTableRow[];
  metrics: MetricRow[];
  banks: string[];
  onClose: () => void;
}

const isDeposit = (name: string) => {
  return name.toLowerCase().includes("deposit");
};

const isLoan = (name: string) => {
  return name.toLowerCase().includes("loan") && !name.toLowerCase().includes("growth");
};

const isProfit = (name: string) => {
  return name.toLowerCase().includes("profit") || name.toLowerCase().includes("net income");
};

export function ExpandedMetricsTable({ tableData, metrics, banks, onClose }: ExpandedMetricsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBank, setSelectedBank] = useState<string>("");
  const [sortColumn, setSortColumn] = useState<keyof MetricsTableRow | "deposits" | "loans" | "netProfit">("year");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Enhance table data with additional metrics
  const enhancedData = useMemo(() => {
    return tableData.map((row) => {
      const rowMetrics = metrics.filter(
        (m) =>
          m.bank_id === row.bankName &&
          m.year === row.year &&
          m.quarter === row.quarter
      );

      let deposits = 0;
      let loans = 0;
      let netProfit = 0;

      rowMetrics.forEach((m) => {
        const name = (m.metric_name || "").toLowerCase();
        if (isDeposit(name)) deposits += m.value;
        else if (isLoan(name)) loans += m.value;
        else if (isProfit(name)) netProfit += m.value;
      });

      return {
        ...row,
        deposits,
        loans,
        netProfit,
      };
    });
  }, [tableData, metrics]);

  // Filter and sort
  const filteredAndSorted = useMemo(() => {
    let filtered = enhancedData.filter((row) => {
      const matchesSearch =
        searchTerm === "" ||
        row.bankName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(row.year).includes(searchTerm) ||
        String(row.quarter).includes(searchTerm) ||
        String(row.revenue).includes(searchTerm) ||
        String(row.growthPct).includes(searchTerm);

      const matchesBank = selectedBank === "" || row.bankName === selectedBank;

      return matchesSearch && matchesBank;
    });

    filtered.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      if (sortColumn === "deposits") {
        aVal = a.deposits;
        bVal = b.deposits;
      } else if (sortColumn === "loans") {
        aVal = a.loans;
        bVal = b.loans;
      } else if (sortColumn === "netProfit") {
        aVal = a.netProfit;
        bVal = b.netProfit;
      } else {
        aVal = a[sortColumn] as string | number;
        bVal = b[sortColumn] as string | number;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      const numA = Number(aVal);
      const numB = Number(bVal);

      return sortDirection === "asc" ? numA - numB : numB - numA;
    });

    return filtered;
  }, [enhancedData, searchTerm, selectedBank, sortColumn, sortDirection]);

  const handleSort = (column: keyof MetricsTableRow | "deposits" | "loans" | "netProfit") => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const handleExport = () => {
    const csv = [
      ["Bank", "Year", "Quarter", "Revenue", "Growth %", "Deposits", "Loans", "Net Profit"],
      ...filteredAndSorted.map((row) => [
        row.bankName,
        String(row.year),
        String(row.quarter),
        String(row.revenue),
        row.growthPct.toFixed(2),
        String(row.deposits),
        String(row.loans),
        String(row.netProfit),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bank_metrics.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ column }: { column: typeof sortColumn }) => {
    if (sortColumn !== column) return null;
    return <span>{sortDirection === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <ExpandedCard title="Bank Metrics - Detailed Table" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", height: "100%" }}>
        {/* Filters */}
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 300px" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: 600,
                marginBottom: "0.5rem",
                color: "var(--color-text-muted)",
              }}
            >
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search banks, years, quarters..."
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                background: "var(--color-surface-elevated)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--color-text)",
                fontSize: "0.875rem",
              }}
            />
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: 600,
                marginBottom: "0.5rem",
                color: "var(--color-text-muted)",
              }}
            >
              Filter by Bank
            </label>
            <select
              value={selectedBank}
              onChange={(e) => setSelectedBank(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                background: "var(--color-surface-elevated)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--color-text)",
                fontSize: "0.875rem",
              }}
            >
              <option value="">All banks</option>
              {banks.map((bank) => (
                <option key={bank} value={bank}>
                  {bank}
                </option>
              ))}
            </select>
          </div>
          <div>
            <button type="button" className={styles.exportButton} onClick={handleExport}>
              Export CSV
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <table className={styles.bankBreakdownTable}>
            <thead>
              <tr>
                <th
                  style={{ cursor: "pointer" }}
                  onClick={() => handleSort("bankName")}
                >
                  Bank <SortIcon column="bankName" />
                </th>
                <th
                  style={{ cursor: "pointer" }}
                  onClick={() => handleSort("year")}
                >
                  Year <SortIcon column="year" />
                </th>
                <th
                  style={{ cursor: "pointer" }}
                  onClick={() => handleSort("quarter")}
                >
                  Quarter <SortIcon column="quarter" />
                </th>
                <th
                  className={styles.num}
                  style={{ cursor: "pointer" }}
                  onClick={() => handleSort("revenue")}
                >
                  Revenue <SortIcon column="revenue" />
                </th>
                <th
                  className={styles.num}
                  style={{ cursor: "pointer" }}
                  onClick={() => handleSort("growthPct")}
                >
                  Growth % <SortIcon column="growthPct" />
                </th>
                <th
                  className={styles.num}
                  style={{ cursor: "pointer" }}
                  onClick={() => handleSort("deposits")}
                >
                  Deposits <SortIcon column="deposits" />
                </th>
                <th
                  className={styles.num}
                  style={{ cursor: "pointer" }}
                  onClick={() => handleSort("loans")}
                >
                  Loans <SortIcon column="loans" />
                </th>
                <th
                  className={styles.num}
                  style={{ cursor: "pointer" }}
                  onClick={() => handleSort("netProfit")}
                >
                  Net Profit <SortIcon column="netProfit" />
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-muted)" }}>
                    No data matches your filters
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map((row, i) => (
                  <tr key={`${row.bankName}-${row.year}-${row.quarter}-${i}`}>
                    <td>{row.bankName}</td>
                    <td>{row.year}</td>
                    <td>Q{row.quarter}</td>
                    <td className={styles.num}>{row.revenue.toLocaleString()}</td>
                    <td
                      className={`${styles.num} ${row.growthPct >= 0 ? styles.comparisonChangePositive : styles.comparisonChangeNegative
                        }`}
                    >
                      {row.growthPct >= 0 ? "+" : ""}
                      {row.growthPct.toFixed(1)}%
                    </td>
                    <td className={styles.num}>
                      {row.deposits > 0 ? row.deposits.toLocaleString() : "—"}
                    </td>
                    <td className={styles.num}>
                      {row.loans > 0 ? row.loans.toLocaleString() : "—"}
                    </td>
                    <td
                      className={`${styles.num} ${row.netProfit >= 0 ? styles.comparisonChangePositive : styles.comparisonChangeNegative
                        }`}
                    >
                      {row.netProfit !== 0 ? row.netProfit.toLocaleString() : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", paddingTop: "1rem", borderTop: "1px solid var(--color-border)" }}>
          Showing {filteredAndSorted.length} of {enhancedData.length} rows
        </div>
      </div>
    </ExpandedCard>
  );
}
