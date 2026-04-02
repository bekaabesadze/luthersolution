import type { ForecastMetricSeries } from "../api/types";

export type DisplayMetricFormat = ForecastMetricSeries["format"];

export function formatOutlookValue(
  value: number | null | undefined,
  format: DisplayMetricFormat,
  options?: { compact?: boolean; decimals?: number }
): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }

  if (format === "percent") {
    const decimals = options?.decimals ?? 1;
    return `${(value * 100).toFixed(decimals)}%`;
  }

  if (format === "currency") {
    if (options?.compact) {
      const absolute = Math.abs(value);
      if (absolute >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
      if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
      if (absolute >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: value >= 100 ? 0 : 2,
    }).format(value);
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: options?.decimals ?? 2,
  }).format(value);
}

export function formatOutlookDelta(
  value: number | null | undefined,
  format: DisplayMetricFormat
): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  const prefix = value > 0 ? "+" : "";
  if (format === "percent") {
    return `${prefix}${(value * 100).toFixed(1)} pts`;
  }
  if (format === "currency") {
    return `${prefix}${formatOutlookValue(value, format, { compact: true })}`;
  }
  return `${prefix}${formatOutlookValue(value, format)}`;
}
