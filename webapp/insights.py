"""Insight computations aligned with the BankIQ FSD, derived from the
categorized transaction table. Every figure here is recomputable from the
ledger (FSD principle 4) — nothing is silently netted (principle 1)."""
import datetime
import re
from collections import Counter, defaultdict

# ------------------------------------------------------------------ rails
_RAIL_RULES = [
    ("NACH/ECS", r"MAND\s?DR|CMP MANDATE|ACHDr|NACH|/ECS|\bECS\b"),
    ("AEPS", r"AEPS"),
    ("UPI-ATM", r"ATMWDL|ATM WDL"),
    ("ATM", r"ATM CASH|TO ATM WDL|ATM/|\bATM\b"),
    ("UPI", r"\bUPI[A-Z]*/|/UPI/|\bUPI\b"),   # UPIAR/ UPIAB/ UPIRV/ UPI/DR UPI/CR
    ("IMPS", r"\bIMPS\b|IMPS[A-Z]*\d"),
    ("RTGS", r"\bRTGS\b"),
    ("NEFT", r"\bNEFT\b"),
    ("CASH", r"^BY CASH|^CDM\d|CASH DEP|^SELF$"),
    ("CARD", r"\b\d{16}\b|CREDIT CARD"),
    ("CHARGE", r"CHARGES|ANN\.FEE|AMC |SMS Charges"),
    ("INTEREST", r"Int\.Pd|CREDIT INTEREST"),
]


def rail_of(desc):
    d = desc or ""
    for name, pat in _RAIL_RULES:
        if re.search(pat, d, re.I):
            return name
    return "OTHER"


def remitter_of(desc):
    """Raw counterparty (remitter/beneficiary) token from the narration —
    Digitap's 'Remitter Beneficiary' column, independent of category."""
    d = desc or ""
    m = re.search(r"UPI(?:AR|AB)/\d+/(?:DR|CR)/\s*([^/]+?)\s*/", d)      # UBI: UPIAR/num/DR/name
    if m:
        return m.group(1).strip()
    m = re.search(r"UPI/(?:DR|CR)/\d+/\s*([^/]+?)\s*/", d)               # CUB/SBI: UPI/DR/num/name
    if m:
        return m.group(1).strip()
    m = re.search(r"NEFT TRF:\s*([^-\n]+?)-", d)                        # CUB NEFT
    if m:
        return m.group(1).strip()
    m = re.search(r"NEFT[:*][^*]*\*[^*]*\*\s*([A-Za-z][^*\n]+)", d)     # SBI NEFT*..*..*NAME
    if m:
        return m.group(1).strip()
    m = re.search(r"IMPS[A-Z]{0,3}\d*:?\s*([A-Za-z][A-Za-z .]+?)/", d)  # IMPS narration
    if m:
        return m.group(1).strip()
    m = re.search(r"[A-Z]{2,4}-XX\d+-\s*([A-Za-z][^/\n]+?)/", d)         # SBI IMPS bank-XX-NAME
    if m:
        return m.group(1).strip()
    return ""


# ------------------------------------------------------------ dictionaries
ALCOHOL = re.compile(r"TASMAC|BEVCO|\bKSBC\b|APSBCL|TSBCL|KSBCL|\bMSIL\b|WINE SHOP|"
                     r"\bWINES\b|LIQUOR|BREWERY|\bBAR &", re.I)
GAMING = re.compile(r"DREAM11|DREAM BA|RUMMY|JUNGLEE|\bMPL\b|WINZO|MYTEAM11|MY11|"
                    r"POKER|1XBET|PARIMATCH|BETWAY|STAKE\.COM|DAFABET|LOTTERY|LOTTO|"
                    r"A23 GAMES|ZUPEE|GAMEZY|PROBO", re.I)

LOAN_CATS = {"Loan", "Business Loan"}
SELF_CATS = {"Transfer to Self", "Transfer from Self"}
INCOME_EXCLUDE = {"Cash Deposit", "Loan Disbursed", "Subsidy", "Interest", "Reversal",
                  "Transfer from Self", "Cash Back"}


def _rng(txns):
    ds = [t["date"] for t in txns]
    return (min(ds), max(ds)) if ds else (None, None)


def summary_block(meta, rep):
    txns = meta["transactions"]
    credits = [t for t in txns if t["amount"] > 0]
    debits = [t for t in txns if t["amount"] < 0]
    opening = round(txns[0]["balance"] - txns[0]["amount"], 2) if txns else 0.0
    closing = round(txns[-1]["balance"], 2) if txns else 0.0
    gc = round(sum(t["amount"] for t in credits), 2)
    gd = round(-sum(t["amount"] for t in debits), 2)
    biz_income = round(sum(t["amount"] for t in credits if t["category"] not in INCOME_EXCLUDE
                          and not t["category"].startswith("Transfer to")), 2)
    loan_debits = round(-sum(t["amount"] for t in txns if t["category"] in LOAN_CATS), 2)
    start, end = _rng(txns)
    return {
        "name": rep["display_name"],
        "bank": meta["bank"],
        "account_no": meta.get("account_no"),
        "account_type": meta.get("account_type"),
        "period_start": start.isoformat() if start else None,
        "period_end": end.isoformat() if end else None,
        "txn_count": len(txns),
        "opening_balance": opening,
        "closing_balance": closing,
        "gross_credits": gc,
        "gross_debits": gd,
        "credit_count": len(credits),
        "debit_count": len(debits),
        "classified_income": biz_income,
        "total_obligations": loan_debits,
        "obligation_to_inflow_pct": round(100 * loan_debits / gc, 1) if gc else None,
        "months_analyzed": len(rep["months"]),
    }


