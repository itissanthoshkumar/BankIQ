"""Derived analytics for the report workbook.

Windowing rule (from the reference reports): analysis months run from the
first transaction's month through the last COMPLETE month — the trailing
month is dropped unless the statement runs to its final day. Transactions1,
RoundTrippingParties and Party Xns cover the full statement; the monthwise
tables, EOD grid, Top-5, UPI, recurring and high-value sheets clip to the
window.
"""
import calendar
import datetime
import hashlib
import re
from collections import Counter, defaultdict

SELF_CATS = {"Transfer to Self", "Transfer from Self"}
LOAN_DEBIT_CATS = {"Loan", "Business Loan"}
HV_EXCLUDE = {"Loan", "Business Loan", "Loan Disbursed", "Transfer to Self", "Transfer from Self"}
# Top-5 parties ranks identifiable transfers and financial obligations only:
# every "Transfer to/from *" plus this whitelist. Retail spend (Alcohol,
# Utilities, Fuel...), cash, settlements and unidentified rows never rank.
TOP5_KEEP_NONTRANSFER = {"Loan", "Business Loan", "Loan Disbursed", "Credit Card Payment",
                         "Salary", "Salary Paid", "Interest"}


def _top5_eligible(cat):
    return cat.startswith("Transfer ") or cat in TOP5_KEEP_NONTRANSFER


def month_key(d):
    return (d.year, d.month)


def month_first(d):
    return datetime.date(d.year, d.month, 1)


def analysis_months(txns, period):
    start = txns[0]["date"] if txns else period[0]
    end = txns[-1]["date"] if txns else period[1]
    last_day = calendar.monthrange(end.year, end.month)[1]
    months = []
    cur = datetime.date(start.year, start.month, 1)
    stop = datetime.date(end.year, end.month, 1)
    if end.day < last_day:  # trailing partial month dropped
        stop = (stop - datetime.timedelta(days=1)).replace(day=1)
    while cur <= stop:
        months.append(cur)
        cur = datetime.date(cur.year + (cur.month == 12), cur.month % 12 + 1, 1)
    return months


def in_window(d, months):
    return bool(months) and months[0] <= datetime.date(d.year, d.month, 1) <= months[-1]


def is_upi(t):
    return "UPI" in (t["desc"] or "").upper() and t["category"] != "Bank Charges"


def opening_balance(txns):
    if not txns:
        return 0.0
    return round(txns[0]["balance"] - txns[0]["amount"], 2)


def eod_grid(txns, months):
    """{month: [balance or None for day 1..31]} with carry-forward."""
    last_bal = {}
    for t in txns:
        last_bal[t["date"]] = t["balance"]
    grid = {}
    bal = opening_balance(txns)
    for m in months:
        ndays = calendar.monthrange(m.year, m.month)[1]
        col = []
        for day in range(1, 32):
            if day > ndays:
                col.append(None)
                continue
            d = datetime.date(m.year, m.month, day)
            if d in last_bal:
                bal = last_bal[d]
            col.append(round(bal, 2))
        grid[m] = col
    return grid


