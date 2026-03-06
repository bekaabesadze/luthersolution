/**
 * FilesPage.tsx
 * File browser organized by year and quarter folders.
 * Shows uploaded data in a hierarchical folder structure for easy navigation.
 */

import { useState, useEffect, useCallback } from "react";
import { deleteUpload, getBanks, getQuarters, getMetrics } from "../api/client";
import styles from "./FilesPage.module.css";

interface FileEntry {
  bank_id: string;
  year: number;
  quarter: number;
  metrics: Array<{
    metric_name: string;
    value: number;
  }>;
}

type SortBy = "year" | "bank";
type YearOrder = "newest" | "oldest";

export function FilesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState<number | null>(null);
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("year");
  const [yearOrder, setYearOrder] = useState<YearOrder>("newest");
  const [filesByYearQuarter, setFilesByYearQuarter] = useState<
    Map<string, FileEntry[]>
  >(new Map());

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [_banksRes, _quartersRes, metricsRes] = await Promise.all([
        getBanks(),
        getQuarters(),
        getMetrics(),
      ]);

      // Group metrics by year/quarter/bank
      const grouped = new Map<string, FileEntry[]>();

      for (const metric of metricsRes.metrics) {
        const key = `${metric.year}-Q${metric.quarter}`;
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }

        const entries = grouped.get(key)!;
        let entry = entries.find((e) => e.bank_id === metric.bank_id);

        if (!entry) {
          entry = {
            bank_id: metric.bank_id,
            year: metric.year,
            quarter: metric.quarter,
            metrics: [],
          };
          entries.push(entry);
        }

        entry.metrics.push({
          metric_name: metric.metric_name,
          value: metric.value,
        });
      }

      setFilesByYearQuarter(grouped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDelete = async (entry: FileEntry) => {
    const ok = window.confirm(
      `Delete upload for "${entry.bank_id}" ${entry.year} Q${entry.quarter}?\n\nThis will remove the stored metrics for that bank/year/quarter.`
    );
    if (!ok) return;

    try {
      setLoading(true);
      await deleteUpload(entry.bank_id, entry.year, entry.quarter);
      await loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete upload");
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const years = Array.from(
    new Set(
      Array.from(filesByYearQuarter.keys()).map((key) =>
        parseInt(key.split("-")[0])
      )
    )
  ).sort((a, b) => (yearOrder === "newest" ? b - a : a - b));

  // When sorting by bank: group FileEntry by bank_id
  const filesByBank = (() => {
    const map = new Map<string, FileEntry[]>();
    for (const entries of filesByYearQuarter.values()) {
      for (const entry of entries) {
        const list = map.get(entry.bank_id) ?? [];
        if (!list.length) map.set(entry.bank_id, list);
        list.push(entry);
      }
    }
    // Sort each bank's entries by year desc, then quarter desc
    for (const list of map.values()) {
      list.sort((a, b) =>
        a.year !== b.year ? b.year - a.year : b.quarter - a.quarter
      );
    }
    return map;
  })();
  const bankIds = Array.from(filesByBank.keys()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  const getQuartersForYear = (year: number) => {
    return Array.from(filesByYearQuarter.keys())
      .filter((key) => key.startsWith(`${year}-`))
      .map((key) => parseInt(key.split("Q")[1]))
      .sort((a, b) => b - a);
  };

  const getFilesForYearQuarter = (year: number, quarter: number) => {
    const key = `${year}-Q${quarter}`;
    return filesByYearQuarter.get(key) || [];
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingWrap}>
          <p>
            <span className={styles.loadingSpinner} aria-hidden />
            Loading files…
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.errorWrap}>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div style={{ marginBottom: '1.75rem' }}>
        <div className={styles.tabBar}>
          <div className={styles.tabs} role="tablist" aria-label="View by">
            <button
              type="button"
              role="tab"
              aria-selected={sortBy === "year"}
              aria-controls="files-by-year"
              id="tab-year"
              className={sortBy === "year" ? styles.tabActive : styles.tab}
              onClick={() => setSortBy("year")}
            >
              Year
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sortBy === "bank"}
              aria-controls="files-by-bank"
              id="tab-bank"
              className={sortBy === "bank" ? styles.tabActive : styles.tab}
              onClick={() => setSortBy("bank")}
            >
              Bank
            </button>
          </div>
          {sortBy === "year" && (
            <div className={styles.yearOrder}>
              <button
                type="button"
                className={yearOrder === "newest" ? styles.yearOrderActive : styles.yearOrderBtn}
                onClick={() => setYearOrder("newest")}
              >
                Newest first
              </button>
              <button
                type="button"
                className={yearOrder === "oldest" ? styles.yearOrderActive : styles.yearOrderBtn}
                onClick={() => setYearOrder("oldest")}
              >
                Oldest first
              </button>
            </div>
          )}
        </div>
      </div>

      {years.length === 0 && bankIds.length === 0 ? (
        <div className={styles.emptyCard}>
          <div className={styles.empty}>
            <p>No files uploaded yet.</p>
            <p className={styles.sub}>
              Go to <a href="/upload">Upload Data</a> to add files.
            </p>
          </div>
        </div>
      ) : sortBy === "bank" ? (
        <div id="files-by-bank" role="tabpanel" aria-labelledby="tab-bank" className={styles.folderStructure}>
          {bankIds.map((bankId) => {
            const entries = filesByBank.get(bankId) ?? [];
            return (
              <div key={bankId} className={styles.yearFolder}>
                <button
                  className={styles.folderButton}
                  onClick={() =>
                    setSelectedBank(selectedBank === bankId ? null : bankId)
                  }
                  aria-expanded={selectedBank === bankId}
                >
                  <span className={styles.folderChevron} aria-hidden />
                  <span className={styles.folderIcon}>
                    {selectedBank === bankId ? "📂" : "📁"}
                  </span>
                  <span className={styles.folderName}>{bankId}</span>
                  <span className={styles.folderCount}>
                    ({entries.length} file{entries.length !== 1 ? "s" : ""})
                  </span>
                </button>
                {selectedBank === bankId && (
                  <div className={styles.fileList}>
                    {entries.map((file, idx) => (
                      <div key={idx} className={styles.fileCard}>
                        <div className={styles.fileHeader}>
                          <h4 className={styles.fileName}>{file.bank_id}</h4>
                          <div className={styles.fileHeaderRight}>
                            <span className={styles.fileMeta}>
                              {file.year} Q{file.quarter}
                            </span>
                            <button
                              type="button"
                              className={styles.deleteButton}
                              onClick={() => handleDelete(file)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <div className={styles.metricsList}>
                          {file.metrics.map((metric, mIdx) => (
                            <div key={mIdx} className={styles.metric}>
                              <span className={styles.metricName}>
                                {metric.metric_name.replace(/_/g, " ")}
                              </span>
                              <span className={styles.metricValue}>
                                {metric.value.toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div id="files-by-year" role="tabpanel" aria-labelledby="tab-year" className={styles.folderStructure}>
          {years.map((year) => (
            <div key={year} className={styles.yearFolder}>
              <button
                className={styles.folderButton}
                onClick={() =>
                  setSelectedYear(selectedYear === year ? null : year)
                }
                aria-expanded={selectedYear === year}
              >
                <span className={styles.folderChevron} aria-hidden />
                <span className={styles.folderIcon}>
                  {selectedYear === year ? "📂" : "📁"}
                </span>
                <span className={styles.folderName}>{year}</span>
                <span className={styles.folderCount}>
                  ({getQuartersForYear(year).length} quarter
                  {getQuartersForYear(year).length !== 1 ? "s" : ""})
                </span>
              </button>

              {selectedYear === year && (
                <div className={styles.quarterList}>
                  {getQuartersForYear(year).map((quarter) => {
                    const files = getFilesForYearQuarter(year, quarter);
                    return (
                      <div key={quarter} className={styles.quarterFolder}>
                        <button
                          className={styles.folderButton}
                          onClick={() =>
                            setSelectedQuarter(
                              selectedQuarter === quarter ? null : quarter
                            )
                          }
                          aria-expanded={selectedQuarter === quarter}
                        >
                          <span className={styles.folderChevron} aria-hidden />
                          <span className={styles.folderIcon}>
                            {selectedQuarter === quarter ? "📂" : "📁"}
                          </span>
                          <span className={styles.folderName}>
                            Q{quarter}
                          </span>
                          <span className={styles.folderCount}>
                            ({files.length} file{files.length !== 1 ? "s" : ""})
                          </span>
                        </button>

                        {selectedQuarter === quarter && (
                          <div className={styles.fileList}>
                            {files.length === 0 ? (
                              <div className={styles.empty}>
                                No files for this quarter
                              </div>
                            ) : (
                              files.map((file, idx) => (
                                <div key={idx} className={styles.fileCard}>
                                  <div className={styles.fileHeader}>
                                    <h4 className={styles.fileName}>
                                      {file.bank_id}
                                    </h4>
                                    <div className={styles.fileHeaderRight}>
                                      <span className={styles.fileMeta}>
                                        {file.year} Q{file.quarter}
                                      </span>
                                      <button
                                        type="button"
                                        className={styles.deleteButton}
                                        onClick={() => handleDelete(file)}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                  <div className={styles.metricsList}>
                                    {file.metrics.map((metric, mIdx) => (
                                      <div key={mIdx} className={styles.metric}>
                                        <span className={styles.metricName}>
                                          {metric.metric_name.replace(/_/g, " ")}
                                        </span>
                                        <span className={styles.metricValue}>
                                          {metric.value.toLocaleString()}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