def category_breakdown(meta):
    """Spend/flow by simplified L1 group, for the donut/bars."""
    def l1(cat):
        if cat.startswith("Transfer to") or cat.startswith("Transfer from"):
            return "Self Transfer" if cat in SELF_CATS else "Transfers"
        if cat in LOAN_CATS or cat == "Loan Disbursed":
            return "Loan"
        if cat in ("Cash Deposit", "Cash Withdrawal"):
            return "Cash"
        if cat in ("UPI Settlement",):
            return "Merchant Settlement"
        if cat in ("Salary",):
            return "Salary"
        if cat in ("Interest", "Subsidy", "Cash Back", "Reversal"):
            return "Other Income"
        if cat in ("Bank Charges", "Bounced I/W ECS Charges", "Credit Card Payment"):
            return "Charges/Card"
        if cat in ("Alcohol", "Fuel", "Food", "Travel", "Household", "Clothing",
                   "Online Shopping", "Entertainment", "Software", "Insurance",
                   "Investment Expense", "Utilities", "Utilities (Phone)", "Utilities (Cable TV)"):
            return "Spend"
        return "Other"
    debit_by = defaultdict(lambda: [0, 0.0])
    credit_by = defaultdict(lambda: [0, 0.0])
    for t in meta["transactions"]:
        g = l1(t["category"])
        tgt = credit_by if t["amount"] > 0 else debit_by
        tgt[g][0] += 1
        tgt[g][1] += abs(t["amount"])
    def fmt(d):
        return sorted([{"group": k, "count": v[0], "amount": round(v[1], 2)}
                       for k, v in d.items()], key=lambda x: -x["amount"])
    return {"debits": fmt(debit_by), "credits": fmt(credit_by)}


def rails_block(meta):
    by = defaultdict(lambda: {"cr_count": 0, "cr_amt": 0.0, "dr_count": 0, "dr_amt": 0.0})
    for t in meta["transactions"]:
        r = rail_of(t["desc"])
        b = by[r]
        if t["amount"] > 0:
            b["cr_count"] += 1
            b["cr_amt"] += t["amount"]
        else:
            b["dr_count"] += 1
            b["dr_amt"] += -t["amount"]
    out = []
    for r, b in by.items():
        out.append({"rail": r, "cr_count": b["cr_count"], "cr_amt": round(b["cr_amt"], 2),
                    "dr_count": b["dr_count"], "dr_amt": round(b["dr_amt"], 2)})
    return sorted(out, key=lambda x: -(x["cr_amt"] + x["dr_amt"]))


def cashflow_block(meta):
    dep = [t for t in meta["transactions"] if t["category"] == "Cash Deposit"]
    wd = [t for t in meta["transactions"] if t["category"] == "Cash Withdrawal"]
    return {
        "deposit_count": len(dep), "deposit_amount": round(sum(t["amount"] for t in dep), 2),
        "withdrawal_count": len(wd), "withdrawal_amount": round(-sum(t["amount"] for t in wd), 2),
    }


def lifestyle_flags(meta, summary):
    txns = meta["transactions"]
    inflows = summary["gross_credits"] or 1
    months = max(summary["months_analyzed"], 1)
    out = []
    for label, rx in (("Alcohol", ALCOHOL), ("Gaming/Betting", GAMING)):
        hits = [t for t in txns if t["amount"] < 0 and rx.search(t["desc"] or "")]
        if not hits:
            continue
        amt = round(-sum(t["amount"] for t in hits), 2)
        pct = round(100 * amt / inflows, 2)
        per_month = len(hits) / months
        # FSD thresholds: alcohol fires >=4/mo or >=2% inflows; gaming >=3/mo or >=1%
        if label == "Alcohol":
            fired = per_month >= 4 or pct >= 2
        else:
            fired = per_month >= 3 or pct >= 1
        out.append({
            "flag": label, "txn_count": len(hits), "amount": amt,
            "monthly_avg": round(amt / months, 2), "pct_of_inflows": pct,
            "per_month": round(per_month, 1), "fired": bool(fired),
            "severity": ("RED" if fired else "INFO"),
            "txns": [{"date": t["date"].isoformat(), "description": t["desc"],
                      "amount": round(t["amount"], 2), "balance": round(t["balance"], 2),
                      "category": t["category"]} for t in hits],
        })
    return out


