/**
 * api/client.ts
 * Central HTTP client for the FastAPI backend. Uses fetch for all requests.
 * Base URL is read from VITE_API_BASE_URL (default http://localhost:8000).
 * All functions throw on network error or non-2xx response; callers handle loading and error states.
 */

import type {
  MetricsResponse,
  MetricsParams,
  BanksResponse,
  QuartersResponse,
  UploadResponse,
  DeleteUploadResponse,
} from "./types";

function getBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
}

/**
 * POST /upload: send an XBRL file for processing.
 * Returns { message, rows_stored }. Throws on failure (network or 4xx/5xx).
 */
export async function uploadFile(
  file: File,
  bankName: string,
  year: number,
  quarter: number
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("bank_name", bankName);
  formData.append("year", year.toString());
  formData.append("quarter", quarter.toString());

  const baseUrl = getBaseUrl();

  try {
    const res = await fetch(`${baseUrl}/upload`, {
      method: "POST",
      body: formData,
    });

    // Try to parse JSON response
    let data: any = {};
    try {
      const text = await res.text();
      if (text) {
        data = JSON.parse(text);
      }
    } catch {
      // If JSON parsing fails, use empty object
    }

    if (!res.ok) {
      const message = formatErrorDetail(data.detail);
      throw new Error(message || `Upload failed (${res.status})`);
    }

    return data as UploadResponse;
  } catch (err) {
    // Handle network errors (connection refused, CORS, etc.)
    if (err instanceof TypeError && err.message.includes("fetch")) {
      throw new Error(
        `Cannot connect to backend at ${baseUrl}. Make sure the backend server is running on port 8000.`
      );
    }
    // Re-throw other errors (including our own Error from above)
    throw err;
  }
}

/**
 * GET /banks: list distinct bank identifiers for dashboard filters.
 */
export async function getBanks(): Promise<BanksResponse> {
  const res = await fetch(`${getBaseUrl()}/banks`);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(formatErrorDetail(data.detail) || `Failed to load banks (${res.status})`);
  }

  return data as BanksResponse;
}

/**
 * GET /quarters: list distinct (year, quarter) pairs for dashboard filters.
 */
export async function getQuarters(): Promise<QuartersResponse> {
  const res = await fetch(`${getBaseUrl()}/quarters`);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(formatErrorDetail(data.detail) || `Failed to load quarters (${res.status})`);
  }

  return data as QuartersResponse;
}

/**
 * GET /metrics: fetch metrics with optional filters. Used to populate dashboard charts and table.
 */
export async function getMetrics(params?: MetricsParams): Promise<MetricsResponse> {
  const search = new URLSearchParams();
  if (params?.bank_id) search.set("bank_id", params.bank_id);
  if (params?.year != null) search.set("year", String(params.year));
  if (params?.quarter != null) search.set("quarter", String(params.quarter));

  const url = `${getBaseUrl()}/metrics${search.toString() ? `?${search.toString()}` : ""}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(formatErrorDetail(data.detail) || `Failed to load metrics (${res.status})`);
  }

  return data as MetricsResponse;
}

/**
 * POST /upload-camel-excel: upload WSB Performance Dashboard Excel; stores CAMEL metrics.
 */
export async function uploadCamelExcel(
  file: File,
  bankName?: string
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  if (bankName?.trim()) formData.append("bank_name", bankName.trim());

  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/upload-camel-excel`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(formatErrorDetail(data.detail) || `CAMEL Excel upload failed (${res.status})`);
  }
  return data as UploadResponse;
}

/**
 * DELETE /upload: delete an uploaded dataset (bank + year + quarter).
 */
export async function deleteUpload(
  bankName: string,
  year: number,
  quarter: number
): Promise<DeleteUploadResponse> {
  const baseUrl = getBaseUrl();
  const search = new URLSearchParams();
  search.set("bank_name", bankName);
  search.set("year", String(year));
  search.set("quarter", String(quarter));

  const res = await fetch(`${baseUrl}/upload?${search.toString()}`, {
    method: "DELETE",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(formatErrorDetail(data.detail) || `Delete failed (${res.status})`);
  }
  return data as DeleteUploadResponse;
}

/** Normalize backend error detail (string or array of { msg } from validation). */
function formatErrorDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (first && typeof first === "object" && "msg" in first) return String((first as { msg: string }).msg);
  }
  return "";
}
