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

/** Optional query params for GET /metrics */
export interface MetricsParams {
  bank_id?: string;
  year?: number;
  quarter?: number;
}