def eod_series(meta):
    """Daily carry-forward closing balance across the whole statement."""
    txns = meta["transactions"]
    if not txns:
        return []
    last = {}
    for t in txns:
        last[t["date"]] = t["balance"]
    start = txns[0]["date"]
    end = txns[-1]["date"]
    bal = round(txns[0]["balance"] - txns[0]["amount"], 2)
    out = []
    d = start
    while d <= end:
        if d in last:
            bal = last[d]
        out.append({"date": d.isoformat(), "balance": round(bal, 2)})
        d += datetime.timedelta(days=1)
    return out


def balance_hygiene(meta):
    txns = meta["transactions"]
    bals = [t["balance"] for t in txns]
    series = eod_series(meta)
    below_1000 = sum(1 for p in series if p["balance"] < 1000)
    below_100 = sum(1 for p in series if p["balance"] < 100)
    neg_days = sum(1 for p in series if p["balance"] <= 0)
    return {
        "min_balance": round(min(bals), 2) if bals else None,
        "max_balance": round(max(bals), 2) if bals else None,
        "days_below_100": below_100,
        "days_below_1000": below_1000,
        "zero_negative_days": neg_days,
        "total_days": len(series),
    }


def cash_cycle_flag(meta):
    """FCU F02 approximation: cash deposit >=20k followed within 1 day by an
    outward transfer >=80% of it to a fixed party, recurring."""
    txns = meta["transactions"]
    deposits = [t for t in txns if t["category"] == "Cash Deposit" and t["amount"] >= 20000]
    events = []
    for dep in deposits:
        for t in txns:
            if t["amount"] < 0 and 0 <= (t["date"] - dep["date"]).days <= 1 \
                    and -t["amount"] >= 0.8 * dep["amount"]:
                events.append({
                    "deposit_date": dep["date"].isoformat(),
                    "deposit_amount": round(dep["amount"], 2),
                    "outflow_amount": round(-t["amount"], 2),
                    "outflow_to": t["category"],
                    "outflow_desc": t["desc"][:60],
                })
                break
    return {"fired": len(events) >= 3, "count": len(events), "events": events}


def behaviour_narrative(meta, rep, summary, life, cash, rt, cash_cycle):
    s = []
    inc = summary["classified_income"]
    months = max(summary["months_analyzed"], 1)
    monthly = round(inc / months)
    # income line
    settle = sum(1 for t in meta["transactions"] if t["category"] == "UPI Settlement")
    if settle > 20:
        s.append(f"Merchant/QR-led inflows: {settle} settlement credits, "
                 f"~₹{monthly:,}/month classified income over {months} months.")
    else:
        s.append(f"~₹{monthly:,}/month classified income over {months} months "
                 f"across {summary['credit_count']} credits.")
    # obligations
    if summary["total_obligations"] > 0:
        s.append(f"Loan outflows are ₹{summary['total_obligations']:,.0f} — "
                 f"{summary['obligation_to_inflow_pct']}% of all inflows go to obligations.")
    # discipline / bounces
    nb = len(rep.get("bounced_rows", []))
    if nb:
        s.append(f"{nb} bounce/penal event(s) detected — review repayment discipline.")
    # cash cycle
    if cash_cycle["fired"]:
        s.append(f"⚠ Cash-in→transfer-out cycle in {cash_cycle['count']} instances "
                 f"(cash deposited then moved same/next day to a fixed party) — possible informal lender; probe before sanction.")
    # lifestyle
    for l in life:
        if l["fired"]:
            s.append(f"⚠ {l['flag']} spend ₹{l['amount']:,.0f} "
                     f"({l['pct_of_inflows']}% of inflows, ~{l['per_month']}/month) — flagged.")
    # round-tripping
    if rt:
        s.append(f"{len(rt)} counterparties appear on both credit and debit sides (round-tripping) — see Flags.")
    # cash reliance
    if cash["withdrawal_amount"] and summary["gross_debits"]:
        cw = round(100 * cash["withdrawal_amount"] / summary["gross_debits"], 1)
        if cw > 40:
            s.append(f"Cash withdrawals are {cw}% of debits — cash-reliant; verify at PD.")
    return s


def avg_closing_3_4(rep):
    """Digitap/EMI-presentation view: closing balance on the 3rd and 4th of
    each month (carry-forward) and their average — a key-date liquidity read
    for EMIs/NACH that present early in the month."""
    rows = []
    s3 = s4 = savg = 0.0
    n = 0
    for m in rep["months"]:
        grid = rep["eod"][m]
        c3 = grid[2] if len(grid) > 2 else None      # day 3
        c4 = grid[3] if len(grid) > 3 else None       # day 4
        vals = [v for v in (c3, c4) if v is not None]
        avg = round(sum(vals) / len(vals), 2) if vals else None
        rows.append({"month": m.isoformat(), "close_3": c3, "close_4": c4, "avg": avg})
        if c3 is not None:
            s3 += c3
        if c4 is not None:
            s4 += c4
        if avg is not None:
            savg += avg; n += 1
    overall = round(savg / n, 2) if n else None
    return {"rows": rows, "overall_avg": overall,
            "avg_3": round(s3 / len(rep["months"]), 2) if rep["months"] else None,
            "avg_4": round(s4 / len(rep["months"]), 2) if rep["months"] else None}


