export type OutlookMetricFormat = "currency" | "percent" | "number";

export interface OutlookMetricDefinition {
  id: string;
  label: string;
  format: OutlookMetricFormat;
}

export const outlookMetricRegistry: OutlookMetricDefinition[] = [
  { id: "deposits", label: "Deposits", format: "currency" },
  { id: "loans_outstanding", label: "Loans Outstanding", format: "currency" },
  { id: "total_assets", label: "Total Assets", format: "currency" },
  { id: "total_equity", label: "Total Equity", format: "currency" },
  { id: "net_profit", label: "Net Profit", format: "currency" },
  { id: "allowance_for_credit_losses", label: "Allowance for Credit Losses", format: "currency" },
  { id: "past_due_30_89_amount", label: "Past Due 30-89 Amount", format: "currency" },
  { id: "past_due_90_plus_amount", label: "Past Due 90+ Amount", format: "currency" },
  { id: "nonaccrual_loans_amount", label: "Nonaccrual Loans Amount", format: "currency" },
  { id: "brokered_deposits_amount", label: "Brokered Deposits Amount", format: "currency" },
  { id: "equity_to_assets", label: "Equity to Assets", format: "percent" },
  { id: "tier1_leverage_ratio", label: "Tier 1 Leverage Ratio", format: "percent" },
  { id: "loan_to_deposit_ratio", label: "Loan to Deposit Ratio", format: "percent" },
  { id: "acl_to_total_loans", label: "ACL / Total Loans", format: "percent" },
  { id: "past_due_30_89_to_total_loans", label: "Past Due 30-89 / Total Loans", format: "percent" },
  {
    id: "past_due_90_plus_nonaccrual_to_total_loans",
    label: "90+ PD and Non-Accrual / Total Loans",
    format: "percent",
  },
  {
    id: "non_performing_assets_to_equity_reserves",
    label: "Non Performing Assets to Equity + Reserves",
    format: "percent",
  },
  {
    id: "brokered_deposits_to_total_deposits",
    label: "Brokered Deposits to Total Deposits",
    format: "percent",
  },
];

export const defaultOutlookMetricId = "deposits";

export function getOutlookMetricDefinition(metricId: string): OutlookMetricDefinition | undefined {
  return outlookMetricRegistry.find((metric) => metric.id === metricId);
}
