"""Digitap-parity Analysis metrics — reproduces Digitap's ~230-row Analysis
sheet (per calendar month + Overall) from the categorised ledger, so BankIQ
covers what the Digitap 'Analysis' tab emits.

Every value is recomputable from the transaction table; metrics that need an
input we don't have (proposed EMI for FOIR, etc.) are emitted as "" like
Digitap does, never a garbage value."""
import datetime
import statistics
from collections import defaultdict

from .insights import rail_of, ALCOHOL, GAMING
from bankiq.analyze import eod_grid


def _all_months(txns):
    """Every calendar month spanned by the statement, incl. a trailing partial
    month — Digitap keeps it (e.g. 'July 2026*'), so the Overall totals match
    the full-statement figures shown on the Summary/JSON/Perfios."""
    if not txns:
        return []
    start, end = txns[0]["date"], txns[-1]["date"]
    out, cur = [], datetime.date(start.year, start.month, 1)
    stop = datetime.date(end.year, end.month, 1)
    while cur <= stop:
        out.append(cur)
        cur = datetime.date(cur.year + (cur.month == 12), cur.month % 12 + 1, 1)
    return out

# my-category -> Digitap category bucket
_CAT_MAP = {
    "Fuel": "Bills & Utilities", "Utilities": "Bills & Utilities",
    "Utilities (Phone)": "Bills & Utilities", "Utilities (Cable TV)": "Bills & Utilities",
    "Food": "Food", "Travel": "Travel", "Entertainment": "Entertainment & Lifestyle",
    "Online Shopping": "Shopping & Purchase", "Clothing": "Shopping & Purchase",
    "Household": "Shopping & Purchase", "Investment Expense": "Investment Expense",
    "Loan": "Loan & EMI Payment", "Business Loan": "Loan & EMI Payment",
    "Insurance": "Insurance", "Credit Card Payment": "CreditCard Payment",
    "Cash Withdrawal": "Cash Withdrawals", "Reversal": "Reversal",
    "Bank Charges": "Charges", "Bounced I/W ECS Charges": "Charges",
    "Salary Paid": "Salary Paid", "Software": "Bills & Utilities",
}
_CAT_LABELS = ["Bills & Utilities", "Food", "Alcohol", "Travel", "Entertainment & Lifestyle",
               "Shopping & Purchase", "Investment Expense", "Loan & EMI Payment", "Insurance",
               "Tax", "Gaming", "Transfer to Wallet", "Transfer Out", "Foreign Wallet",
               "Reversal", "CreditCard Payment", "Cash Withdrawals", "Personal Loan",
               "Home Loan", "Auto Loan", "Medical", "Charges", "Salary Paid", "Other Category"]

# rail_of() output -> Digitap rail name
_RAIL_MAP = {"CASH": "CASH", "NEFT": "NEFT", "RTGS": "RTGS", "IMPS": "IMPS", "UPI": "UPI",
             "CARD": "Debit Card", "CHEQUE": "Cheque", "NACH/ECS": "NACH", "ATM": "ATM",
             "AEPS": "ATM", "UPI-ATM": "ATM"}
_RAIL_LABELS = ["CASH", "NEFT", "RTGS", "IMPS", "UPI", "Debit Card", "Cheque", "NACH", "ATM",
                "Fund Transfer", "Other"]


def _digitap_cat(t):
    d = t["desc"] or ""
    if ALCOHOL.search(d):
        return "Alcohol"
    if GAMING.search(d):
        return "Gaming"
    c = t["category"]
    if c.startswith("Transfer to"):
        return "Transfer Out"
    if c in _CAT_MAP:
        return _CAT_MAP[c]
    return "Other Category"


def _digitap_rail(t):
    r = rail_of(t["desc"])
    return _RAIL_MAP.get(r, "Fund Transfer" if r == "OTHER" else "Other")


def _median(xs):
    return round(statistics.median(xs), 2) if xs else ""


def _mean(xs):
    return round(sum(xs) / len(xs), 2) if xs else ""


