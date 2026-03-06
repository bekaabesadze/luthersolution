# CAMEL KPI → Data Source Mapping

This document links each CAMEL scoreboard metric to:

- The **conceptual KPI** (from `KPI Formulas .pdf`)
- The **canonical metric name** in the app
- The **data source** and code path

## Capital

- **Equity to Assets**
  - **Concept**: Total equity capital ÷ total assets.
  - **Canonical name**: `Equity to Assets`
  - **Source**: **Derived from XBRL**
    - Numerator: `total_equity` from FFIEC (`FFIEC_METRICS["total_equity"]`).
    - Denominator: `total_assets` from FFIEC (`FFIEC_METRICS["total_assets"]`).
    - Code: `deriveCamelValues()` in `ScoreboardPage.tsx`.
- **Tier 1 Leverage Ratio**
  - **Concept**: Tier 1 capital ÷ average assets (reg leverage ratio).
  - **Canonical name**: `Tier 1 Leverage Ratio`
  - **Source**: **XBRL field or fallback**
    - Primary: `tier1_leverage_ratio` (`FFIEC_METRICS["tier1_leverage_ratio"]`).
    - Fallback: `total_equity / total_assets` when ratio is not explicitly reported.
    - Code: `deriveCamelValues()`.
- **Legal Lending Limit**
  - **Concept**: Maximum exposure per borrower based on capital plus ACL.
  - **Canonical name**: `Legal Lending Limit`
  - **Source**: **Derived from XBRL**
    - Formula: `0.15 × (total_equity + allowance_for_credit_losses)`.
    - Inputs: `total_equity`, `allowance_for_credit_losses` from FFIEC.
    - Code: `deriveCamelValues()`.

## Asset Quality

- **90+ PD and Non-Accrual / Total Loans**
  - **Concept**: 90+ days past due plus non-accrual loans ÷ total loans.
  - **Canonical name**: `90+ PD and Non-Accrual / Total Loans`
  - **Source**: **Derived from XBRL**
    - Numerator: `past_due_90_plus_amount + nonaccrual_loans_amount`.
    - Denominator: `loans_outstanding`.
    - Inputs mapped via `FFIEC_METRICS`.
    - Code: `deriveCamelValues()`.
- **Past Due 30-89 / Total Loans**
  - **Concept**: 30–89 days past-due loans ÷ total loans.
  - **Canonical name**: `Past Due 30-89 / Total Loans`
  - **Source**: **Derived from XBRL**
    - Numerator: `past_due_30_89_amount`.
    - Denominator: `loans_outstanding`.
    - Code: `deriveCamelValues()`.
- **Non Performing Assets to Equity + Reserves**
  - **Concept**: Non-performing loans ÷ (equity + ACL).
  - **Canonical name**: `Non Performing Assets to Equity + Reserves`
  - **Source**: **Derived from XBRL**
    - Numerator: `past_due_90_plus_amount + nonaccrual_loans_amount`.
    - Denominator: `total_equity + allowance_for_credit_losses`.
    - Code: `deriveCamelValues()`.
- **ACL / Total Loans**
  - **Concept (PDF)**: Allowance for credit losses ÷ total loans.
  - **Canonical name**: `ACL / Total Loans`
  - **Source**: **Derived from XBRL or taken from CAMEL Excel**
    - Derived formula: `allowance_for_credit_losses / loans_outstanding`.
    - XBRL inputs: `FFIEC_METRICS["allowance_for_credit_losses"]`, `FFIEC_METRICS["loans_outstanding"]`.
    - Excel override: value from CAMEL Excel if present in `quarterly_metrics`.
    - Code: `deriveCamelValues()` plus Excel overlay in `ScoreboardPage.tsx`.

## Management

- **Percentage on Budget**
  - **Concept (PDF)**: Actual vs budget performance (bank-specific budgeting).
  - **Canonical name**: `Percentage on Budget`
  - **Source**: **CAMEL Excel only**
    - Not derivable from FFIEC/XBRL; app reads the numeric percentage from WSB-style Excel.
    - Mapping: `EXCEL_TO_CANONICAL["Percentage on Budget"]`.
    - Path: `camel_excel_parser.py` → `POST /upload-camel-excel` → `quarterly_metrics` → `ScoreboardPage.tsx`.
- **Number of Employees**
  - **Concept**: FTE employee count.
  - **Canonical name**: `Number of Employees`
  - **Source**: **XBRL or Excel**
    - Primary: `num_employees` from FFIEC (`FFIEC_METRICS["num_employees"]`).
    - Excel override: CAMEL Excel value if provided.
    - Code: `deriveCamelValues()` and CAMEL overlay.
