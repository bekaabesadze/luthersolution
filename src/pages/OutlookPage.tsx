import {
  type RefObject,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CustomSelect } from "../components/CustomSelect";
import { OutlookMetricChart } from "../components/OutlookMetricChart";
import { getBanks, getForecast } from "../api/client";
import type {
  ForecastMetricSeries,
  ForecastPeerRanking,
  ForecastPoint,
  ForecastResponse,
} from "../api/types";
import {
  defaultOutlookMetricId,
  getOutlookMetricDefinition,
  outlookMetricRegistry,
} from "../config/outlookMetricRegistry";
import { formatOutlookDelta, formatOutlookValue } from "../utils/outlookFormatting";
import {
  loadOutlookPreferences,
  saveOutlookPreferences,
  sanitizeOutlookPreferences,
  togglePeerSelection,
} from "../utils/outlookPreferences";
import styles from "./OutlookPage.module.css";

const FORECAST_HORIZON = 4;

interface OutlookPageContentProps {
  banks: string[];
  forecast: ForecastResponse | null;
  loading: boolean;
  error: string | null;
  selectedBankId: string;
  selectedMetricId: string;
  selectedPeerBankIds: string[];
  peerPickerOpen: boolean;
  peerPickerRef: RefObject<HTMLDivElement>;
  onBankChange: (value: string) => void;
  onMetricChange: (value: string) => void;
  onTogglePeerPicker: () => void;
  onPeerToggle: (peerBankId: string) => void;
  onClosePeerPicker: () => void;
}

function getLatestActualPoint(points: ForecastPoint[]): ForecastPoint | null {
  const latestActual = [...points].reverse().find((point) => !point.is_forecast);
  return latestActual ?? null;
}

function getPointByKey(points: ForecastPoint[], key: string): ForecastPoint | null {
  return points.find((point) => point.key === key) ?? null;
}

function buildDataQualityLine(
  forecast: ForecastResponse | null,
  selectedBankId: string,
  activeSeries: ForecastMetricSeries | null
): string {
  if (!forecast || !selectedBankId) {
    return "Select a bank to build the 4-quarter outlook.";
  }

  const readyMetrics = forecast.metric_series.filter((metric) => metric.status === "ready").length;
  const totalMetrics = forecast.metric_series.length;
  const activePeerCoverage = activeSeries
    ? activeSeries.peer_rankings.filter(
        (ranking) => ranking.bank_id !== selectedBankId && ranking.status === "ready"
      ).length
    : 0;

  if (activeSeries) {
    return `${readyMetrics} of ${totalMetrics} outlook metrics are forecast-ready for ${selectedBankId}. ${activePeerCoverage} peer${activePeerCoverage === 1 ? "" : "s"} contribute to the ${activeSeries.label.toLowerCase()} median.`;
  }

  return `${readyMetrics} of ${totalMetrics} outlook metrics are forecast-ready for ${selectedBankId}.`;
}

function buildMatrixRows(
  forecast: ForecastResponse | null,
  forecastPeriodKeys: string[]
): Array<{
  metricId: string;
  label: string;
  format: ForecastMetricSeries["format"];
  latestActual: number | null;
  qValues: Array<number | null>;
  peerMedian: number | null;
  deltaVsPeerMedian: number | null;
  status: string;
  unavailableReason: string | null;
}> {
  if (!forecast) return [];

  return forecast.metric_series.map((series) => {
    const latestActual = getLatestActualPoint(series.primary_points)?.value ?? null;
    const qValues = forecastPeriodKeys.map((key) => getPointByKey(series.primary_points, key)?.value ?? null);
    const peerMedian = forecastPeriodKeys.length
      ? getPointByKey(series.peer_median_points, forecastPeriodKeys[forecastPeriodKeys.length - 1])?.value ?? null
      : null;
    const lastProjected = qValues[qValues.length - 1] ?? null;

    return {
      metricId: series.metric_id,
      label: series.label,
      format: series.format,
      latestActual,
      qValues,
      peerMedian,
      deltaVsPeerMedian:
        lastProjected != null && peerMedian != null ? lastProjected - peerMedian : null,
      status: series.status,
      unavailableReason: series.unavailable_reason ?? null,
    };
  });
}

