/**
 * api/client.ts
 * Central HTTP client for the FastAPI backend. Uses fetch for all requests.
 * Base URL: VITE_API_BASE_URL, else production build uses the Render API host, else localhost.
 * All functions throw on network error or non-2xx response; callers handle loading and error states.
 */

import type {
  MetricsResponse,
  MetricsParams,
  BanksResponse,
  QuartersResponse,
  UploadResponse,
  DeleteUploadResponse,
  LoginResponse,
  ForecastRequest,
  ForecastResponse,
} from "./types";

const PRODUCTION_API_BASE = "https://luthersolution.onrender.com";

function getBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (fromEnv) return fromEnv;
  if (import.meta.env.PROD) return PRODUCTION_API_BASE;
  return "http://localhost:8001";
}

function getAuthHeader(): { Authorization: string } | {} {
  const token = localStorage.getItem("admin_token");
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

/**
 * POST /token: login to receive a JWT token.
 */
export async function login(password: string): Promise<LoginResponse> {
  const formData = new URLSearchParams();
  formData.append("username", "admin"); // Required by OAuth2PasswordRequestForm, even though backend ignores it
  formData.append("password", password);

  const res = await fetch(`${getBaseUrl()}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(formatErrorDetail(data.detail) || `Login failed (${res.status})`);
  }

  // Store token upon successful login
  if (data.access_token) {
    localStorage.setItem("admin_token", data.access_token);
    // Dispatch event so other components (like Sidebar) can update immediately
    window.dispatchEvent(new Event("auth-change"));
  }

  return data as LoginResponse;
}

export function logout() {
  localStorage.removeItem("admin_token");
  window.dispatchEvent(new Event("auth-change"));
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
      headers: {
        ...getAuthHeader(),
      },
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
    headers: {
      ...getAuthHeader(),
    },
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
    headers: {
      ...getAuthHeader(),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(formatErrorDetail(data.detail) || `Delete failed (${res.status})`);
  }
  return data as DeleteUploadResponse;
}

/**
 * POST /forecast: build a predictive outlook for a primary bank and optional peers.
 */
export async function getForecast(payload: ForecastRequest): Promise<ForecastResponse> {
  const res = await fetch(`${getBaseUrl()}/forecast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        "The predictive outlook API is not available on the deployed backend yet. Redeploy the backend service so /forecast exists."
      );
    }
    throw new Error(formatErrorDetail(data.detail) || `Failed to load forecast (${res.status})`);
  }

  return data as ForecastResponse;
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