def monthwise(txns, months):
    """The 27 metric rows of the Analysis monthwise table, in order."""
    def mt(m):
        return [t for t in txns if month_key(t["date"]) == (m.year, m.month)]

    rows = []
    per = {m: mt(m) for m in months}

    def series(fn):
        return [round(fn(per[m]), 2) for m in months]

    def cnt(pred):
        return series(lambda ts: sum(1 for t in ts if pred(t)))

    def amt(pred, sign=1):
        return series(lambda ts: sum(sign * t["amount"] for t in ts if pred(t)))

    gross_c = lambda t: t["amount"] > 0 and t["category"] not in SELF_CATS
    gross_d = lambda t: t["amount"] < 0 and t["category"] not in SELF_CATS
    biz_c = lambda t: gross_c(t) and t["category"] != "Loan Disbursed"
    biz_d = lambda t: gross_d(t) and t["category"] not in LOAN_DEBIT_CATS

    rows.append(("Gross Credits (Count)", cnt(gross_c)))
    rows.append(("Gross Credits (Amount)", amt(gross_c)))
    rows.append(("Self_Sister Credits (Amount)", amt(lambda t: t["category"] == "Transfer from Self")))
    rows.append(("Business Credits (Amount)", amt(biz_c)))
    rows.append(("Business Credits (Count)", cnt(biz_c)))
    rows.append(("Gross Debits (Count)", cnt(gross_d)))
    rows.append(("Gross Debits (Amount)", amt(gross_d, -1)))
    rows.append(("Business Debits (Amount)", amt(biz_d, -1)))
    rows.append(("Business Debits (Count)", cnt(biz_d)))
    rows.append(("Cash Deposits (Count)", cnt(lambda t: t["category"] == "Cash Deposit")))
    rows.append(("Cash Deposits (Amount)", amt(lambda t: t["category"] == "Cash Deposit")))
    rows.append(("Cash Withdrawals (Count)", cnt(lambda t: t["category"] == "Cash Withdrawal")))
    rows.append(("Cash Withdrawals (Amount)", amt(lambda t: t["category"] == "Cash Withdrawal", -1)))
    rows.append(("Loan Transactions (Amount)", amt(lambda t: t["category"] in LOAN_DEBIT_CATS, -1)))
    rows.append(("Loan Disbursed (Amount)", amt(lambda t: t["category"] == "Loan Disbursed")))
    rows.append(("Inward NonTechnical Bounces(Count)", cnt(lambda t: t["category"] == "_never_")))
    rows.append(("Inward NonTechnical Bounce (Amount)", amt(lambda t: t["category"] == "_never_")))
    rows.append(("Salary Credits (Count)", cnt(lambda t: t["category"] == "Salary")))
    rows.append(("Salary Credits (Amount)", amt(lambda t: t["category"] == "Salary")))
    rows.append(("Cheque Issues (Count)", cnt(lambda t: bool(t.get("cheque")) and t["amount"] < 0)))
    rows.append(("Cheque Issues (Amount)", amt(lambda t: bool(t.get("cheque")) and t["amount"] < 0, -1)))
    rows.append(("Outward Cheque Bounces (Count)", cnt(lambda t: t["category"] == "_never_")))
    rows.append(("Outward Cheque Bounce (Amount)", amt(lambda t: t["category"] == "_never_")))
    rows.append(("Cheque Deposits (Count)", cnt(lambda t: bool(t.get("cheque")) and t["amount"] > 0)))
    rows.append(("Cheque Deposits (Amount)", amt(lambda t: bool(t.get("cheque")) and t["amount"] > 0)))
    rows.append(("Inward Cheque Bounces (Count)", cnt(lambda t: t["category"] == "_never_")))
    rows.append(("Inward Cheque Bounce (Amount)", amt(lambda t: t["category"] == "_never_")))
    return rows


def top5(txns, months, credit=True):
    out = {}
    for m in months:
        agg = defaultdict(float)
        for t in txns:
            if month_key(t["date"]) != (m.year, m.month):
                continue
            c = t["category"]
            if not _top5_eligible(c):
                continue
            if credit and t["amount"] > 0:
                agg[c] += t["amount"]
            elif not credit and t["amount"] < 0:
                agg[c] += -t["amount"]
        # rank by amount desc, ties broken alphabetically
        out[m] = sorted(agg.items(), key=lambda kv: (-kv[1], kv[0]))[:5]
    return out


def high_value(txns, months, credit=True):
    out = []
    for t in txns:
        if not in_window(t["date"], months):
            continue
        if t["category"] in HV_EXCLUDE:
            continue
        if credit and t["amount"] > 10000:
            out.append(t)
        elif not credit and t["amount"] < -10000:
            out.append(t)
    return out


