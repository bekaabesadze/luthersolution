/**
 * api/types.ts
 * TypeScript types for FastAPI backend responses.
 * Keeps frontend and backend contracts in sync.
 */

/** Single metric row from GET /metrics */
export interface MetricRow {
  id: number;
  bank_id: string;
  year: number;
  quarter: number;
  metric_name: string;
  value: number;
}

/** Response from GET /metrics */
export interface MetricsResponse {
  metrics: MetricRow[];
  count: number;
}

/** Response from GET /banks */
export interface BanksResponse {
  banks: string[];
}

/** Response from GET /quarters */
export interface QuartersResponse {
  quarters: { year: number; quarter: number }[];
}

/** Response from POST /upload */
export interface UploadResponse {
  message: string;
  rows_stored: number;
}

/** Response from DELETE /upload */
export interface DeleteUploadResponse {
  message: string;
  rows_deleted: number;
}

/** Response from POST /token */
export interface LoginResponse {
  access_token: string;
  token_type: string;
}

/** Optional query params for GET /metrics */
export interface MetricsParams {
  bank_id?: string;
  year?: number;
  quarter?: number;
}

export interface ForecastRequest {
  primary_bank_id: string;
  peer_bank_ids: string[];
  horizon_quarters: number;
}

export interface ForecastPeriod {
  year: number;
  quarter: number;
  key: string;
  label: string;
  relative_label?: string | null;
}

export interface ForecastSummaryCard extends ForecastPeriod {
  quarter_label: string;
  period_label: string;
  deposit_growth_pct: number | null;
  loan_growth_pct: number | null;
  net_profit: number | null;
  loan_to_deposit_ratio: number | null;
  status: string;
}

export interface ForecastPoint extends ForecastPeriod {
  value: number | null;
  lower: number | null;
  upper: number | null;
  is_forecast: boolean;
}

export interface ForecastPeerRanking {
  bank_id: string;
  rank: number;
  latest_actual: number | null;
  projected_value: number | null;
  change_pct: number | null;
  status: string;
  unavailable_reason?: string | null;
}

export interface ForecastMetricSeries {
  metric_id: string;
  label: string;
  format: "currency" | "percent" | "number";
  status: string;
  unavailable_reason?: string | null;
  primary_points: ForecastPoint[];
  peer_median_points: ForecastPoint[];
  peer_rankings: ForecastPeerRanking[];
}

export interface ForecastUnavailableMetric {
  bank_id: string;
  metric_id: string;
  label: string;
  reason: string;
}

export interface ForecastResponse {
  generated_at: string;
  primary_bank_id: string;
  peer_bank_ids: string[];
  history_periods: ForecastPeriod[];
  forecast_periods: ForecastPeriod[];
  summary_cards: ForecastSummaryCard[];
  metric_series: ForecastMetricSeries[];
  unavailable_metrics: ForecastUnavailableMetric[];
}