function buildUnavailableGroups(
  forecast: ForecastResponse | null
): Array<{ bankId: string; items: Array<{ metricId: string; label: string; reason: string }> }> {
  if (!forecast) return [];
  const grouped = new Map<string, Array<{ metricId: string; label: string; reason: string }>>();
  forecast.unavailable_metrics.forEach((item) => {
    const bucket = grouped.get(item.bank_id) ?? [];
    bucket.push({
      metricId: item.metric_id,
      label: item.label,
      reason: item.reason,
    });
    grouped.set(item.bank_id, bucket);
  });

  return Array.from(grouped.entries()).map(([bankId, items]) => ({
    bankId,
    items,
  }));
}

function rankToneClassName(ranking: ForecastPeerRanking): string {
  if (ranking.rank === 1 && ranking.projected_value != null) return styles.leaderboardRowTop;
  if (ranking.status !== "ready") return styles.leaderboardRowMuted;
  return "";
}

export function OutlookPageContent({
  banks,
  forecast,
  loading,
  error,
  selectedBankId,
  selectedMetricId,
  selectedPeerBankIds,
  peerPickerOpen,
  peerPickerRef,
  onBankChange,
  onMetricChange,
  onTogglePeerPicker,
  onPeerToggle,
  onClosePeerPicker,
}: OutlookPageContentProps) {
  const forecastPeriodKeys = useMemo(
    () => forecast?.forecast_periods.map((period) => period.key) ?? [],
    [forecast]
  );

  const activeSeries = useMemo(() => {
    if (!forecast) return null;
    return forecast.metric_series.find((series) => series.metric_id === selectedMetricId) ?? null;
  }, [forecast, selectedMetricId]);

  const bankOptions = useMemo(
    () => banks.map((bank) => ({ value: bank, label: bank })),
    [banks]
  );

  const metricOptions = useMemo(() => {
    if (!forecast) {
      return outlookMetricRegistry.map((metric) => ({ value: metric.id, label: metric.label }));
    }
    return forecast.metric_series.map((metric) => ({ value: metric.metric_id, label: metric.label }));
  }, [forecast]);

  const peerOptions = useMemo(
    () => banks.filter((bank) => bank !== selectedBankId),
    [banks, selectedBankId]
  );

  const matrixRows = useMemo(
    () => buildMatrixRows(forecast, forecastPeriodKeys),
    [forecast, forecastPeriodKeys]
  );

  const unavailableGroups = useMemo(
    () => buildUnavailableGroups(forecast),
    [forecast]
  );

  const activeMetricDefinition = useMemo(
    () => getOutlookMetricDefinition(selectedMetricId),
    [selectedMetricId]
  );

  const dataQualityLine = useMemo(
    () => buildDataQualityLine(forecast, selectedBankId, activeSeries),
    [forecast, selectedBankId, activeSeries]
  );

  return (
    <div className={styles.page}>
      <header className="page-header">
        <h2 className="page-title">Predictive Outlook</h2>
        <p className="page-description">
          Track the forward path for one bank against a curated peer set. The outlook keeps the
          current site language, but focuses the screen on what matters next: runway, peer position,
          and forecastable ratios backed by uploaded XBRL history.
        </p>
      </header>

      <section className={`card ${styles.filtersCard}`}>
        <div className={styles.filterGrid}>
          <label className={styles.filterLabel}>
            <span>Primary bank</span>
            <div className={styles.filterSelectWrap}>
              <CustomSelect
                value={selectedBankId}
                onChange={onBankChange}
                options={bankOptions}
                placeholder="Select bank"
                id="outlook-primary-bank"
              />
            </div>
          </label>

          <label className={styles.filterLabel}>
            <span>Metric lens</span>
            <div className={styles.filterSelectWrap}>
              <CustomSelect
                value={selectedMetricId}
                onChange={onMetricChange}
                options={metricOptions}
                placeholder="Select metric"
                id="outlook-metric"
              />
            </div>
          </label>

          <div className={styles.filterLabel}>
            <span>Peer group</span>
            <div ref={peerPickerRef} className={styles.peerPickerWrap}>
              <button
                type="button"
                className={`${styles.peerPickerTrigger} ${peerPickerOpen ? styles.peerPickerTriggerOpen : ""}`}
                onClick={onTogglePeerPicker}
              >
                <span>
                  {selectedPeerBankIds.length > 0
                    ? `${selectedPeerBankIds.length} peer${selectedPeerBankIds.length === 1 ? "" : "s"} selected`
                    : "Choose up to 4 peers"}
                </span>
                <span className={styles.peerPickerChevron} aria-hidden />
              </button>

              {peerPickerOpen && (
                <div className={styles.peerPickerPanel} role="dialog" aria-label="Peer selector">
                  <div className={styles.peerPickerHeader}>
                    <span>Manual peers</span>
                    <button type="button" className={styles.peerPickerClose} onClick={onClosePeerPicker}>
                      Close
                    </button>
                  </div>
                  <div className={styles.peerPickerList}>
                    {peerOptions.map((bankId) => {
                      const checked = selectedPeerBankIds.includes(bankId);
                      return (
                        <label key={bankId} className={styles.peerOption}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onPeerToggle(bankId)}
                          />
                          <span>{bankId}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className={styles.peerPickerHint}>
                    Peer medians and rankings update from the banks checked here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {selectedPeerBankIds.length > 0 && (
          <div className={styles.peerPills}>
            {selectedPeerBankIds.map((bankId) => (
              <button key={bankId} type="button" className={styles.peerPill} onClick={() => onPeerToggle(bankId)}>
                <span>{bankId}</span>
                <span className={styles.peerPillClose} aria-hidden>
                  ×
                </span>
              </button>
            ))}
          </div>
        )}

        <div className={styles.qualityRow}>
          <div className={styles.qualityBadge}>Data quality</div>
          <p className={styles.qualityCopy}>{dataQualityLine}</p>
          {forecast?.generated_at && (
            <span className={styles.qualityTimestamp}>
              Generated {new Date(forecast.generated_at).toLocaleString()}
            </span>
          )}
        </div>
      </section>

      {error && (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      )}

      {!selectedBankId && !loading && !error && (
        <section className={styles.emptyStateCard}>
          <h3 className={styles.emptyStateTitle}>Choose a bank to open the outlook</h3>
          <p className={styles.emptyStateCopy}>
            This view only forecasts metrics that can be defended from uploaded XBRL history. Pick a
            bank to populate the runway, peer rankings, and premium forecast matrix.
          </p>
        </section>
      )}

      {loading && (
        <section className={styles.loadingCard}>
          <div className={styles.loadingPulse} />
          <div className={styles.loadingCopy}>
            Building the executive outlook for {selectedBankId || "the selected bank"}…
          </div>
        </section>
      )}

      {!loading && !error && selectedBankId && forecast && (
        <>
          <section className={styles.runwayStrip}>
            {forecast.summary_cards.map((card) => (
              <article key={card.key} className={styles.runwayCard}>
                <div className={styles.runwayTop}>
                  <span className={styles.runwayEyebrow}>{card.quarter_label}</span>
                  <span className={styles.runwayPeriod}>{card.period_label}</span>
                </div>
                <div className={styles.runwayMetricList}>
                  <div className={styles.runwayMetric}>
                    <span>Deposit growth</span>
                    <strong>{formatOutlookValue(card.deposit_growth_pct != null ? card.deposit_growth_pct / 100 : null, "percent")}</strong>
                  </div>
                  <div className={styles.runwayMetric}>
                    <span>Loan growth</span>
                    <strong>{formatOutlookValue(card.loan_growth_pct != null ? card.loan_growth_pct / 100 : null, "percent")}</strong>
                  </div>
                  <div className={styles.runwayMetric}>
                    <span>Projected net profit</span>
                    <strong>{formatOutlookValue(card.net_profit, "currency", { compact: true })}</strong>
                  </div>
                  <div className={styles.runwayMetric}>
                    <span>Loan / deposit</span>
                    <strong>{formatOutlookValue(card.loan_to_deposit_ratio, "percent")}</strong>
                  </div>
                </div>
                <span className={`${styles.runwayStatus} ${styles[`runwayStatus${card.status[0].toUpperCase()}${card.status.slice(1)}`] || ""}`}>
                  {card.status}
                </span>
              </article>
            ))}
          </section>

          <section className={styles.analyticsGrid}>
            <article className={styles.chartCard}>
              <div className={styles.cardHeader}>
                <div>
                  <h3 className={styles.cardTitle}>
                    {activeSeries?.label || activeMetricDefinition?.label || "Metric"} outlook
                  </h3>
                  <p className={styles.cardSubtitle}>
                    Solid line = actuals. Dashed line = forecast. Band = 80% confidence range. Muted line = peer median.
                  </p>
                </div>
                <div className={styles.cardMeta}>
                  <span className={styles.metaPill}>4-quarter horizon</span>
                  <span className={styles.metaPill}>
                    {activeSeries?.status === "ready" ? "Forecast ready" : "History thin"}
                  </span>
                </div>
              </div>
              <OutlookMetricChart series={activeSeries} />
            </article>

            <aside className={styles.leaderboardCard}>
              <div className={styles.cardHeader}>
                <div>
                  <h3 className={styles.cardTitle}>Peer ranking</h3>
                  <p className={styles.cardSubtitle}>
                    Sorted by projected Q+4 value for {activeSeries?.label || "the active metric"}.
                  </p>
                </div>
              </div>

              {activeSeries?.peer_rankings?.length ? (
                <div className={styles.leaderboardRows}>
                  {activeSeries.peer_rankings.map((ranking) => (
                    <div
                      key={ranking.bank_id}
                      className={`${styles.leaderboardRow} ${rankToneClassName(ranking)}`}
                    >
                      <div className={styles.leaderboardRank}>{ranking.rank}</div>
                      <div className={styles.leaderboardBank}>
                        <span className={styles.leaderboardBankName}>{ranking.bank_id}</span>
                        <span className={styles.leaderboardStatus}>{ranking.status}</span>
                      </div>
                      <div className={styles.leaderboardValueBlock}>
                        <span>{formatOutlookValue(ranking.projected_value, activeSeries.format, { compact: true })}</span>
                        <span className={styles.leaderboardDelta}>
                          {ranking.change_pct != null ? `${ranking.change_pct > 0 ? "+" : ""}${ranking.change_pct.toFixed(1)}%` : "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyPanelCopy}>
                  Add peers to compare the selected bank against the field.
                </p>
              )}
            </aside>
          </section>

          <section className={styles.matrixCard}>
            <div className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardTitle}>Forecast matrix</h3>
                <p className={styles.cardSubtitle}>
                  Latest actuals on the left, projected quarters through Q+4 on the right.
                </p>
              </div>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.matrixTable}>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Latest actual</th>
                    {forecast.forecast_periods.map((period) => (
                      <th key={period.key}>{period.relative_label || period.label}</th>
                    ))}
                    <th>Vs peer median</th>
                  </tr>
                </thead>
                <tbody>
                  {matrixRows.map((row) => (
                    <tr key={row.metricId} className={row.status !== "ready" ? styles.matrixRowMuted : ""}>
                      <td>
                        <div className={styles.matrixMetricCell}>
                          <strong>{row.label}</strong>
                          {row.unavailableReason && <span>{row.unavailableReason}</span>}
                        </div>
                      </td>
                      <td>{formatOutlookValue(row.latestActual, row.format, { compact: true })}</td>
                      {row.qValues.map((value, index) => (
                        <td key={`${row.metricId}-${forecastPeriodKeys[index]}`}>
                          {formatOutlookValue(value, row.format, { compact: true })}
                        </td>
                      ))}
                      <td>
                        <div className={styles.peerDeltaCell}>
                          <strong>{formatOutlookDelta(row.deltaVsPeerMedian, row.format)}</strong>
                          <span>{formatOutlookValue(row.peerMedian, row.format, { compact: true })}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.eligibilityCard}>
            <div className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardTitle}>Eligibility and thin-history notes</h3>
                <p className={styles.cardSubtitle}>
                  Metrics stay blank when the historical sample is too thin to defend a projection.
                </p>
              </div>
            </div>

            {unavailableGroups.length > 0 ? (
              <div className={styles.eligibilityGroups}>
                {unavailableGroups.map((group) => (
                  <div key={group.bankId} className={styles.eligibilityGroup}>
                    <h4 className={styles.eligibilityBank}>{group.bankId}</h4>
                    <ul className={styles.eligibilityList}>
                      {group.items.map((item) => (
                        <li key={`${group.bankId}-${item.metricId}`} className={styles.eligibilityItem}>
                          <strong>{item.label}</strong>
                          <span>{item.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.emptyPanelCopy}>
                All supported metrics currently have enough history to build a forward view.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export function OutlookPage() {
  const [banks, setBanks] = useState<string[]>([]);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState(() => loadOutlookPreferences());
  const [peerPickerOpen, setPeerPickerOpen] = useState(false);
  const peerPickerRef = useRef<HTMLDivElement>(null);
  const deferredMetricId = useDeferredValue(preferences.metricId);

  useEffect(() => {
    saveOutlookPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    const loadBanks = async () => {
      try {
        const response = await getBanks();
        const nextBanks = response.banks.slice().sort((a, b) => a.localeCompare(b));
        setBanks(nextBanks);
        setPreferences((current) => {
          const sanitized = sanitizeOutlookPreferences(current);
          const fallbackBankId = nextBanks[0] ?? "";
          const primaryBankId =
            sanitized.primaryBankId && nextBanks.includes(sanitized.primaryBankId)
              ? sanitized.primaryBankId
              : fallbackBankId;
          return sanitizeOutlookPreferences({
            ...sanitized,
            primaryBankId,
          });
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load banks");
      }
    };

    loadBanks();
  }, []);

  useEffect(() => {
    if (!preferences.primaryBankId) {
      setLoading(false);
      setForecast(null);
      return;
    }

    let cancelled = false;
    const loadForecast = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getForecast({
          primary_bank_id: preferences.primaryBankId,
          peer_bank_ids: preferences.peerBankIds,
          horizon_quarters: FORECAST_HORIZON,
        });
        if (!cancelled) {
          setForecast(response);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load predictive outlook");
          setForecast(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadForecast();
    return () => {
      cancelled = true;
    };
  }, [preferences.primaryBankId, preferences.peerBankIds]);

  useEffect(() => {
    if (!forecast) return;
    const hasMetric = forecast.metric_series.some((series) => series.metric_id === deferredMetricId);
    if (hasMetric) return;
    const nextMetricId = forecast.metric_series[0]?.metric_id ?? defaultOutlookMetricId;
    setPreferences((current) => ({ ...current, metricId: nextMetricId }));
  }, [forecast, deferredMetricId]);

  useEffect(() => {
    if (!peerPickerOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (peerPickerRef.current && !peerPickerRef.current.contains(event.target as Node)) {
        setPeerPickerOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPeerPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [peerPickerOpen]);

  const handleBankChange = useCallback((bankId: string) => {
    setPreferences((current) =>
      sanitizeOutlookPreferences({
        ...current,
        primaryBankId: bankId,
        peerBankIds: current.peerBankIds.filter((peerBankId) => peerBankId !== bankId),
      })
    );
  }, []);

  const handleMetricChange = useCallback((metricId: string) => {
    setPreferences((current) => ({
      ...current,
      metricId,
    }));
  }, []);

  const handlePeerToggle = useCallback((peerBankId: string) => {
    setPreferences((current) =>
      sanitizeOutlookPreferences({
        ...current,
        peerBankIds: togglePeerSelection(current.peerBankIds, peerBankId),
      })
    );
  }, []);

  return (
    <OutlookPageContent
      banks={banks}
      forecast={forecast}
      loading={loading}
      error={error}
      selectedBankId={preferences.primaryBankId}
      selectedMetricId={deferredMetricId}
      selectedPeerBankIds={preferences.peerBankIds}
      peerPickerOpen={peerPickerOpen}
      peerPickerRef={peerPickerRef}
      onBankChange={handleBankChange}
      onMetricChange={handleMetricChange}
      onTogglePeerPicker={() => setPeerPickerOpen((open) => !open)}
      onPeerToggle={handlePeerToggle}
      onClosePeerPicker={() => setPeerPickerOpen(false)}
    />
  );
}