def recurring(txns, months, credit=True):
    """Approximation of the recurring sheets: per category/party streams with
    >=3 transactions spanning >=3 distinct months (window-clipped)."""
    streams = defaultdict(list)
    for t in txns:
        if not in_window(t["date"], months):
            continue
        if credit and t["amount"] <= 0:
            continue
        if not credit and t["amount"] >= 0:
            continue
        c = t["category"]
        if c in SELF_CATS or c in ("Interest", "Bank Charges", "Reversal", "Others",
                                   "Cash Deposit", "Cash Withdrawal", "Loan Disbursed"):
            continue
        streams[c].append(t)
    groups = []
    for c, ts in streams.items():
        m = {month_key(t["date"]) for t in ts}
        if len(ts) >= 3 and len(m) >= 3:
            groups.append((min(t["date"] for t in ts), ts))
    groups.sort(key=lambda g: g[0])
    return [(i + 1, sorted(ts, key=lambda t: (t["date"],))) for i, (_, ts) in enumerate(groups)]


_PARTY_TOKEN = re.compile(r"^Transfer (?:to|from) (.+)$")


def _rt_token(t, meta):
    """Squashed party key for round-tripping, from UPI transactions only."""
    if not is_upi(t):
        return None
    m = _PARTY_TOKEN.match(t["category"] or "")
    if not m:
        return None
    name = m.group(1)
    if name in ("Self",):
        from .categorize import _clean_party
        name = (meta.get("name") or "SELF")[:8]
    key = re.sub(r"[^A-Za-z0-9]", "", name)
    return key or None


def round_tripping(txns, meta):
    cred = defaultdict(list)
    deb = defaultdict(list)
    for t in txns:
        k = _rt_token(t, meta)
        if not k:
            continue
        (cred if t["amount"] > 0 else deb)[k].append(t)
    parties = sorted(set(cred) & set(deb))
    rows, blocks = [], []
    for p in parties:
        cs, ds = cred[p], deb[p]
        rows.append((p, len(cs), round(sum(t["amount"] for t in cs), 2),
                     len(ds), round(sum(t["amount"] for t in ds), 2)))
        blocks.append((p, sorted(cs, key=lambda t: t["date"]) + sorted(ds, key=lambda t: t["date"])))
    return rows, blocks


# ------------------------------------------------------------------ FCU
def _amb(grid, m):
    vals = [v for v in grid[m] if v is not None]
    return sum(vals) / len(vals) if vals else 0.0


def _non_upi_credit(t):
    return t["amount"] > 0 and not is_upi(t) and t["category"] not in SELF_CATS