- **Efficiency Ratio**
  - **Concept (PDF/UBPR)**: Noninterest expense ÷ (net interest income + noninterest income), annualized.
  - **Canonical name**: `Efficiency Ratio`
  - **Source**: **Derived from XBRL**
    - Numerator: annualized `non_interest_expense_amount`.
    - Denominator: annualized `net_interest_income` (or `revenue` fallback) + annualized `non_interest_income_amount`.
    - Annualization helpers: `quarterFlow`, `annualizedFlow` in `deriveCamelValues()`.
    - Code: `deriveCamelValues()`.
- **Loan Growth Rate**
  - **Concept**: Quarter-over-quarter loan growth.
  - **Canonical name**: `Loan Growth Rate`
  - **Source**: **Derived from XBRL**
    - Formula: `(current_loans_outstanding - previous_loans_outstanding) / previous_loans_outstanding`.
    - Inputs from FFIEC via `FFIEC_METRICS["loans_outstanding"]`.
    - Code: `deriveCamelValues()`.
- **Deposit Growth Rate**
  - **Concept**: Quarter-over-quarter deposit growth.
  - **Canonical name**: `Deposit Growth Rate`
  - **Source**: **Derived from XBRL**
    - Formula: `(current_deposits - previous_deposits) / previous_deposits`.
    - Inputs: `FFIEC_METRICS["deposits"]`.
    - Code: `deriveCamelValues()`.
- **Non-Interest Income**
  - **Concept**: Noninterest income ÷ assets (or raw amount when assets unavailable).
  - **Canonical name**: `Non-Interest Income`
  - **Source**: **Derived from XBRL**
    - Numerator: annualized `non_interest_income_amount`.
    - Denominator: `average_total_assets` (preferred) or `total_assets`.
    - Code: `deriveCamelValues()`.

## Earnings

- **Cost of Funds**
  - **Concept (PDF)**: Interest expense ÷ average earning assets.
  - **Canonical name**: `Cost of Funds`
  - **Source**: **Derived from XBRL**
    - Numerator: annualized `interest_expense_total_amount`.
    - Denominator: `avgEarningAssets` (sum of average interest-earning asset balances) with fallback to `average_total_assets`.
    - Code: `deriveCamelValues()`.
- **Yield on Loans**
  - **Concept**: Loan interest income ÷ average loans.
  - **Canonical name**: `Yield on Loans`
  - **Source**: **Derived from XBRL**
    - Numerator: annualized `interest_income_loans_amount`.
    - Denominator: `average_loans`.
    - Code: `deriveCamelValues()`.
- **TE Yield on Securities**
  - **Concept (PDF)**: Tax-equivalent interest income on securities ÷ average securities.
  - **Canonical name**: `TE Yield on Securities`
  - **Source**: **Derived from XBRL**
    - Numerator: annualized securities interest income plus tax-equivalent gross-up on tax-exempt securities income.
    - Denominator: `average_securities_agency + average_securities_mbs + average_securities_other`.
    - Inputs: several `FFIEC_METRICS` keys for securities balances and incomes.
    - Code: `deriveCamelValues()`.
- **Net Interest Margin**
  - **Concept (PDF)**: (Interest income from loans & investments − interest expense) ÷ earning assets, with TE adjustments for tax-exempt items.
  - **Canonical name**: `Net Interest Margin`
  - **Source**: **Derived from XBRL**
    - Numerator: `niiTe` = annualized `net_interest_income` (or `revenue` fallback) + tax-equivalent adjustments for tax-exempt loans & securities.
    - Denominator: `avgEarningAssets` with fallback to `average_total_assets`.
    - Code: `deriveCamelValues()`.
- **Return on Assets**
  - **Concept (PDF)**: (Net income with TE adjustment) ÷ average assets.
  - **Canonical name**: `Return on Assets`
  - **Source**: **Derived from XBRL**
    - Numerator: `adjustedNetProfit + teAdjustAnnualized` (handles Sub S vs C-corp tax treatment).
    - Denominator: `average_total_assets` (preferred) or `total_assets`.
    - Code: `deriveCamelValues()`.
- **Return on Equity**
  - **Concept (PDF)**: (Net income with TE adjustment) ÷ equity.
  - **Canonical name**: `Return on Equity`
  - **Source**: **Derived from XBRL**
    - Numerator: same as ROA numerator.
    - Denominator: `total_equity`.
    - Code: `deriveCamelValues()`.

## Liquidity

- **Loan to Deposit Ratio**
  - **Concept**: Net loans ÷ deposits.
  - **Canonical name**: `Loan to Deposit Ratio`
  - **Source**: **Derived from XBRL**
    - Numerator: `loans_outstanding − allowance_for_credit_losses`.
    - Denominator: `deposits`.
    - Code: `deriveCamelValues()`.
