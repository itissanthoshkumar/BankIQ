// Auto-generated reference: every Full Analysis metric with plain-English logic
// and a real example (from an actual parsed statement). Regenerate via scratchpad/gen_metrics.py.
export const FULL_METRICS = [
 {
  "name": "Min Balance",
  "how": "Minimum of the month's daily closing balances. On a day with no transactions, the previous day's balance is carried forward.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Max Balance",
  "how": "Maximum of the month's daily closing balances. On a day with no transactions, the previous day's balance is carried forward.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹217,896.68."
 },
 {
  "name": "Average EOD Balance",
  "how": "Mean of all daily closing balances in the month. On a day with no transactions, the previous day's balance is carried forward.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹31,174.13."
 },
 {
  "name": "Monthly Average Balance",
  "how": "Same computation as Average end-of-day Balance — mean of the month's daily closing balances — with a blank Overall. On a day with no transactions, the previous day's balance is carried forward.",
  "ex": "e.g. Feb-2026 in Mr. PALA SRINIVAS's statement: ₹24,385.79. (No single Overall figure — this metric is month-by-month.)"
 },
 {
  "name": "Average EOD Balance on 3rd 4th 5th 6th 7th",
  "how": "Mean of the daily closing balances on days 3, 4, 5, 6 and 7 of the month. On a day with no transactions, the previous day's balance is carried forward.",
  "ex": "e.g. Feb-2026 in Mr. PALA SRINIVAS's statement: ₹40.40. (No single Overall figure — this metric is month-by-month.)"
 },
 {
  "name": "Average EOD Balance on 3rd 4th 6th 7th",
  "how": "Mean of the daily closing balances on days 3, 4, 6 and 7 of the month. On a day with no transactions, the previous day's balance is carried forward.",
  "ex": "e.g. Feb-2026 in Mr. PALA SRINIVAS's statement: ₹50.50. (No single Overall figure — this metric is month-by-month.)"
 },
 {
  "name": "Average EOD Balance on 1st 5th 10th 15th 25th",
  "how": "Mean of the daily closing balances on days 1, 5, 10, 15 and 25 of the month. On a day with no transactions, the previous day's balance is carried forward.",
  "ex": "e.g. Feb-2026 in Mr. PALA SRINIVAS's statement: ₹11,482.20. (No single Overall figure — this metric is month-by-month.)"
 },
 {
  "name": "Average EOD Balance on 2nd 10th 20th",
  "how": "Mean of the daily closing balances on days 2, 10 and 20 of the month. On a day with no transactions, the previous day's balance is carried forward.",
  "ex": "e.g. Feb-2026 in Mr. PALA SRINIVAS's statement: ₹45,748. (No single Overall figure — this metric is month-by-month.)"
 },
 {
  "name": "Avg balance till 10th of month",
  "how": "Mean of the daily closing balances for days 1 through 10 of the month. On a day with no transactions, the previous day's balance is carried forward.",
  "ex": "e.g. Feb-2026 in Mr. PALA SRINIVAS's statement: ₹3,597.30. (No single Overall figure — this metric is month-by-month.)"
 },
 {
  "name": "Avg balance till 20th of month",
  "how": "Mean of the daily closing balances for days 1 through 20 of the month. On a day with no transactions, the previous day's balance is carried forward.",
  "ex": "e.g. Feb-2026 in Mr. PALA SRINIVAS's statement: ₹12,812.55. (No single Overall figure — this metric is month-by-month.)"
 },
 {
  "name": "Avg balance till last date of month",
  "how": "Mean of all daily closing balances in the month (identical to Average end-of-day Balance). On a day with no transactions, the previous day's balance is carried forward.",
  "ex": "e.g. Feb-2026 in Mr. PALA SRINIVAS's statement: ₹24,385.79. (No single Overall figure — this metric is month-by-month.)"
 },
 {
  "name": "Balance on 1st",
  "how": "The daily closing balance on day 1 of the month (blank if the account had no activity yet). On a day with no transactions, the previous day's balance is carried forward.",
  "ex": "e.g. Mar-2026 in Mr. PALA SRINIVAS's statement: ₹445. (No single Overall figure — this metric is month-by-month.)"
 },
 {
  "name": "Balance on 14th",
  "how": "The daily closing balance on day 14 of the month (blank if the account had no activity yet). On a day with no transactions, the previous day's balance is carried forward.",
  "ex": "e.g. Feb-2026 in Mr. PALA SRINIVAS's statement: ₹5,295. (No single Overall figure — this metric is month-by-month.)"
 },
 {
  "name": "Balance on 30th",
  "how": "The daily closing balance on day 30, falling back to day 29 then 28 (short months) (blank if the account had no activity yet). On a day with no transactions, the previous day's balance is carried forward.",
  "ex": "e.g. Feb-2026 in Mr. PALA SRINIVAS's statement: ₹10,414. (No single Overall figure — this metric is month-by-month.)"
 },
 {
  "name": "ABB on 1st,14th, 30th/Last Day",
  "how": "Mean of the end-of-day closes on day 1, day 14, and the month's last day (31→30→29→28 fallback), skipping missing values.",
  "ex": "e.g. Feb-2026 in Mr. PALA SRINIVAS's statement: ₹5,236.33. (No single Overall figure — this metric is month-by-month.)"
 },
 {
  "name": "Median EOD Balance",
  "how": "Statistical median of the month's daily closing balances. On a day with no transactions, the previous day's balance is carried forward.",
  "ex": "e.g. Feb-2026 in Mr. PALA SRINIVAS's statement: ₹9,017. (No single Overall figure — this metric is month-by-month.)"
 },
 {
  "name": "First Day EOD Balance",
  "how": "The daily closing balance on day 1 of the month (same as Balance on 1st). On a day with no transactions, the previous day's balance is carried forward.",
  "ex": "e.g. Mar-2026 in Mr. PALA SRINIVAS's statement: ₹445. (No single Overall figure — this metric is month-by-month.)"
 },
 {
  "name": "Last Day EOD Balance",
  "how": "Last valid daily closing balance in the month's grid column. On a day with no transactions, the previous day's balance is carried forward.",
  "ex": "e.g. Feb-2026 in Mr. PALA SRINIVAS's statement: ₹10,414. (No single Overall figure — this metric is month-by-month.)"
 },
 {
  "name": "Opening",
  "how": "Balance before the month's first transaction: first transaction's running balance minus its signed amount, blank for months with no transactions.",
  "ex": "e.g. Mar-2026 in Mr. PALA SRINIVAS's statement: ₹10,414. (No single Overall figure — this metric is month-by-month.)"
 },
 {
  "name": "Closing Balance",
  "how": "Running balance on the month's last transaction, blank for months with no transactions.",
  "ex": "e.g. Feb-2026 in Mr. PALA SRINIVAS's statement: ₹10,414. (No single Overall figure — this metric is month-by-month.)"
 },
 {
  "name": "Total No. of Credit Transactions",
  "how": "Count of transactions in the month with money coming IN.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 566."
 },
 {
  "name": "Total Amount of Credit Transactions",
  "how": "Sum of amounts of all transactions with money coming IN.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹2,033,732."
 },
 {
  "name": "Min Amount of Credit Transactions",
  "how": "Smallest single credit (money coming IN) in the month, blank when there are no credits.",
  "ex": "e.g. Feb-2026 in Mr. PALA SRINIVAS's statement: ₹1. (No single Overall figure — this metric is month-by-month.)"
 },
 {
  "name": "Max Amount of Credit Transactions",
  "how": "Largest single credit (money coming IN) in the month, blank when there are no credits.",
  "ex": "e.g. Feb-2026 in Mr. PALA SRINIVAS's statement: ₹249,802. (No single Overall figure — this metric is month-by-month.)"
 },
 {
  "name": "Total No. of Debit Transactions",
  "how": "Count of transactions in the month with money going OUT.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 810."
 },
 {
  "name": "Total Amount of Debit Transactions",
  "how": "Sum of debit magnitudes (negated amounts of transactions with money going OUT).",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹2,008,798.32."
 },
 {
  "name": "Min Amount of Debit Transactions",
  "how": "Smallest debit magnitude (min of -amount over transactions with money going OUT), blank when there are no debits.",
  "ex": "e.g. Feb-2026 in Mr. PALA SRINIVAS's statement: ₹1. (No single Overall figure — this metric is month-by-month.)"
 },
 {
  "name": "Max Amount of Debit Transactions",
  "how": "Largest debit magnitude in the month, blank when there are no debits.",
  "ex": "e.g. Feb-2026 in Mr. PALA SRINIVAS's statement: ₹95,000. (No single Overall figure — this metric is month-by-month.)"
 },
 {
  "name": "Total No. of Net Credit Transactions Above 1000",
  "how": "Count of transactions with amount > 1000.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 191."
 },
 {
  "name": "Total Net Credit Amount Above 1000",
  "how": "Sum of amounts of transactions with amount > 1000.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹1,865,682."
 },
 {
  "name": "Total No. of Net Debit Transactions Above 1000",
  "how": "Count of transactions with amount < -1000 (debit magnitude above 1000).",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 174."
 },
 {
  "name": "Total Net Debit Amount Above 1000",
  "how": "Sum of magnitudes (-amount) of transactions with amount < -1000.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹1,839,936."
 },
 {
  "name": "Total No. of Cash Deposits",
  "how": "Count of transactions whose ledger category is 'Cash Deposit'.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total Amount of Cash Deposits",
  "how": "Sum of signed amounts of category 'Cash Deposit' transactions.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total No. of Cash Withdrawals",
  "how": "Count of transactions whose ledger category is 'Cash Withdrawal'.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 3."
 },
 {
  "name": "Total Amount of Cash Withdrawals",
  "how": "Sum of magnitudes (negated amounts) of category 'Cash Withdrawal' transactions.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹40,000."
 },
 {
  "name": "Total Amount of Loan Credit",
  "how": "Sum of amounts of transactions categorised 'Loan Disbursed'.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "No. of EMI / loan payments",
  "how": "Count of transactions categorised 'Loan' or 'Business Loan'.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 4."
 },
 {
  "name": "Total Amount of EMI / loan Payments",
  "how": "Sum of magnitudes (negated amounts) of 'Loan' or 'Business Loan' transactions.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹9,750."
 },
 {
  "name": "Total Interest Received",
  "how": "Sum of amounts of transactions categorised 'Interest' with money coming IN (credit interest only).",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "No. of Bank Charges",
  "how": "Count of transactions categorised 'Bank Charges' or 'Bounced I/W ECS Charges'.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Amount of Bank Charges",
  "how": "Sum of magnitudes (negated amounts) of 'Bank Charges' and 'Bounced I/W ECS Charges' transactions.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total No. of EMI Bounce count",
  "how": "Count of transactions categorised 'Bounced I/W ECS Charges' (bounce-charge rows proxy for EMI bounces).",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No of Salary Credits",
  "how": "Count of transactions categorised 'Salary'.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of Salary Credits",
  "how": "Sum of amounts of transactions categorised 'Salary'.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Salary Flag (0 or 1)",
  "how": "1 if the month contains any 'Salary'-categorised transaction else 0.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of CASH Transaction Credit",
  "how": "Count of credit transactions (money coming IN) whose description rail (rail_of mapped via _RAIL_MAP) is CASH.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of NEFT Transaction Credit",
  "how": "Count of credit transactions (money coming IN) whose description rail is NEFT.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 1."
 },
 {
  "name": "Total No. of RTGS Transaction Credit",
  "how": "Count of credit transactions (money coming IN) whose description rail is RTGS.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of IMPS Transaction Credit",
  "how": "Count of credit transactions (money coming IN) whose description rail is IMPS.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of UPI Transaction Credit",
  "how": "Count of credit transactions (money coming IN) whose description rail is UPI.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 559."
 },
 {
  "name": "Total No. of Debit Card Transaction Credit",
  "how": "Count of credit transactions (money coming IN) whose description rail is CARD (mapped to 'Debit Card').",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of Cheque Transaction Credit",
  "how": "Count of credit transactions (money coming IN) whose description rail is CHEQUE.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of NACH Transaction Credit",
  "how": "Count of credit transactions (money coming IN) whose description rail is NACH/ECS (mapped to 'NACH').",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of ATM Transaction Credit",
  "how": "Count of credit transactions (money coming IN) whose description rail is ATM, AEPS or UPI-ATM (all mapped to 'ATM').",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of Fund Transfer Transaction Credit",
  "how": "Count of credit transactions (money coming IN) whose rail_of() result is OTHER, i.e. no specific rail detected — mapped to 'Fund Transfer'.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 6."
 },
 {
  "name": "Total No. of Other Transaction Credit",
  "how": "Count of credit transactions (money coming IN) whose rail value falls outside every _RAIL_MAP key and isn't OTHER — the residual 'Other' rail bucket.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total Amount of CASH Transaction Credit",
  "how": "Sum of amounts of credit transactions (money coming IN) on the CASH rail.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of NEFT Transaction Credit",
  "how": "Sum of amounts of credit transactions on the NEFT rail.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹249,802."
 },
 {
  "name": "Total Amount of RTGS Transaction Credit",
  "how": "Sum of amounts of credit transactions on the RTGS rail.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of IMPS Transaction Credit",
  "how": "Sum of amounts of credit transactions on the IMPS rail.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of UPI Transaction Credit",
  "how": "Sum of amounts of credit transactions on the UPI rail.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹1,482,489."
 },
 {
  "name": "Total Amount of Debit Card Transaction Credit",
  "how": "Sum of amounts of credit transactions on the CARD rail ('Debit Card').",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of Cheque Transaction Credit",
  "how": "Sum of amounts of credit transactions on the Cheque rail.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of NACH Transaction Credit",
  "how": "Sum of amounts of credit transactions on the NACH/ECS rail.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of ATM Transaction Credit",
  "how": "Sum of amounts of credit transactions on the ATM/AEPS/UPI-ATM rails.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of Fund Transfer Transaction Credit",
  "how": "Sum of amounts of credit transactions with no detected rail (rail_of OTHER → 'Fund Transfer').",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹301,441."
 },
 {
  "name": "Total Amount of Other Transaction Credit",
  "how": "Sum of amounts of credit transactions in the residual 'Other' rail bucket.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total No. of CASH Transaction Debit",
  "how": "Count of debit transactions (money going OUT) whose description rail is CASH.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of NEFT Transaction Debit",
  "how": "Count of debit transactions (money going OUT) whose description rail is NEFT.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of RTGS Transaction Debit",
  "how": "Count of debit transactions (money going OUT) whose description rail is RTGS.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of IMPS Transaction Debit",
  "how": "Count of debit transactions (money going OUT) whose description rail is IMPS.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of UPI Transaction Debit",
  "how": "Count of debit transactions (money going OUT) whose description rail is UPI.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 805."
 },
 {
  "name": "Total No. of Debit Card Transaction Debit",
  "how": "Count of debit transactions (money going OUT) on the CARD rail ('Debit Card').",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of Cheque Transaction Debit",
  "how": "Count of debit transactions (money going OUT) on the Cheque rail.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of NACH Transaction Debit",
  "how": "Count of debit transactions (money going OUT) on the NACH/ECS rail.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of ATM Transaction Debit",
  "how": "Count of debit transactions (money going OUT) on the ATM/AEPS/UPI-ATM rails.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 3."
 },
 {
  "name": "Total No. of Fund Transfer Transaction Debit",
  "how": "Count of debit transactions (money going OUT) with no detected rail (rail_of OTHER → 'Fund Transfer').",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 2."
 },
 {
  "name": "Total No. of Other Transaction Debit",
  "how": "Count of debit transactions (money going OUT) in the residual 'Other' rail bucket.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total Amount of CASH Transaction Debit",
  "how": "Sum of debit magnitudes (-amount over transactions with money going OUT) on the CASH rail.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of NEFT Transaction Debit",
  "how": "Sum of debit magnitudes on the NEFT rail.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of RTGS Transaction Debit",
  "how": "Sum of debit magnitudes on the RTGS rail.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of IMPS Transaction Debit",
  "how": "Sum of debit magnitudes on the IMPS rail.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of UPI Transaction Debit",
  "how": "Sum of debit magnitudes on the UPI rail.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹1,917,798.32."
 },
 {
  "name": "Total Amount of Debit Card Transaction Debit",
  "how": "Sum of debit magnitudes on the CARD rail ('Debit Card').",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of Cheque Transaction Debit",
  "how": "Sum of debit magnitudes on the Cheque rail.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of NACH Transaction Debit",
  "how": "Sum of debit magnitudes on the NACH/ECS rail.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of ATM Transaction Debit",
  "how": "Sum of debit magnitudes on the ATM/AEPS/UPI-ATM rails.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹40,000."
 },
 {
  "name": "Total Amount of Fund Transfer Transaction Debit",
  "how": "Sum of debit magnitudes for transactions with no detected rail ('Fund Transfer').",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹51,000."
 },
 {
  "name": "Total Amount of Other Transaction Debit",
  "how": "Sum of debit magnitudes in the residual 'Other' rail bucket.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total No. of Bills & Utilities Transaction",
  "how": "Count of transactions (any sign) whose _digitap_cat is 'Bills & Utilities' (ledger categories Fuel/Utilities/Utilities Phone/Utilities Cable TV/Software).",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 39."
 },
 {
  "name": "Total No. of Food Transaction",
  "how": "Count of transactions mapped to Digitap category 'Food' (ledger category Food).",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of Alcohol Transaction",
  "how": "Count of transactions whose description matches the ALCOHOL regex (checked before category mapping).",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of Travel Transaction",
  "how": "Count of transactions mapped to Digitap category 'Travel' (ledger category Travel).",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of Entertainment & Lifestyle Transaction",
  "how": "Count of transactions mapped to 'Entertainment & Lifestyle' (ledger category Entertainment).",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 3."
 },
 {
  "name": "Total No. of Shopping & Purchase Transaction",
  "how": "Count of transactions mapped to 'Shopping & Purchase' (ledger categories Online Shopping/Clothing/Household).",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of Investment Expense Transaction",
  "how": "Count of transactions mapped to 'Investment Expense' (same-named ledger category).",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of Loan & EMI Payment Transaction",
  "how": "Count of transactions mapped to 'Loan & EMI Payment' (ledger categories Loan/Business Loan).",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 4."
 },
 {
  "name": "Total No. of Insurance Transaction",
  "how": "Count of transactions mapped to 'Insurance' (ledger category Insurance).",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 1."
 },
 {
  "name": "Total No. of Tax Transaction",
  "how": "Count of transactions mapped to 'Tax' — the mapper never emits this bucket, so this row is always 0.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of Gaming Transaction",
  "how": "Count of transactions whose description matches the GAMING regex (checked before category mapping).",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of Transfer to Wallet Transaction",
  "how": "Count for 'Transfer to Wallet' — the mapper never emits this bucket ('Transfer to *' goes to Transfer Out), so always 0.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of Transfer Out Transaction",
  "how": "Count of transactions whose ledger category starts with 'Transfer to' (mapped to 'Transfer Out').",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 687."
 },
 {
  "name": "Total No. of Foreign Wallet Transaction",
  "how": "Count for 'Foreign Wallet' — the mapper never emits this bucket, so always 0.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of Reversal Transaction",
  "how": "Count of transactions mapped to 'Reversal' (ledger category Reversal).",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of CreditCard Payment Transaction",
  "how": "Count of transactions mapped to 'CreditCard Payment' (ledger category Credit Card Payment).",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of Cash Withdrawals Transaction",
  "how": "Count of transactions mapped to 'Cash Withdrawals' (ledger category Cash Withdrawal).",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 3."
 },
 {
  "name": "Total No. of Personal Loan Transaction",
  "how": "Count for 'Personal Loan' — the mapper never emits this bucket (loans go to Loan & EMI Payment), so always 0.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of Home Loan Transaction",
  "how": "Count for 'Home Loan' — the mapper never emits this bucket, so always 0.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of Auto Loan Transaction",
  "how": "Count for 'Auto Loan' — the mapper never emits this bucket, so always 0.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of Medical Transaction",
  "how": "Count for 'Medical' — the mapper never emits this bucket, so always 0.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of Charges Transaction",
  "how": "Count of transactions mapped to 'Charges' (ledger categories Bank Charges / Bounced I/W ECS Charges).",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of Salary Paid Transaction",
  "how": "Count of transactions mapped to 'Salary Paid' (ledger category Salary Paid — outbound payroll).",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "Total No. of Other Category Transaction",
  "how": "Count of transactions matching no alcohol/gaming regex, no 'Transfer to' prefix, and no _CAT_MAP entry — the residual bucket.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 639."
 },
 {
  "name": "Total Amount of Bills & Utilities Transaction",
  "how": "Sum of absolute amounts (credits and debits both counted as positive) of transactions in the 'Bills & Utilities' bucket.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹9,440."
 },
 {
  "name": "Total Amount of Food Transaction",
  "how": "Sum of absolute amounts of transactions in the 'Food' bucket.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of Alcohol Transaction",
  "how": "Sum of absolute amounts of transactions whose description matches the ALCOHOL regex.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of Travel Transaction",
  "how": "Sum of absolute amounts of transactions in the 'Travel' bucket.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of Entertainment & Lifestyle Transaction",
  "how": "Sum of absolute amounts of transactions in the 'Entertainment & Lifestyle' bucket.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹159."
 },
 {
  "name": "Total Amount of Shopping & Purchase Transaction",
  "how": "Sum of absolute amounts of transactions in the 'Shopping & Purchase' bucket (Online Shopping/Clothing/Household).",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of Investment Expense Transaction",
  "how": "Sum of absolute amounts of transactions in the 'Investment Expense' bucket.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of Loan & EMI Payment Transaction",
  "how": "Sum of absolute amounts of transactions in the 'Loan & EMI Payment' bucket (Loan/Business Loan).",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹9,750."
 },
 {
  "name": "Total Amount of Insurance Transaction",
  "how": "Sum of absolute amounts of transactions in the 'Insurance' bucket.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹1,000."
 },
 {
  "name": "Total Amount of Tax Transaction",
  "how": "Sum of absolute amounts for the 'Tax' bucket — never emitted by the mapper, so always 0.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of Gaming Transaction",
  "how": "Sum of absolute amounts of transactions whose description matches the GAMING regex.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of Transfer to Wallet Transaction",
  "how": "Sum of absolute amounts for 'Transfer to Wallet' — never emitted by the mapper, so always 0.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of Transfer Out Transaction",
  "how": "Sum of absolute amounts of transactions whose ledger category starts with 'Transfer to'.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹1,768,922.32."
 },
 {
  "name": "Total Amount of Foreign Wallet Transaction",
  "how": "Sum of absolute amounts for 'Foreign Wallet' — never emitted by the mapper, so always 0.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of Reversal Transaction",
  "how": "Sum of absolute amounts of transactions in the 'Reversal' bucket.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of CreditCard Payment Transaction",
  "how": "Sum of absolute amounts of transactions in the 'CreditCard Payment' bucket.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of Cash Withdrawals Transaction",
  "how": "Sum of absolute amounts of transactions in the 'Cash Withdrawals' bucket.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹40,000."
 },
 {
  "name": "Total Amount of Personal Loan Transaction",
  "how": "Sum of absolute amounts for 'Personal Loan' — never emitted by the mapper, so always 0.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of Home Loan Transaction",
  "how": "Sum of absolute amounts for 'Home Loan' — never emitted by the mapper, so always 0.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of Auto Loan Transaction",
  "how": "Sum of absolute amounts for 'Auto Loan' — never emitted by the mapper, so always 0.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of Medical Transaction",
  "how": "Sum of absolute amounts for 'Medical' — never emitted by the mapper, so always 0.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of Charges Transaction",
  "how": "Sum of absolute amounts of transactions in the 'Charges' bucket (Bank Charges / Bounced I/W ECS Charges).",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of Salary Paid Transaction",
  "how": "Sum of absolute amounts of transactions in the 'Salary Paid' bucket.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹0."
 },
 {
  "name": "Total Amount of Other Category Transaction",
  "how": "Sum of absolute amounts of transactions falling into the residual 'Other Category' bucket.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹2,213,259."
 },
 {
  "name": "Total No. of Business Credit Transactions",
  "how": "Count of credits (money coming IN) excluding categories Cash Deposit, Loan Disbursed, Subsidy, Interest, Reversal, Transfer from Self, Cash Back and any 'Transfer to *' category.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 566."
 },
 {
  "name": "Total Amount of Business Credit Transactions",
  "how": "Sum of amounts of those business credits (same exclusion list).",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹2,033,732."
 },
 {
  "name": "Total No. of Business Debit Transactions",
  "how": "Count of debits (money going OUT) excluding categories Loan, Business Loan and Transfer to Self.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 806."
 },
 {
  "name": "Total Amount of Business Debit Transactions",
  "how": "Sum of magnitudes (negated amounts) of those business debits.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹1,999,048.32."
 },
 {
  "name": "Debit/Credit Ratio",
  "how": "Month's total debit magnitude divided by total credit amount, blank when the month has no credits.",
  "ex": "e.g. Feb-2026 in Mr. PALA SRINIVAS's statement: 0.97. (No single Overall figure — this metric is month-by-month.)"
 },
 {
  "name": "Average Credit Amount",
  "how": "Mean of the amounts of all credit transactions (money coming IN) in the month.",
  "ex": "e.g. Feb-2026 in Mr. PALA SRINIVAS's statement: ₹6,975.61. (No single Overall figure — this metric is month-by-month.)"
 },
 {
  "name": "Surplus Amount",
  "how": "Net of the month's signed amounts — total credits minus total debits —.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is ₹24,933.68."
 },
 {
  "name": "Loan Disbursal Flag",
  "how": "1 if the month contains any 'Loan Disbursed'-categorised transaction else 0.",
  "ex": "In Mr. PALA SRINIVAS's statement the Overall figure is 0."
 },
 {
  "name": "FOIR",
  "how": "Always emitted as blank — computing FOIR needs a proposed-EMI / eligible-income policy input the ledger doesn't have.",
  "ex": "Always blank here — FOIR needs the proposed EMI, which the statement alone doesn't contain (enter it on Upload for FOIR context)."
 },
 {
  "name": "Recommended Date Range for NACH",
  "how": "Always emitted as blank — no NACH date-range recommendation is computed from the ledger.",
  "ex": "Always blank here — a NACH date recommendation needs a policy input beyond the ledger."
 }
];