def fcu_triggers(txns, months, grid, meta):
    """Returns ordered list of identified triggers:
    {title, desc, remark, rows (list|None), grouped (bool)}"""
    win = [t for t in txns if in_window(t["date"], months)]
    ambs = {m: _amb(grid, m) for m in months}
    full_months = [m for m in months
                   if not (txns and (txns[0]["date"].year, txns[0]["date"].month) == (m.year, m.month)
                           and txns[0]["date"].day > 3)]
    triggers = []

    # 1. Credit followed only by cash withdrawal
    cw_rows = []
    cws = [t for t in win if t["category"] == "Cash Withdrawal"]
    for w in cws:
        creds = [t for t in win if _non_upi_credit(t)
                 and 0 <= (w["date"] - t["date"]).days <= 1]
        same_day_after = [t for t in win if _non_upi_credit(t) and t["date"] == w["date"]]
        pool = {id(t): t for t in creds + same_day_after}
        if creds:
            cw_rows.extend(pool.values())
            cw_rows.append(w)
    seen = set()
    cw_list = []
    for t in sorted(cw_rows, key=lambda t: (t["date"], txns.index(t))):
        if id(t) not in seen:
            seen.add(id(t))
            cw_list.append(t)
    if cw_list:
        triggers.append(dict(
            title="Credit followed only by cash withdrawal",
            desc="Cumulative Credits in a day through cheque/NEFT/RTGS/Cash deposit followed by only cash withdrawals",
            remark=len(cw_list), rows=cw_list, grouped=False,
            section="Credit followed only by cash withdrawals"))

    # 2. Irregular EMI (approximation: loan streams whose day-of-month varies)
    emi = defaultdict(list)
    for t in win:
        if t["category"] in LOAN_DEBIT_CATS:
            key = round(abs(t["amount"]))
            emi[key].append(t)
    irregular = []
    for key, ts in sorted(emi.items(), key=lambda kv: min(t["date"] for t in kv[1])):
        mset = {month_key(t["date"]) for t in ts}
        days = {t["date"].day for t in ts}
        if len(mset) >= 2 and len(days) > 1 and len(ts) >= 3:
            irregular.append(ts)
    if irregular:
        rows = []
        for gi, ts in enumerate(irregular, 1):
            for t in sorted(ts, key=lambda t: t["date"]):
                rows.append((gi, t))
        triggers.append(dict(
            title="Irregular EMI Transaction",
            desc="EMI/ECS type transactions which did not happen on Same day of every Month.",
            remark=len(irregular), rows=rows, grouped=True,
            section="Irregular EMI Transactions"))

    salary = [t for t in win if t["category"] == "Salary"]
    salary_paid = [t for t in win if t["category"] == "Salary Paid"]
    total_salary = sum(t["amount"] for t in salary)
    total_cd = sum(t["amount"] for t in win if t["category"] == "Cash Deposit")
    gross_credits = sum(t["amount"] for t in win if t["amount"] > 0 and t["category"] not in SELF_CATS)

    # 3. Suspicious mode of salary
    susp_sal = [t for t in salary if is_upi(t) or "IMPS" in t["desc"].upper()]
    if susp_sal:
        triggers.append(dict(
            title="Suspicious mode of salary",
            desc="Salary txns with mode of payment as IMPS, MPAY, UPI or cheque",
            remark=len(susp_sal), rows=susp_sal, grouped=False,
            section="Suspicious Mode of Salary"))

    # 4. Suspicious salary debits
    if salary_paid:
        triggers.append(dict(
            title="Suspicious salary  debits",
            desc="Transactions categorised as Salary Paid",
            remark=len(salary_paid), rows=salary_paid, grouped=False,
            section="Salary Paid Transactions"))

    # 5. Immediate big debit after salary credit
    big_after = []
    for s in salary:
        debs = [t for t in win if t["amount"] < 0 and 0 <= (t["date"] - s["date"]).days <= 2
                and abs(t["amount"]) >= 0.5 * s["amount"]]
        if debs:
            big_after.append(s)
            big_after.extend(debs[:2])
    if big_after:
        seen2, rows5 = set(), []
        for t in sorted(big_after, key=lambda t: (t["date"], txns.index(t))):
            if id(t) not in seen2:
                seen2.add(id(t))
                rows5.append(t)
        remark = ("Not primary account" if total_salary < 0.25 * max(gross_credits, 1)
                  else len(rows5))
        triggers.append(dict(
            title="Immediate big debit after Salary credit",
            desc="Withdrawal of big amount of money soon after salary credit may be due to forged salary entries.",
            remark=remark, rows=rows5, grouped=False,
            section="Immediate big debit after Salary credit"))

    # 6. Irregular salary credits (no detail section)
    if salary:
        sal_months = {month_key(t["date"]) for t in salary}
        missing = len(full_months) - len({m for m in map(lambda x: (x.year, x.month), full_months)} & sal_months)
        if missing > 0:
            triggers.append(dict(
                title="Irregular Salary Credits",
                desc="Salary Credits which are not in all months within a narrow date range.",
                remark=f"{missing} in {len(full_months)} months ", rows=None, grouped=False,
                section=None))

    # 7. More and frequent cash deposits than salary
    if salary and total_cd > total_salary > 0:
        ratio = round(total_cd / total_salary, 2)
        rows7 = sorted([t for t in win if t["category"] in ("Cash Deposit", "Salary")],
                       key=lambda t: (t["date"], txns.index(t)))
        triggers.append(dict(
            title="More and frequent Cash Deposits than Salary",
            desc="Higher number or amount of cash deposits than salary is an unlikely scenario.",
            remark=f"Cash deposit is {ratio} times the salary deposited",
            rows=rows7, grouped=False,
            section="More and frequent Cash Deposits than Salary"))

    # 8. NEFT/RTGS deposits > 2x AMB
    neft = [t for t in win if t["amount"] > 0 and re.search(r"NEFT|RTGS", t["desc"] or "")
            and t["category"] not in SELF_CATS
            and t["amount"] > 2 * ambs[month_first(t["date"])]]
    if neft:
        triggers.append(dict(
            title="NEFT/RTGS Deposits greater than twice the AMB",
            desc="NEFT/RTGS  greater than 2 times of Average Monthly Balance",
            remark=len(neft), rows=neft, grouped=False,
            section="NEFT/RTGS greater than AMB"))

    # 9. Cash deposits > 2x AMB
    cd = [t for t in win if t["category"] == "Cash Deposit"
          and t["amount"] > 2 * ambs[month_first(t["date"])]]
    if cd:
        triggers.append(dict(
            title="Cash Deposits greater than twice the AMB",
            desc="All credits of Cash deposits greater than 2 times of Average Monthly Balance",
            remark=len(cd), rows=cd, grouped=False,
            section="Cash Deposits greater than AMB"))

    # 10. Rounded salary transactions
    rounded = [t for t in salary if abs(t["amount"]) % 100 == 0]
    if rounded:
        triggers.append(dict(
            title="Rounded salary transaction",
            desc="Salary transactions with rounded amount value",
            remark=len(rounded), rows=rounded, grouped=False,
            section="Rounded Salary transactions"))

    # 11. Credit followed only by cash withdrawal for three months
    if cw_list and len({month_key(t["date"]) for t in cw_list if t["category"] == "Cash Withdrawal"}) >= 3:
        triggers.append(dict(
            title="Credit followed only by cash withdrawal for three months",
            desc="Cumulative Credits in a day through cheque/NEFT/RTGS/Cash deposit followed by only cash withdrawals, observed for three months",
            remark=len(cw_list), rows=cw_list, grouped=False,
            section="Credit followed only by cash withdrawal for three months"))
    return triggers