def build_analysis(meta, rep):
    txns = meta["transactions"]
    # full statement months (incl. trailing partial) so Overall == full-statement
    # totals shown everywhere else (Summary / JSON / Perfios / Digitap)
    months = _all_months(txns)
    grid = eod_grid(txns, months)           # month(date) -> [31 carry-forward closes]
    mk = [(m.year, m.month) for m in months]
    by_month = {k: [] for k in mk}
    for t in txns:
        k = (t["date"].year, t["date"].month)
        if k in by_month:
            by_month[k].append(t)

    def opening_of(mtxns, m):
        if mtxns:
            return round(mtxns[0]["balance"] - mtxns[0]["amount"], 2)
        return ""

    def day_close(m, day):
        col = grid[datetime.date(m.year, m.month, 1)]
        return col[day - 1] if day - 1 < len(col) and col[day - 1] is not None else None

    def valid_closes(m):
        col = grid[datetime.date(m.year, m.month, 1)]
        return [v for v in col if v is not None]

    metrics = []          # (label, {monthkey: value}, overall)

    def add(label, fn, overall_fn=None):
        vals = {}
        for m, k in zip(months, mk):
            vals[k] = fn(by_month[k], m, k)
        ov = overall_fn(vals) if overall_fn else ""
        metrics.append((label, vals, ov))

    sum_ov = lambda vals: round(sum(v for v in vals.values() if isinstance(v, (int, float))), 2)
    cnt_ov = lambda vals: sum(v for v in vals.values() if isinstance(v, (int, float)))

    # ---- balances
    add("Min Balance", lambda ts, m, k: (min(valid_closes(m)) if valid_closes(m) else ""),
        lambda v: min((x for x in v.values() if isinstance(x, (int, float))), default=""))
    add("Max Balance", lambda ts, m, k: (max(valid_closes(m)) if valid_closes(m) else ""),
        lambda v: max((x for x in v.values() if isinstance(x, (int, float))), default=""))
    add("Average EOD Balance", lambda ts, m, k: _mean(valid_closes(m)),
        lambda v: _mean([x for x in v.values() if isinstance(x, (int, float))]))
    add("Monthly Average Balance", lambda ts, m, k: _mean(valid_closes(m)))
    add("Average EOD Balance on 3rd 4th 5th 6th 7th",
        lambda ts, m, k: _mean([day_close(m, d) for d in (3, 4, 5, 6, 7) if day_close(m, d) is not None]))
    add("Average EOD Balance on 3rd 4th 6th 7th",
        lambda ts, m, k: _mean([day_close(m, d) for d in (3, 4, 6, 7) if day_close(m, d) is not None]))
    add("Average EOD Balance on 1st 5th 10th 15th 25th",
        lambda ts, m, k: _mean([day_close(m, d) for d in (1, 5, 10, 15, 25) if day_close(m, d) is not None]))
    add("Average EOD Balance on 2nd 10th 20th",
        lambda ts, m, k: _mean([day_close(m, d) for d in (2, 10, 20) if day_close(m, d) is not None]))
    add("Avg balance till 10th of month",
        lambda ts, m, k: _mean([day_close(m, d) for d in range(1, 11) if day_close(m, d) is not None]))
    add("Avg balance till 20th of month",
        lambda ts, m, k: _mean([day_close(m, d) for d in range(1, 21) if day_close(m, d) is not None]))
    add("Avg balance till last date of month", lambda ts, m, k: _mean(valid_closes(m)))
    add("Balance on 1st", lambda ts, m, k: day_close(m, 1) if day_close(m, 1) is not None else "")
    add("Balance on 14th", lambda ts, m, k: day_close(m, 14) if day_close(m, 14) is not None else "")
    add("Balance on 30th", lambda ts, m, k: next((day_close(m, d) for d in (30, 29, 28) if day_close(m, d) is not None), ""))
    add("ABB on 1st,14th, 30th/Last Day",
        lambda ts, m, k: _mean([v for v in (day_close(m, 1), day_close(m, 14),
                                            next((day_close(m, d) for d in (31, 30, 29, 28) if day_close(m, d) is not None), None)) if v is not None]))
    add("Median EOD Balance", lambda ts, m, k: _median(valid_closes(m)))
    add("First Day EOD Balance", lambda ts, m, k: day_close(m, 1) if day_close(m, 1) is not None else "")
    add("Last Day EOD Balance", lambda ts, m, k: (valid_closes(m)[-1] if valid_closes(m) else ""))
    add("Opening", lambda ts, m, k: opening_of(ts, m))
    add("Closing Balance", lambda ts, m, k: (ts[-1]["balance"] if ts else ""))

    # ---- credit / debit counts + amounts
    add("Total No. of Credit Transactions", lambda ts, m, k: sum(1 for t in ts if t["amount"] > 0), cnt_ov)
    add("Total Amount of Credit Transactions", lambda ts, m, k: round(sum(t["amount"] for t in ts if t["amount"] > 0), 2), sum_ov)
    add("Min Amount of Credit Transactions", lambda ts, m, k: (round(min((t["amount"] for t in ts if t["amount"] > 0), default=0), 2) or ""))
    add("Max Amount of Credit Transactions", lambda ts, m, k: (round(max((t["amount"] for t in ts if t["amount"] > 0), default=0), 2) or ""))
    add("Total No. of Debit Transactions", lambda ts, m, k: sum(1 for t in ts if t["amount"] < 0), cnt_ov)
    add("Total Amount of Debit Transactions", lambda ts, m, k: round(-sum(t["amount"] for t in ts if t["amount"] < 0), 2), sum_ov)
    add("Min Amount of Debit Transactions", lambda ts, m, k: (round(min((-t["amount"] for t in ts if t["amount"] < 0), default=0), 2) or ""))
    add("Max Amount of Debit Transactions", lambda ts, m, k: (round(max((-t["amount"] for t in ts if t["amount"] < 0), default=0), 2) or ""))
    add("Total No. of Net Credit Transactions Above 1000", lambda ts, m, k: sum(1 for t in ts if t["amount"] > 1000), cnt_ov)
    add("Total Net Credit Amount Above 1000", lambda ts, m, k: round(sum(t["amount"] for t in ts if t["amount"] > 1000), 2), sum_ov)
    add("Total No. of Net Debit Transactions Above 1000", lambda ts, m, k: sum(1 for t in ts if t["amount"] < -1000), cnt_ov)
    add("Total Net Debit Amount Above 1000", lambda ts, m, k: round(-sum(t["amount"] for t in ts if t["amount"] < -1000), 2), sum_ov)

    # ---- cash / loan / interest / charges
    add("Total No. of Cash Deposits", lambda ts, m, k: sum(1 for t in ts if t["category"] == "Cash Deposit"), cnt_ov)
    add("Total Amount of Cash Deposits", lambda ts, m, k: round(sum(t["amount"] for t in ts if t["category"] == "Cash Deposit"), 2), sum_ov)
    add("Total No. of Cash Withdrawals", lambda ts, m, k: sum(1 for t in ts if t["category"] == "Cash Withdrawal"), cnt_ov)
    add("Total Amount of Cash Withdrawals", lambda ts, m, k: round(-sum(t["amount"] for t in ts if t["category"] == "Cash Withdrawal"), 2), sum_ov)
    add("Total Amount of Loan Credit", lambda ts, m, k: round(sum(t["amount"] for t in ts if t["category"] == "Loan Disbursed"), 2), sum_ov)
    add("No. of EMI / loan payments", lambda ts, m, k: sum(1 for t in ts if t["category"] in ("Loan", "Business Loan")), cnt_ov)
    add("Total Amount of EMI / loan Payments", lambda ts, m, k: round(-sum(t["amount"] for t in ts if t["category"] in ("Loan", "Business Loan")), 2), sum_ov)
    add("Total Interest Received", lambda ts, m, k: round(sum(t["amount"] for t in ts if t["category"] == "Interest" and t["amount"] > 0), 2), sum_ov)
    add("No. of Bank Charges", lambda ts, m, k: sum(1 for t in ts if t["category"] in ("Bank Charges", "Bounced I/W ECS Charges")), cnt_ov)
    add("Amount of Bank Charges", lambda ts, m, k: round(-sum(t["amount"] for t in ts if t["category"] in ("Bank Charges", "Bounced I/W ECS Charges")), 2), sum_ov)
    add("Total No. of EMI Bounce count", lambda ts, m, k: sum(1 for t in ts if t["category"] == "Bounced I/W ECS Charges"), cnt_ov)

    # ---- salary
    add("Total No of Salary Credits", lambda ts, m, k: sum(1 for t in ts if t["category"] == "Salary"), cnt_ov)
    add("Total Amount of Salary Credits", lambda ts, m, k: round(sum(t["amount"] for t in ts if t["category"] == "Salary"), 2), sum_ov)
    add("Salary Flag (0 or 1)", lambda ts, m, k: 1 if any(t["category"] == "Salary" for t in ts) else 0,
        lambda v: 1 if any(x == 1 for x in v.values()) else 0)

    # ---- rails (count + amount, credit + debit)
    for direction, sign, dname in (("Credit", 1, "Credit"), ("Debit", -1, "Debit")):
        for rl in _RAIL_LABELS:
            def _cnt(ts, m, k, rl=rl, sign=sign):
                return sum(1 for t in ts if _digitap_rail(t) == rl and sign * t["amount"] > 0)
            add(f"Total No. of {rl} Transaction {dname}", _cnt, cnt_ov)
        for rl in _RAIL_LABELS:
            def _amt(ts, m, k, rl=rl, sign=sign):
                return round(sum(sign * t["amount"] for t in ts if _digitap_rail(t) == rl and sign * t["amount"] > 0), 2)
            add(f"Total Amount of {rl} Transaction {dname}", _amt, sum_ov)

    # ---- category grid (count + amount)
    for cl in _CAT_LABELS:
        def _ccnt(ts, m, k, cl=cl):
            return sum(1 for t in ts if _digitap_cat(t) == cl)
        add(f"Total No. of {cl} Transaction", _ccnt, cnt_ov)
    for cl in _CAT_LABELS:
        def _camt(ts, m, k, cl=cl):
            return round(sum(abs(t["amount"]) for t in ts if _digitap_cat(t) == cl), 2)
        add(f"Total Amount of {cl} Transaction", _camt, sum_ov)

    # ---- business credit/debit
    def biz_c(t):
        return t["amount"] > 0 and t["category"] not in ("Cash Deposit", "Loan Disbursed", "Subsidy",
                                                          "Interest", "Reversal", "Transfer from Self", "Cash Back") \
            and not t["category"].startswith("Transfer to")
    def biz_d(t):
        return t["amount"] < 0 and t["category"] not in ("Loan", "Business Loan", "Transfer to Self")
    add("Total No. of Business Credit Transactions", lambda ts, m, k: sum(1 for t in ts if biz_c(t)), cnt_ov)
    add("Total Amount of Business Credit Transactions", lambda ts, m, k: round(sum(t["amount"] for t in ts if biz_c(t)), 2), sum_ov)
    add("Total No. of Business Debit Transactions", lambda ts, m, k: sum(1 for t in ts if biz_d(t)), cnt_ov)
    add("Total Amount of Business Debit Transactions", lambda ts, m, k: round(-sum(t["amount"] for t in ts if biz_d(t)), 2), sum_ov)

    # ---- derived ratios / surplus / flags
    add("Debit/Credit Ratio", lambda ts, m, k: (round(-sum(t["amount"] for t in ts if t["amount"] < 0) / sum(t["amount"] for t in ts if t["amount"] > 0), 4)
                                                 if sum(t["amount"] for t in ts if t["amount"] > 0) else ""))
    add("Average Credit Amount", lambda ts, m, k: _mean([t["amount"] for t in ts if t["amount"] > 0]))
    add("Surplus Amount", lambda ts, m, k: round(sum(t["amount"] for t in ts), 2), sum_ov)
    add("Loan Disbursal Flag", lambda ts, m, k: 1 if any(t["category"] == "Loan Disbursed" for t in ts) else 0,
        lambda v: 1 if any(x == 1 for x in v.values()) else 0)
    add("FOIR", lambda ts, m, k: "")   # needs proposed EMI / eligible income policy input
    add("Recommended Date Range for NACH", lambda ts, m, k: "")

    header = {
        "Name of the Account Holder": rep["display_name"],
        "Account Number": meta.get("account_no"),
        "Name of the Bank": meta["bank"],
        "Account Type": meta.get("account_type"),
        "IFSC Code": meta.get("ifsc"),
        "Missing Transactions Date Range": "[]",
        "Statement Period": f"{txns[0]['date'].isoformat()} to {txns[-1]['date'].isoformat()}" if txns else "",
    }
    return {
        "header": header,
        "months": [m.isoformat() for m in months],
        "metrics": [{"label": lbl, "values": [vals[k] for k in mk], "overall": ov}
                    for lbl, vals, ov in metrics],
    }