SPEND_CATS = ["Alcohol", "Gaming/Betting", "Fuel", "Food", "Travel", "Household", "Clothing",
              "Online Shopping", "Entertainment", "Software", "Insurance", "Investment Expense",
              "Utilities", "Utilities (Phone)", "Utilities (Cable TV)", "Credit Card Payment",
              "Bank Charges"]


def spend_analysis(meta, months):
    """Digitap category rollup: per spend category, monthly amounts + count +
    total, with lifestyle categories flagged. Alcohol/Gaming folded in via the
    dictionaries so TASMAC/DREAM-class merchants surface even when categorised
    as a plain party transfer."""
    mk = [(m.year, m.month) for m in months]
    gross_debits = -sum(t["amount"] for t in meta["transactions"] if t["amount"] < 0) or 1

    def bucket(t):
        d = t["desc"] or ""
        if ALCOHOL.search(d):
            return "Alcohol"
        if GAMING.search(d):
            return "Gaming/Betting"
        return t["category"]

    agg = {}
    for t in meta["transactions"]:
        if t["amount"] >= 0:
            continue
        cat = bucket(t)
        if cat not in SPEND_CATS:
            continue
        rec = agg.setdefault(cat, {"months": {k: 0.0 for k in mk}, "count": 0, "total": 0.0})
        key = (t["date"].year, t["date"].month)
        if key in rec["months"]:
            rec["months"][key] += -t["amount"]
        rec["count"] += 1
        rec["total"] += -t["amount"]
    rows = []
    for cat, rec in agg.items():
        rows.append({
            "category": cat, "count": rec["count"], "total": round(rec["total"], 2),
            "monthly": [round(rec["months"][k], 2) for k in mk],
            "pct_of_debits": round(100 * rec["total"] / gross_debits, 2),
            "lifestyle": cat in ("Alcohol", "Gaming/Betting"),
        })
    rows.sort(key=lambda r: -r["total"])
    return rows


# lender legal-name dictionary (FSD entities.yaml seed) — desc token → (name, key)
_LENDERS = [
    (r"capitalindiafi|Capital /YESB", "Capital India Finance Ltd", "NBFC"),
    (r"bajajfinserv|Bajaj Fi|BAJAJ FIN|BCF\d", "Bajaj Finance Ltd", "NBFC"),
    (r"lntmll|LNTMLL|L T FINA|L&T FIN", "L&T Finance", "NBFC"),
    (r"\bESFB\b|ESAF|EQUITAS", "ESAF / Equitas SFB", "Bank-loan"),
    (r"MUTHOOT", "Muthoot Finance", "Gold-NBFC"),
    (r"VISTAAR", "Vistaar Finance", "NBFC"),
    (r"SAMASTA", "Samasta Microfinance", "MFI"),
    (r"UGRO", "UGRO Capital", "NBFC"),
    (r"KREDITBEE|KRAZYBEE", "KreditBee", "App-lender"),
    (r"MONEYVIEW|MPOKKET|CASHE|NAVI|FIBE|EARLYSALARY|LAZYPAY|SLICE|KISSHT", "App-lender NBFC", "App-lender"),
]


def _lender_of(desc, category):
    import re as _re
    d = desc or ""
    for pat, name, _typ in _LENDERS:
        if _re.search(pat, d, _re.I):
            return name
    m = _re.search(r"MAND DR-\s*([A-Z0-9]+)", d)
    if m:
        return f"NACH Mandate ({m.group(1)})"
    if _re.search(r"MAND\s?DR|NACH|ACHDr|CMP MANDATE|/ECS", d, _re.I):
        return "NACH Mandate (unidentified)"
    return f"Unidentified {category}"


def _lender_type(name):
    for _pat, nm, typ in _LENDERS:
        if nm == name:
            return typ
    return "NACH" if "NACH" in name else "Unknown"


