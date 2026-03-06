# CAMEL KPI Manual End-to-End Checklists

Use these steps each quarter (or after code changes) to verify that the CAMEL page matches the KPI formulas from `KPI Formulas .pdf` and your WSB Performance Dashboard workbook.

## 1. Prerequisites

- Backend server running (from `backend`):
  - `source venv/bin/activate`
  - `python main.py` (or `uvicorn main:app --reload`)
- Frontend dev server running (from `frontend`):
  - `npm run dev`
- A **test XBRL file** for one bank and quarter.
- A **CAMEL Excel workbook** (WSB Performance Dashboard style) for the same bank and quarter, with formulas already matching the PDF definitions.

## 2. XBRL-only sanity check (derived metrics)

1. Start with a clean dataset (optional but recommended):
   - If you already have test uploads for the same bank/quarter, call `DELETE /upload` or use the Files page to remove them.
2. In the frontend, go to the **Upload Data** page.
3. Upload the **XBRL file only**:
   - Bank name: the same bank as in your CAMEL workbook.
   - Year / Quarter: match the reporting period.
   - File: select the XBRL instance.
4. Open the **CAMEL** page:
   - Select the bank.
   - Select the year/quarter.
   - Click **Add column** to add that bank/period.
5. In your CAMEL Excel workbook (or a copy of it), plug in the same raw FFIEC numbers and let Excel compute:
   - **NIM, ROA, ROE, Efficiency Ratio, ACL / Total Loans, Loan/Deposit ratios, liquidity ratios**, etc.
6. Compare table values:
   - Spot-check a few key ratios:
     - `Net Interest Margin`
     - `ACL / Total Loans`
     - `Efficiency Ratio`
     - `Return on Assets`
     - `Return on Equity`
     - `Loan to Deposit Ratio`
     - `Short Term Non-Core Funding`
   - Allow for rounding differences only (e.g., 0.0001 tolerance). Values should match your Excel calculations when both use the same underlying FFIEC inputs.

## 3. CAMEL Excel path and ALM metrics

1. With the XBRL upload still present, upload the **CAMEL Excel** workbook for the same bank/period:
   - Call `POST /upload-camel-excel` (via API client or a future UI) with the `.xlsx` file and (optionally) a bank name override that matches the CAMEL page.
   - This uses:
     - `camel_excel_parser.py` (Excel → canonical metric names)
     - `POST /upload-camel-excel` (rows stored in `quarterly_metrics`).
2. Refresh the CAMEL page and re-add the same bank/period column if needed.
3. Verify **ALM and budget metrics** now appear:
   - `Earnings at Risk (12m) -100`
   - `Earnings at Risk (12m) +100`
   - `Economic Value of Equity Ratio -100`
   - `Economic Value of Equity Ratio +100`
   - `Non Parallel EAR (12m) Most Likely`
   - `Non Parallel EVE Ratio Most Likely`
   - `FHLB Open Borrowing Capacity`
   - `Percentage on Budget`
4. Cross-check values:
   - For each of the above metrics, confirm the CAMEL table value exactly matches the value calculated in the CAMEL Excel workbook (no scaling or sign differences).
   - If Excel also computes overlapping ratios (e.g., NIM, ROA/ROE), confirm that:
     - The CAMEL page shows the Excel value (from `quarterly_metrics`) for that bank/period.
     - XBRL-derived values still behave as expected for banks/periods where no CAMEL Excel has been uploaded.

## 4. Multi-quarter behavior

1. Upload XBRL and CAMEL Excel for at least **two consecutive quarters** for the same bank.
2. On the CAMEL page:
   - Add columns for both quarters (e.g., `BankName 2024 Q1` and `BankName 2024 Q2`).
3. In Excel, compute:
   - Quarter-over-quarter **Loan Growth Rate** and **Deposit Growth Rate**.
   - Any other flow-based KPIs you care about.
4. Confirm that:
   - `Loan Growth Rate` and `Deposit Growth Rate` in the CAMEL table match the Excel results.
   - YTD-based metrics (e.g., Efficiency Ratio, NIM) behave correctly when moving from Q1 to Q2 (i.e., using the difference in YTD values annualized over a quarter).

## 5. Regression smoke test checklist

Use this quick list after any code change touching CAMEL calculations:

- [ ] XBRL-only upload produces plausible values for:
      `Net Interest Margin`, `Efficiency Ratio`, `ROA`, `ROE`, `ACL / Total Loans`,
      `Loan to Deposit Ratio`, `Short Term Non-Core Funding`, `Net Loans to Average Assets`,
      `Core Deposits to Average Assets`, `Pledged Assets to Total Assets`.
- [ ] Uploading CAMEL Excel for the same bank/period:
      - [ ] Fills in ALM/budget metrics (EAR/EVE/FHLB/Percentage on Budget).
      - [ ] Does **not** break any existing XBRL-derived metrics.
- [ ] For overlapping metrics (e.g., NIM) where Excel provides values:
      - [ ] CAMEL table shows the Excel numbers for that bank/period.
      - [ ] Banks/periods without CAMEL Excel still rely on XBRL-derived values.
- [ ] For at least one bank with two consecutive quarters:
      - [ ] Growth rates and flow-based KPIs match an independent Excel check built from the same FFIEC data.

