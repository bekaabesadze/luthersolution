import { type ComponentProps, createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ForecastResponse } from "../api/types";
import { OutlookPageContent } from "./OutlookPage";

vi.mock("../components/OutlookMetricChart", () => ({
  OutlookMetricChart: () => <div>Outlook chart mock</div>,
}));

function renderContent(overrides: Partial<ComponentProps<typeof OutlookPageContent>> = {}) {
  return renderToStaticMarkup(
    <OutlookPageContent
      banks={["Alpha Bank", "Bravo Bank"]}
      forecast={null}
      loading={false}
      error={null}
      selectedBankId="Alpha Bank"
      selectedMetricId="deposits"
      selectedPeerBankIds={[]}
      peerPickerOpen={false}
      peerPickerRef={createRef<HTMLDivElement>()}
      onBankChange={() => {}}
      onMetricChange={() => {}}
      onTogglePeerPicker={() => {}}
      onPeerToggle={() => {}}
      onClosePeerPicker={() => {}}
      {...overrides}
    />
  );
}

const baseForecast: ForecastResponse = {
  generated_at: "2026-04-02T12:00:00Z",
  primary_bank_id: "Alpha Bank",
  peer_bank_ids: ["Bravo Bank"],
  history_periods: [
    { year: 2025, quarter: 3, key: "2025-Q3", label: "2025 Q3", relative_label: null },
    { year: 2025, quarter: 4, key: "2025-Q4", label: "2025 Q4", relative_label: null },
  ],
  forecast_periods: [
    { year: 2026, quarter: 1, key: "2026-Q1", label: "2026 Q1", relative_label: "Q+1" },
    { year: 2026, quarter: 2, key: "2026-Q2", label: "2026 Q2", relative_label: "Q+2" },
    { year: 2026, quarter: 3, key: "2026-Q3", label: "2026 Q3", relative_label: "Q+3" },
    { year: 2026, quarter: 4, key: "2026-Q4", label: "2026 Q4", relative_label: "Q+4" },
  ],
  summary_cards: [
    {
      year: 2026,
      quarter: 1,
      key: "2026-Q1",
      label: "2026 Q1",
      relative_label: "Q+1",
      quarter_label: "Q+1",
      period_label: "2026 Q1",
      deposit_growth_pct: 4.1,
      loan_growth_pct: 2.6,
      net_profit: 4_150_000,
      loan_to_deposit_ratio: 0.72,
      status: "ready",
    },
    {
      year: 2026,
      quarter: 2,
      key: "2026-Q2",
      label: "2026 Q2",
      relative_label: "Q+2",
      quarter_label: "Q+2",
      period_label: "2026 Q2",
      deposit_growth_pct: 4.0,
      loan_growth_pct: 2.5,
      net_profit: 4_240_000,
      loan_to_deposit_ratio: 0.73,
      status: "ready",
    },
    {
      year: 2026,
      quarter: 3,
      key: "2026-Q3",
      label: "2026 Q3",
      relative_label: "Q+3",
      quarter_label: "Q+3",
      period_label: "2026 Q3",
      deposit_growth_pct: 3.9,
      loan_growth_pct: 2.4,
      net_profit: 4_320_000,
      loan_to_deposit_ratio: 0.73,
      status: "ready",
    },
    {
      year: 2026,
      quarter: 4,
      key: "2026-Q4",
      label: "2026 Q4",
      relative_label: "Q+4",
      quarter_label: "Q+4",
      period_label: "2026 Q4",
      deposit_growth_pct: 3.8,
      loan_growth_pct: 2.3,
      net_profit: 4_410_000,
      loan_to_deposit_ratio: 0.74,
      status: "ready",
    },
  ],
  metric_series: [
    {
      metric_id: "deposits",
      label: "Deposits",
      format: "currency",
      status: "ready",
      unavailable_reason: null,
      primary_points: [
        { year: 2025, quarter: 3, key: "2025-Q3", label: "2025 Q3", value: 120_000_000, lower: null, upper: null, is_forecast: false },
        { year: 2025, quarter: 4, key: "2025-Q4", label: "2025 Q4", value: 125_000_000, lower: null, upper: null, is_forecast: false },
        { year: 2026, quarter: 1, key: "2026-Q1", label: "2026 Q1", value: 130_000_000, lower: 127_000_000, upper: 133_000_000, is_forecast: true },
        { year: 2026, quarter: 2, key: "2026-Q2", label: "2026 Q2", value: 135_000_000, lower: 131_000_000, upper: 139_000_000, is_forecast: true },
        { year: 2026, quarter: 3, key: "2026-Q3", label: "2026 Q3", value: 140_000_000, lower: 135_000_000, upper: 145_000_000, is_forecast: true },
        { year: 2026, quarter: 4, key: "2026-Q4", label: "2026 Q4", value: 145_000_000, lower: 139_000_000, upper: 151_000_000, is_forecast: true },
      ],
      peer_median_points: [
        { year: 2025, quarter: 3, key: "2025-Q3", label: "2025 Q3", value: 118_000_000, lower: null, upper: null, is_forecast: false },
        { year: 2025, quarter: 4, key: "2025-Q4", label: "2025 Q4", value: 121_000_000, lower: null, upper: null, is_forecast: false },
        { year: 2026, quarter: 1, key: "2026-Q1", label: "2026 Q1", value: 124_000_000, lower: null, upper: null, is_forecast: true },
        { year: 2026, quarter: 2, key: "2026-Q2", label: "2026 Q2", value: 127_000_000, lower: null, upper: null, is_forecast: true },
        { year: 2026, quarter: 3, key: "2026-Q3", label: "2026 Q3", value: 129_000_000, lower: null, upper: null, is_forecast: true },
        { year: 2026, quarter: 4, key: "2026-Q4", label: "2026 Q4", value: 132_000_000, lower: null, upper: null, is_forecast: true },
      ],
      peer_rankings: [
        {
          bank_id: "Alpha Bank",
          rank: 1,
          latest_actual: 125_000_000,
          projected_value: 145_000_000,
          change_pct: 16,
          status: "ready",
          unavailable_reason: null,
        },
        {
          bank_id: "Bravo Bank",
          rank: 2,
          latest_actual: 121_000_000,
          projected_value: 132_000_000,
          change_pct: 9.1,
          status: "ready",
          unavailable_reason: null,
        },
      ],
    },
    {
      metric_id: "loan_to_deposit_ratio",
      label: "Loan to Deposit Ratio",
      format: "percent",
      status: "insufficient_history",
      unavailable_reason: "Forecast needs stable deposits and loans history for Alpha Bank.",
      primary_points: [
        { year: 2025, quarter: 4, key: "2025-Q4", label: "2025 Q4", value: 0.7, lower: null, upper: null, is_forecast: false },
      ],
      peer_median_points: [],
      peer_rankings: [
        {
          bank_id: "Alpha Bank",
          rank: 1,
          latest_actual: 0.7,
          projected_value: null,
          change_pct: null,
          status: "insufficient_history",
          unavailable_reason: "Forecast needs stable deposits and loans history for Alpha Bank.",
        },
      ],
    },
  ],
  unavailable_metrics: [
    {
      bank_id: "Alpha Bank",
      metric_id: "loan_to_deposit_ratio",
      label: "Loan to Deposit Ratio",
      reason: "Forecast needs stable deposits and loans history for Alpha Bank.",
    },
  ],
};

describe("OutlookPageContent", () => {
  it("renders a loading state", () => {
    const html = renderContent({ loading: true, forecast: null });
    expect(html).toContain("Building the executive outlook");
  });

  it("renders an error state", () => {
    const html = renderContent({ error: "Forecast endpoint unavailable" });
    expect(html).toContain("Forecast endpoint unavailable");
  });

  it("renders the executive outlook sections for a successful response", () => {
    const html = renderContent({
      forecast: baseForecast,
      selectedMetricId: "deposits",
      selectedPeerBankIds: ["Bravo Bank"],
    });

    expect(html).toContain("Predictive Outlook");
    expect(html).toContain("Peer ranking");
    expect(html).toContain("Forecast matrix");
    expect(html).toContain("Q+4");
    expect(html).toContain("Deposits");
  });

  it("renders eligibility notes when metrics are unavailable", () => {
    const html = renderContent({
      forecast: baseForecast,
      selectedMetricId: "loan_to_deposit_ratio",
    });

    expect(html).toContain("Eligibility and thin-history notes");
    expect(html).toContain("Loan to Deposit Ratio");
    expect(html).toContain("Forecast needs stable deposits and loans history for Alpha Bank.");
  });
});
