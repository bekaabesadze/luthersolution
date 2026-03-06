import { describe, it, expect } from "vitest";
import { deriveCamelValues } from "./ScoreboardPage";

describe("deriveCamelValues", () => {
  // Use quarter = null so inputs are treated as already annualized flows.
  const q: number | null = null;

  it("computes ACL / Total Loans using allowance_for_credit_losses and loans_outstanding", () => {
    const current = {
      allowance_for_credit_losses: 200,
      loans_outstanding: 10_000,
    } as Record<string, number>;
    const previous = {} as Record<string, number>;

    const derived = deriveCamelValues(current, previous, q);

    expect(derived["ACL / Total Loans"]).toBeCloseTo(0.02);
  });

  it("computes Equity to Assets and Legal Lending Limit from equity, assets, and ACL", () => {
    const current = {
      total_equity: 1_500,
      total_assets: 10_000,
      allowance_for_credit_losses: 200,
    } as Record<string, number>;
    const previous = {} as Record<string, number>;

    const derived = deriveCamelValues(current, previous, q);

    expect(derived["Equity to Assets"]).toBeCloseTo(0.15);
    // 15% of equity + ACL
    expect(derived["Legal Lending Limit"]).toBeCloseTo((1_500 + 200) * 0.15);
  });

  it("computes Loan to Deposit Ratio using net loans and deposits", () => {
    const current = {
      loans_outstanding: 8_000,
      allowance_for_credit_losses: 200,
      deposits: 10_000,
    } as Record<string, number>;
    const previous = {} as Record<string, number>;

    const derived = deriveCamelValues(current, previous, q);

    const expectedNetLoans = 8_000 - 200;
    expect(derived["Loan to Deposit Ratio"]).toBeCloseTo(
      expectedNetLoans / 10_000
    );
  });

  it("computes Efficiency Ratio as noninterest expense divided by (NII + noninterest income)", () => {
    const current = {
      non_interest_expense_amount: 300,
      non_interest_income_amount: 50,
      net_interest_income: 150,
    } as Record<string, number>;
    const previous = {
      non_interest_expense_amount: 0,
      non_interest_income_amount: 0,
      net_interest_income: 0,
    } as Record<string, number>;

    const derived = deriveCamelValues(current, previous, q);

    const expectedTotalRevenue = 150 + 50;
    expect(derived["Efficiency Ratio"]).toBeCloseTo(300 / expectedTotalRevenue);
  });

  it("computes Net Interest Margin using tax-equivalent NII and average earning assets", () => {
    const current = {
      net_interest_income: 200,
      // all tax-exempt incomes zero for this scenario
      tax_exempt_loans_income: 0,
      tax_exempt_securities_income: 0,
      average_loans: 8_000,
      average_balances_due_from_banks: 0,
      average_securities_agency: 0,
      average_securities_mbs: 0,
      average_securities_other: 0,
      average_fed_funds_sold: 0,
      average_lease_financing: 0,
      average_total_assets: 10_000,
    } as Record<string, number>;
    const previous = {
      net_interest_income: 0,
      tax_exempt_loans_income: 0,
      tax_exempt_securities_income: 0,
    } as Record<string, number>;

    const derived = deriveCamelValues(current, previous, q);

    // With quarter = null, annualizedFlow returns the flow directly.
    const expectedAvgEarningAssets = 8_000;
    const expectedNim = 200 / expectedAvgEarningAssets;
    expect(derived["Net Interest Margin"]).toBeCloseTo(expectedNim);
  });

  it("computes Return on Assets and Return on Equity using adjusted net profit and TE adjustment", () => {
    const current = {
      net_profit: 100,
      tax_exempt_loans_income: 10,
      tax_exempt_securities_income: 0,
      average_total_assets: 5_000,
      total_assets: 5_000,
      total_equity: 500,
      subchapter_s: 0,
    } as Record<string, number>;
    const previous = {
      net_profit: 0,
      tax_exempt_loans_income: 0,
      tax_exempt_securities_income: 0,
    } as Record<string, number>;

    const derived = deriveCamelValues(current, previous, q);

    const taxRate = 0.21;
    const teGrossUp = 1 / (1 - taxRate) - 1;
    const adjustedNetProfit = 100; // C‑corp style (subchapter_s = 0)
    const teAdjustAnnualized = 10 * teGrossUp;
    const expectedRoa = (adjustedNetProfit + teAdjustAnnualized) / 5_000;
    const expectedRoe = (adjustedNetProfit + teAdjustAnnualized) / 500;

    expect(derived["Return on Assets"]).toBeCloseTo(expectedRoa);
    expect(derived["Return on Equity"]).toBeCloseTo(expectedRoe);
  });

  it("computes Short Term Non-Core Funding, Net Loans to Average Assets, and Core Deposits to Average Assets", () => {
    const current = {
      total_assets: 10_000,
      average_total_assets: 10_000,
      average_loans: 6_000,
      loans_outstanding: 6_000,
      allowance_for_credit_losses: 200,
      deposits: 9_000,
      time_deposits_over_250k_remaining_1y: 500,
      reciprocal_deposits_amount: 300,
      sweep_nonbrokered_amount: 200,
      fed_funds_purchased_repos: 100,
      time_deposits_over_250k: 700,
      brokered_deposits_amount: 400,
    } as Record<string, number>;
    const previous = {} as Record<string, number>;

    const derived = deriveCamelValues(current, previous, q);

    const shortTermNonCore =
      500 + // shortTermLargeTime
      300 + // reciprocalDeposits
      200 + // sweepNonBrokered
      100; // fedFundsRepos
    expect(derived["Short Term Non-Core Funding"]).toBeCloseTo(
      shortTermNonCore / 10_000
    );

    const netLoans = 6_000 - 200;
    expect(derived["Net Loans to Average Assets"]).toBeCloseTo(
      netLoans / 10_000
    );

    const coreDeposits = 9_000 - 700 - 400;
    expect(derived["Core Deposits to Average Assets"]).toBeCloseTo(
      coreDeposits / 10_000
    );
  });
});