- **Brokered Deposits to Total Deposits**
  - **Concept**: Brokered deposits ÷ total deposits.
  - **Canonical name**: `Brokered Deposits to Total Deposits`
  - **Source**: **Derived from XBRL**
    - Numerator: `brokered_deposits_amount`.
    - Denominator: `deposits`.
    - Code: `deriveCamelValues()`.
- **Short Term Non-Core Funding**
  - **Concept (PDF)**: Short-term, less-stable funding sources ÷ total assets.
  - **Canonical name**: `Short Term Non-Core Funding`
  - **Source**: **Derived from XBRL**
    - Numerator: `time_deposits_over_250k_remaining_1y + reciprocal_deposits_amount + sweep_nonbrokered_amount + fed_funds_purchased_repos`.
    - Denominator: `total_assets`.
    - Code: `deriveCamelValues()`.
- **Net Loans to Average Assets**
  - **Concept**: Net loans ÷ average assets.
  - **Canonical name**: `Net Loans to Average Assets`
  - **Source**: **Derived from XBRL**
    - Numerator: `(average_loans or loans_outstanding) − allowance_for_credit_losses`.
    - Denominator: `average_total_assets`.
    - Code: `deriveCamelValues()`.
- **Core Deposits to Average Assets**
  - **Concept**: Core deposits ÷ total/average assets.
  - **Canonical name**: `Core Deposits to Average Assets`
  - **Source**: **Derived from XBRL**
    - Core deposits = `deposits − time_deposits_over_250k − brokered_deposits_amount`.
    - Denominator: `total_assets`.
    - Code: `deriveCamelValues()`.
- **Pledged Assets to Total Assets**
  - **Concept (PDF)**: Pledged loans & securities ÷ total assets.
  - **Canonical name**: `Pledged Assets to Total Assets`
  - **Source**: **Derived from XBRL**
    - Numerator: `pledged_loans_leases + pledged_securities`.
    - Denominator: `total_assets`.
    - Code: `deriveCamelValues()`.
- **FHLB Open Borrowing Capacity**
  - **Concept (PDF)**: Remaining borrowing capacity with FHLB, subject to collateral, policies, and letters of credit.
  - **Canonical name**: `FHLB Open Borrowing Capacity`
  - **Source**: **CAMEL Excel only**
    - Not derivable from FFIEC; comes from FHLB/ALM calculations reflected in CAMEL Excel.
    - Mapping: `EXCEL_TO_CANONICAL["FHLB Open Borrowing Capacity"]`.
    - Path: Excel → `camel_excel_parser.py` → DB → CAMEL table.

## Sensitivity (Interest-Rate Risk)

- **Earnings at Risk (12m) -100 / +100**
  - **Concept (PDF)**: Change in net interest income over 12 months under −100 bp / +100 bp rate shocks.
  - **Canonical names**: `Earnings at Risk (12m) -100`, `Earnings at Risk (12m) +100`
  - **Source**: **CAMEL Excel only**
    - Calculated by ALM/IRR models using gap/EAR simulations, not FFIEC call report alone.
    - Excel mapping: `EXCEL_TO_CANONICAL` for each label.
- **Economic Value of Equity Ratio -100 / +100**
  - **Concept (PDF)**: Change in present value of equity under rate shocks, as a percentage of asset value.
  - **Canonical names**: `Economic Value of Equity Ratio -100`, `Economic Value of Equity Ratio +100`
  - **Source**: **CAMEL Excel only**
    - Derived from discounted cash-flow/EVE models, not FFIEC.
    - Excel-only in this app.
- **Non Parallel EAR (12m) Most Likely**
  - **Concept (PDF)**: Earnings at risk under a non-parallel, most-likely yield-curve scenario.
  - **Canonical name**: `Non Parallel EAR (12m) Most Likely`
  - **Source**: **CAMEL Excel only**
    - Computed in ALM tools; imported from Excel.
- **Non Parallel EVE Ratio Most Likely**
  - **Concept (PDF)**: Economic value of equity ratio under a non-parallel, most-likely yield-curve scenario.
  - **Canonical name**: `Non Parallel EVE Ratio Most Likely`
  - **Source**: **CAMEL Excel only**
    - Also computed externally and loaded via CAMEL Excel.

## Precedence Rules in CAMEL Table

- When both **XBRL-derived** and **CAMEL Excel** values exist for the same metric and period:
  - The **Excel value wins** and is displayed in the CAMEL table.
  - Implementation: in `ScoreboardPage.tsx`, `valueByMetricBySlice` starts from `derived` (from `deriveCamelValues`) and then overwrites entries with any values present in `currentMap` (values loaded from `GET /metrics`).