def loan_analysis(meta):
    """Digitap 'Loan Analysis with Lender Name': group loan-repayment debits by
    resolved lender, infer pattern (NACH mandate / daily-collection / EMI)."""
    import re as _re
    loans = defaultdict(list)
    for t in meta["transactions"]:
        if t["category"] not in LOAN_CATS or t["amount"] >= 0:
            continue
        loans[_lender_of(t["desc"], t["category"])].append(t)
    out = []
    for lender, ts in loans.items():
        ts.sort(key=lambda t: t["date"])
        total = round(-sum(t["amount"] for t in ts), 2)
        mset = {(t["date"].year, t["date"].month) for t in ts}
        gaps = [(ts[i + 1]["date"] - ts[i]["date"]).days for i in range(len(ts) - 1)]
        med = sorted(gaps)[len(gaps) // 2] if gaps else 0
        desc0 = (ts[0]["desc"] or "").upper()
        if _re.search(r"MAND\s?DR|NACH|ACHDR|CMP MANDATE|/ECS", desc0):
            pattern = "NACH Mandate"
        elif len(ts) >= 15 and med <= 3:
            pattern = "Daily/Weekly Collection"
        elif len(mset) >= 2:
            pattern = "EMI (Fixed)"
        else:
            pattern = "One-off / Other"
        out.append({
            "lender": lender, "lender_type": _lender_type(lender), "pattern": pattern,
            "txn_count": len(ts), "total": total,
            "monthly_avg": round(total / max(len(mset), 1), 2),
            "first_seen": ts[0]["date"].isoformat(), "last_seen": ts[-1]["date"].isoformat(),
        })
    out.sort(key=lambda r: -r["total"])
    return out


def daily_open_close(meta):
    """Digitap open+close daily table (carry-forward on no-txn days)."""
    txns = meta["transactions"]
    if not txns:
        return []
    last_close, first_open, cnt, net = {}, {}, defaultdict(int), defaultdict(float)
    running = round(txns[0]["balance"] - txns[0]["amount"], 2)
    for t in txns:
        d = t["date"]
        if d not in first_open:
            first_open[d] = round(t["balance"] - t["amount"], 2)
        last_close[d] = t["balance"]
        cnt[d] += 1
        net[d] += t["amount"]
    out = []
    d = txns[0]["date"]
    end = txns[-1]["date"]
    close = running
    while d <= end:
        if d in last_close:
            op = first_open[d]
            close = last_close[d]
            out.append({"date": d.isoformat(), "open": round(op, 2), "close": round(close, 2),
                        "txns": cnt[d], "net": round(net[d], 2)})
        else:
            out.append({"date": d.isoformat(), "open": round(close, 2), "close": round(close, 2),
                        "txns": 0, "net": 0.0})
        d += datetime.timedelta(days=1)
    return out


def qc_block(meta):
    """Digitap QC: missing date ranges, duplicates, categorisation coverage."""
    txns = meta["transactions"]
    # missing ranges: gaps > 15 days with no txn
    missing = []
    for a, b in zip(txns, txns[1:]):
        gap = (b["date"] - a["date"]).days
        if gap > 15:
            missing.append({"from": a["date"].isoformat(), "to": b["date"].isoformat(), "days": gap})
    # duplicates: identical (date, amount, desc)
    seen, dups = set(), 0
    for t in txns:
        k = (t["date"], round(t["amount"], 2), t["desc"])
        if k in seen:
            dups += 1
        seen.add(k)
    # categorisation coverage
    other_cnt = sum(1 for t in txns if t["category"] in ("Others", "Other"))
    other_amt = sum(abs(t["amount"]) for t in txns if t["category"] in ("Others", "Other"))
    tot_amt = sum(abs(t["amount"]) for t in txns) or 1
    # balance continuity
    breaks = 0
    for a, b in zip(txns, txns[1:]):
        if abs(a["balance"] + b["amount"] - b["balance"]) > 0.01:
            breaks += 1
    return {
        "txn_count": len(txns),
        "missing_ranges": missing,
        "duplicate_count": dups,
        "unclassified": [{"date": t["date"].isoformat(), "description": t["desc"],
                          "amount": round(t["amount"], 2), "balance": round(t["balance"], 2)}
                         for t in txns if t["category"] == "Others"][:200],
        "categorisation_coverage_pct": round(100 * (1 - other_cnt / max(len(txns), 1)), 1),
        "categorisation_coverage_amt_pct": round(100 * (1 - other_amt / tot_amt), 1),
        "balance_continuity_breaks": breaks,
        "password_protected": meta.get("password_protected"),
        "bank": meta["bank"],
        "account_type": meta.get("account_type"),
    }


# ---- character-derivation merchant dictionaries (FSD §6.5 / §15) ----
_DICTS = {
    "Alcohol": r"TASMAC|BEVCO|\bKSBC\b|APSBCL|TSBCL|KSBCL|\bMSIL\b|WINE SHOP|\bWINES\b|LIQUOR|BREWERY|\bBAR &|DUTY FREE",
    "Gambling / Betting": r"DREAM11|DREAM BA|RUMMY|JUNGLEE|\bMPL\b|WINZO|MYTEAM11|MY11|POKER|1XBET|PARIMATCH|BETWAY|STAKE\.COM|DAFABET|A23 GAMES|ZUPEE|GAMEZY|PROBO",
    "Lottery": r"LOTTERY|LOTTO",
    "Shopping (Amazon/Flipkart…)": r"AMAZON|FLIPKART|MYNTRA|MEESHO|AJIO|SNAPDEAL|NYKAA|TATACLIQ|TATA CLIQ|RELIANCEDIGITAL|LENSKART",
    "OTT & Entertainment": r"NETFLIX|HOTSTAR|JIOHOTSTAR|HOT STAR|SPOTIFY|PRIMEVIDEO|PRIME VIDEO|AMAZONPRIME|SONYLIV|ZEE5|JIOCINEMA|\bVOOT\b|\bAHA\b|BOOKMYSHOW|DISNEY|GAANA|WYNK|ALTBALAJI|District/|JioHotstar",
    "Food delivery": r"SWIGGY|ZOMATO|EATFIT|FRESHMENU|DOMINOS|MCDONALD|\bKFC\b|BOX8|FAASOS",
    "Travel & mobility": r"IRCTC|MAKEMYTRIP|\bMMT\b|GOIBIBO|REDBUS|\bOLA\b|\bUBER\b|RAPIDO|CLEARTRIP|EASEMYTRIP|YATRA|INDIGO|SPICEJET|AIR INDIA|VISTARA|ABHIBUS|GPAY-TOLL",
    "Gaming (non-betting)": r"GOOGLEPLAY|GOOGLE PLAY|STEAM|PLAYSTATION|XBOX|GARENA|FREEFIRE|BGMI|PUBG",
    "Crypto": r"WAZIRX|BINANCE|COINDCX|COINSWITCH|MUDREX|ZEBPAY|GIOTTUS|BITBNS|CRYPTO",
    "Trading / broker": r"ZERODHA|UPSTOX|ANGEL ?ONE|GROWW|\bDHAN\b|5PAISA|PAYTM ?MONEY|MOTILAL|ICICIDIRECT|KOTAK ?SEC",
    "SIP / mutual funds": r"\bCAMS\b|KFINTECH|BSE ?STAR|\bMFSS\b|\bSIP\b|INDIAN CLEARING",
    "Insurance": r"\bLIC\b|LICINDIA|PMSBY|PMJJBY|POLICYBAZAAR|HDFC LIFE|SBI LIFE|ICICI ?PRU|MAX LIFE|STAR HEALTH|INSURANCE",
    "Education": r"SCHOOL|COLLEGE|\bFEES\b|VIDYALAYA|MATRIC|UNIVERSITY|BYJU|UNACADEMY|VEDANTU|TUITION",
    "Digital / app lenders": r"KREDITBEE|KRAZYBEE|\bNAVI\b|\bCASHE\b|MPOKKET|TRUEBALANCE|MONEYVIEW|EARLYSALARY|\bFIBE\b|SMARTCOIN|\bOLYV\b|PAYSENSE|LAZYPAY|\bSIMPL\b|STASHFIN|\bSLICE\b|KISSHT|LOANTAP",
    "Gold loan": r"MUTHOOT|MANAPPURAM|IIFL ?GOLD|RUPEEK",
}


def _dict_hits(txns, pat, debit_only=True):
    rx = re.compile(pat, re.I)
    hits = [t for t in txns if rx.search(t["desc"] or "") and (t["amount"] < 0 if debit_only else True)]
    return hits


def character_signals(meta, rep):
    """Every way to read the borrower's character (FSD §15). Returns grouped
    signals; each carries count / amount / severity so nothing is hidden — even
    positive and neutral signals are shown so the reviewer sees the full menu."""
    txns = meta["transactions"]
    inflows = sum(t["amount"] for t in txns if t["amount"] > 0) or 1
    debits = -sum(t["amount"] for t in txns if t["amount"] < 0) or 1
    months = max(len(rep["months"]), 1)

    def spend(label, pat):
        hits = _dict_hits(txns, _DICTS[pat])
        amt = round(-sum(t["amount"] for t in hits), 2)
        return {"label": label, "count": len(hits), "amount": amt,
                "monthly": round(amt / months, 2), "pct_inflows": round(100 * amt / inflows, 2),
                "pct_debits": round(100 * amt / debits, 2), "per_month": round(len(hits) / months, 1)}

    def sev(fired_red, fired_amber=False, positive=False):
        return "RED" if fired_red else "AMBER" if fired_amber else ("GREEN" if positive else "INFO")

    groups = []

    # ---- 1. Lifestyle & vice
    vice = []
    for lab in ("Alcohol", "Gambling / Betting", "Lottery"):
        s = spend(lab, lab)
        if lab == "Alcohol":
            s["severity"] = sev(s["per_month"] >= 4 or s["pct_inflows"] >= 2, s["count"] > 0)
        elif lab.startswith("Gambling"):
            s["severity"] = sev(s["per_month"] >= 3 or s["pct_inflows"] >= 1, s["count"] > 0)
        else:
            s["severity"] = sev(s["count"] > 0)
        s["note"] = (f"{s['count']} txns · {s['per_month']}/mo · {s['pct_inflows']}% of inflows"
                     if s["count"] else "None detected")
        vice.append(s)
    groups.append({"group": "Lifestyle & vice", "desc": "Vice spend that lowers the character grade.", "signals": vice})

    # ---- 2. Discretionary lifestyle
    disc = []
    for lab in ("Shopping (Amazon/Flipkart…)", "OTT & Entertainment", "Food delivery",
                "Travel & mobility", "Gaming (non-betting)"):
        s = spend(lab, lab)
        s["severity"] = "INFO"
        s["note"] = (f"{s['count']} txns · {inr_note(s['amount'])} · {s['pct_debits']}% of debits"
                     if s["count"] else "None detected")
        disc.append(s)
    disc_total = round(sum(x["amount"] for x in disc), 2)
    groups.append({"group": "Discretionary lifestyle",
                   "desc": f"How money is spent — {inr_note(disc_total)} across these, "
                           f"{round(100*disc_total/debits,1)}% of all debits.", "signals": disc})

    # ---- 3. Borrowing behaviour
    loans = loan_analysis(meta)
    daily = [l for l in loans if l["pattern"] == "Daily/Weekly Collection"]
    app_hits = _dict_hits(txns, _DICTS["Digital / app lenders"], debit_only=False)
    app_lenders = len({(t["desc"] or "")[:12] for t in app_hits})
    gold = _dict_hits(txns, _DICTS["Gold loan"], debit_only=False)
    bounces = [t for t in txns if t["category"] == "Bounced I/W ECS Charges"]
    borrow = [
        {"label": "Active lenders (stacking)", "count": len(loans), "amount": round(sum(l["total"] for l in loans), 2),
         "severity": sev(len(loans) >= 4, len(loans) == 3),
         "note": f"{len(loans)} lenders" + (" — stacking" if len(loans) >= 4 else "")},
        {"label": "Daily-collection loan", "count": len(daily), "amount": round(sum(l["total"] for l in daily), 2),
         "severity": sev(len(daily) > 0), "note": (daily[0]["lender"] + " — cash-stress signal") if daily else "None"},
        {"label": "Digital / app lenders", "count": len(app_hits), "amount": round(-sum(t["amount"] for t in app_hits if t["amount"] < 0), 2),
         "severity": sev(app_lenders >= 3, app_lenders in (1, 2)),
         "note": f"{app_lenders} distinct app-lenders" if app_hits else "None"},
        {"label": "Gold-loan cycling", "count": len(gold), "amount": round(sum(abs(t["amount"]) for t in gold), 2),
         "severity": sev(len(gold) >= 3, len(gold) >= 1), "note": f"{len(gold)} gold-loan txns" if gold else "None"},
        {"label": "Loan bounces / returns", "count": len(bounces), "amount": round(-sum(t["amount"] for t in bounces), 2),
         "severity": sev(len(bounces) >= 2, len(bounces) == 1), "note": f"{len(bounces)} bounce event(s)" if bounces else "Zero bounces"},
    ]
    groups.append({"group": "Borrowing behaviour", "desc": "Leverage, lender stacking and repayment stress.", "signals": borrow})

    # ---- 4. Financial discipline (positive)
    sip = _dict_hits(txns, _DICTS["SIP / mutual funds"])
    ins = _dict_hits(txns, _DICTS["Insurance"])
    edu = _dict_hits(txns, _DICTS["Education"])
    charges = [t for t in txns if t["category"] in ("Bank Charges", "Bounced I/W ECS Charges")]
    disc_pos = [
        {"label": "SIP / mutual-fund investing", "count": len(sip), "amount": round(-sum(t["amount"] for t in sip), 2),
         "severity": sev(False, positive=len(sip) > 0), "note": f"{len(sip)} investment txns" if sip else "None"},
        {"label": "Insurance premiums", "count": len(ins), "amount": round(-sum(t["amount"] for t in ins if t["amount"] < 0), 2),
         "severity": sev(False, positive=len(ins) > 0), "note": f"{len(ins)} premium txns" if ins else "None"},
        {"label": "Education fees", "count": len(edu), "amount": round(-sum(t["amount"] for t in edu if t["amount"] < 0), 2),
         "severity": sev(False, positive=len(edu) > 0), "note": f"{len(edu)} education txns" if edu else "None"},
        {"label": "Avoidable charges", "count": len(charges), "amount": round(-sum(t["amount"] for t in charges), 2),
         "severity": sev(len(charges) >= 5, len(charges) >= 1, positive=len(charges) == 0),
         "note": "Zero avoidable charges" if not charges else f"{len(charges)} charge events"},
        {"label": "Clean loan servicing", "count": len(bounces), "amount": 0,
         "severity": sev(False, positive=len(bounces) == 0 and len(loans) > 0),
         "note": "All EMIs serviced, 0 bounces" if (len(bounces) == 0 and loans) else ("bounces present" if bounces else "no loans")},
    ]
    groups.append({"group": "Financial discipline (positive)", "desc": "Signals that RAISE the character grade.", "signals": disc_pos})

    # ---- 5. Income quality
    credits = [t for t in txns if t["amount"] > 0]
    credit_days = len({t["date"] for t in credits})
    from collections import Counter
    payer = Counter()
    for t in credits:
        m = re.match(r"^Transfer from (.+)$", t["category"] or "")
        payer[m.group(1) if m else t["category"]] += t["amount"]
    top_share = round(100 * max(payer.values()) / inflows, 1) if payer else 0
    cash_dep = sum(t["amount"] for t in txns if t["category"] == "Cash Deposit")
    income = [
        {"label": "Income regularity", "count": credit_days, "amount": 0,
         "severity": sev(False, credit_days < months * 8, positive=credit_days >= months * 12),
         "note": f"{credit_days} credit-days over {months} months"},
        {"label": "Income concentration", "count": len(payer), "amount": 0,
         "severity": sev(top_share > 70, top_share > 50), "note": f"top payer = {top_share}% of inflows"},
        {"label": "Cash-deposit reliance", "count": sum(1 for t in txns if t["category"] == "Cash Deposit"),
         "amount": round(cash_dep, 2), "severity": sev(cash_dep > 0.4 * inflows, cash_dep > 0.2 * inflows),
         "note": f"{round(100*cash_dep/inflows,1)}% of inflows are cash"},
    ]
    groups.append({"group": "Income quality", "desc": "Regularity, concentration and cash-dependence of income.", "signals": income})

    # ---- 6. Balance hygiene
    bh = balance_hygiene(meta)
    hyg = [
        {"label": "Minimum balance", "count": 0, "amount": bh["min_balance"],
         "severity": sev(bh["min_balance"] is not None and bh["min_balance"] < 100, bh["min_balance"] is not None and bh["min_balance"] < 1000),
         "note": f"lowest EOD balance {inr_note(bh['min_balance'])}"},
        {"label": "Days below ₹1,000", "count": bh["days_below_1000"], "amount": 0,
         "severity": sev(bh["days_below_1000"] > 0.4 * bh["total_days"], bh["days_below_1000"] > 0.2 * bh["total_days"]),
         "note": f"{bh['days_below_1000']} of {bh['total_days']} days"},
        {"label": "Zero / negative balance days", "count": bh["zero_negative_days"], "amount": 0,
         "severity": sev(bh["zero_negative_days"] > 0), "note": f"{bh['zero_negative_days']} days at or below ₹0"},
    ]
    groups.append({"group": "Balance hygiene", "desc": "Cash-flow cushion and hand-to-mouth signals.", "signals": hyg})

    # ---- 7. Risk & manipulation
    crypto = _dict_hits(txns, _DICTS["Crypto"], debit_only=False)
    trade = _dict_hits(txns, _DICTS["Trading / broker"], debit_only=False)
    cc = cash_cycle_flag(meta)
    rt = rep.get("round_trip", [])
    risk = [
        {"label": "Crypto exposure", "count": len(crypto), "amount": round(sum(abs(t["amount"]) for t in crypto), 2),
         "severity": sev(sum(abs(t["amount"]) for t in crypto) > 0.02 * inflows, len(crypto) > 0), "note": f"{len(crypto)} crypto txns" if crypto else "None"},
        {"label": "Active trading", "count": len(trade), "amount": round(sum(abs(t["amount"]) for t in trade), 2),
         "severity": sev(False, len(trade) > 0), "note": f"{len(trade)} broker txns" if trade else "None"},
        {"label": "Cash-in → transfer-out cycle", "count": cc["count"], "amount": 0,
         "severity": sev(cc["fired"]), "note": f"{cc['count']} instances — possible informal lender" if cc["fired"] else "None"},
        {"label": "Round-tripping parties", "count": len(rt), "amount": 0,
         "severity": sev(len(rt) >= 5, len(rt) > 0), "note": f"{len(rt)} two-way parties" if rt else "None"},
    ]
    groups.append({"group": "Risk & manipulation", "desc": "Fraud-adjacent and manipulation signals.", "signals": risk})

    return groups


def inr_note(n):
    return "₹" + format(round(n or 0), ",") if n is not None else "—"


def character_grade(summary, life, cash_cycle, nb, rt):
    """Lightweight A–E heuristic (a stand-in for the FSD 5-factor scorecard)."""
    score = 100
    reasons = []
    if summary["obligation_to_inflow_pct"] and summary["obligation_to_inflow_pct"] > 30:
        score -= 15; reasons.append("high obligation-to-inflow")
    if any(l["fired"] for l in life):
        score -= 15; reasons.append("lifestyle-spend flag")
    if cash_cycle["fired"]:
        score -= 20; reasons.append("informal-credit / cash-cycle signal")
    if nb:
        score -= 10 * min(nb, 3); reasons.append("bounce events")
    if len(rt) >= 5:
        score -= 10; reasons.append("multiple round-tripping parties")
    grade = "A" if score >= 90 else "B" if score >= 75 else "C" if score >= 60 else "D" if score >= 45 else "E"
    return {"grade": grade, "score": max(score, 0), "reasons": reasons}