# ------------------------------------------------------------------ report
def build_report(meta):
    txns = meta["transactions"]
    period = meta.get("period") or (txns[0]["date"], txns[-1]["date"])
    months = analysis_months(txns, period)
    grid = eod_grid(txns, months)
    win_upi = [t for t in txns if is_upi(t) and in_window(t["date"], months)]
    rt_rows, rt_blocks = round_tripping(txns, meta)
    trig = fcu_triggers(txns, months, grid, meta)

    acct_type = meta.get("account_type")
    derived_type = "Savings_Account" if acct_type and "saving" in acct_type.lower() else "Other_Account"

    h = hashlib.sha1((meta.get("account_no") or "x").encode()).hexdigest().upper()
    prefix = re.sub(r"[^A-Z0-9]", "", h)[:4]
    epoch_ms = int(datetime.datetime.now().timestamp() * 1000)
    perfios_id = f"{prefix}{epoch_ms}"

    display_name = meta.get("account_name") or meta.get("name") or ""

    return dict(
        meta=meta,
        months=months,
        display_name=display_name,
        derived_type=derived_type,
        perfios_id=perfios_id,
        monthwise=monthwise(txns, months),
        eod=grid,
        top5_credit=top5(txns, months, True),
        top5_debit=top5(txns, months, False),
        upi=win_upi,
        # listing sheets (loan disbursal, salary, bounced) span the FULL statement,
        # unlike the window-clipped aggregation/analysis sheets
        loan_disb=[t for t in txns if t["category"] == "Loan Disbursed"],
        salary_rows=[t for t in txns if t["category"] == "Salary"],
        bounced_rows=[t for t in txns if t["category"] == "Bounced I/W ECS Charges"],
        recurring_credits=recurring(txns, months, True),
        recurring_debits=recurring(txns, months, False),
        hv_credit=high_value(txns, months, True),
        hv_debit=high_value(txns, months, False),
        round_trip=rt_rows,
        party_blocks=rt_blocks,
        fcu=trig,
    )
