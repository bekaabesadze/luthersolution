/**
 * sampleData.ts
 * Placeholder data for charts and tables when no uploaded data exists.
 * Used by Dashboard and Reports for a professional first impression.
 */

export interface QuarterMetric {
  bankId: string;
  bankName: string;
  year: number;
  quarter: number;
  revenue: number;
  growthPct: number;
  metricName?: string;
  value?: number;
}

/** Sample revenue by bank (for bar chart) */
export const sampleRevenueByBank = [
  { bank: "Bank A", revenue: 1240 },
  { bank: "Bank B", revenue: 980 },
  { bank: "Bank C", revenue: 1120 },
  { bank: "Bank D", revenue: 860 },
  { bank: "Bank E", revenue: 750 },
];

/** Sample quarterly growth (for line chart) */
export const sampleQuarterlyGrowth = [
  { quarter: "Q1 2024", growth: 2.1 },
  { quarter: "Q2 2024", growth: 2.8 },
  { quarter: "Q3 2024", growth: 1.9 },
  { quarter: "Q4 2024", growth: 3.2 },
  { quarter: "Q1 2025", growth: 2.5 },
];

/** Sample table rows: bank metrics by quarter */
export const sampleMetricsByQuarter: QuarterMetric[] = [
  { bankId: "A", bankName: "Bank A", year: 2024, quarter: 1, revenue: 310, growthPct: 2.0 },
  { bankId: "A", bankName: "Bank A", year: 2024, quarter: 2, revenue: 318, growthPct: 2.6 },
  { bankId: "A", bankName: "Bank A", year: 2024, quarter: 3, revenue: 305, growthPct: 1.8 },
  { bankId: "A", bankName: "Bank A", year: 2024, quarter: 4, revenue: 307, growthPct: 3.1 },
  { bankId: "B", bankName: "Bank B", year: 2024, quarter: 1, revenue: 245, growthPct: 1.5 },
  { bankId: "B", bankName: "Bank B", year: 2024, quarter: 2, revenue: 248, growthPct: 2.2 },
  { bankId: "B", bankName: "Bank B", year: 2024, quarter: 3, revenue: 242, growthPct: 1.4 },
  { bankId: "B", bankName: "Bank B", year: 2024, quarter: 4, revenue: 246, growthPct: 2.8 },
  { bankId: "C", bankName: "Bank C", year: 2024, quarter: 1, revenue: 280, growthPct: 2.4 },
  { bankId: "C", bankName: "Bank C", year: 2024, quarter: 2, revenue: 285, growthPct: 3.0 },
  { bankId: "C", bankName: "Bank C", year: 2024, quarter: 3, revenue: 278, growthPct: 1.9 },
  { bankId: "C", bankName: "Bank C", year: 2024, quarter: 4, revenue: 277, growthPct: 2.5 },
];
