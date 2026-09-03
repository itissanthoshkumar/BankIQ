"""Assemble the UI JSON payload from the engine report + insight blocks."""
import datetime

from . import insights as I
from .digitap import build_analysis


def _d(x):
    return x.isoformat() if isinstance(x, (datetime.date, datetime.datetime)) else x


def build_payload(meta, rep):
    txns = meta["transactions"]
    summary = I.summary_block(meta, rep)
    life = I.lifestyle_flags(meta, summary)
    cash = I.cashflow_block(meta)
    cash_cycle = I.cash_cycle_flag(meta)
    rt = rep.get("round_trip", [])
    nb = len(rep.get("bounced_rows", []))
    narrative = I.behaviour_narrative(meta, rep, summary, life, cash, rt, cash_cycle)
    grade = I.character_grade(summary, life, cash_cycle, nb, rt)

    # transactions (with rail) — capped for payload size; full set in XLSX
    tx_rows = []
    for i, t in enumerate(txns):
        tx_rows.append({
            "seq": i + 1,
            "date": _d(t["date"]),
            "description": t["desc"],
            "amount": round(t["amount"], 2),
            "debit": round(-t["amount"], 2) if t["amount"] < 0 else None,
            "credit": round(t["amount"], 2) if t["amount"] > 0 else None,
            "balance": round(t["balance"], 2),
            "category": t["category"],
            "rail": I.rail_of(t["desc"]),
            "remitter": I.remitter_of(t["desc"]),
        })

    # Monthwise analysis grid.
    # rep["months"] stops at the last COMPLETE month (that is the reference
    # report's own convention and the rendered XLSX keeps it). On screen we show
    # the trailing partial month too, marked with *, so the column totals tie
    # back to the statement's own summary instead of silently under-reporting.
    from bankiq.analyze import monthwise as _monthwise
    from .digitap import _all_months
    all_months = _all_months(txns)
    months = [m.isoformat() for m in all_months]
    partial = [m.isoformat() for m in all_months if m not in rep["months"]]
    analysis = [{"metric": label, "values": [round(v, 2) for v in series],
                 "total": round(sum(series), 2)}
                for label, series in _monthwise(txns, all_months)]

    # top-5 parties per month
    def top5(d):
        return {m.isoformat(): [{"desc": desc, "amount": round(a, 2)} for desc, a in rows]
                for m, rows in d.items()}

    # parties ledger (from round-trip blocks + aggregate)
    from collections import defaultdict
    pin = defaultdict(lambda: [0, 0.0])
    pout = defaultdict(lambda: [0, 0.0])
    import re
    for t in txns:
        c = t["category"]
        m = re.match(r"^Transfer (?:to|from) (.+)$", c)
        if not m:
            continue
        name = m.group(1)
        if name == "Self":
            continue
        tgt = pin if t["amount"] > 0 else pout
        tgt[name][0] += 1
        tgt[name][1] += abs(t["amount"])
    parties = []
    for name in set(pin) | set(pout):
        ci, ai = pin[name]
        co, ao = pout[name]
        parties.append({"party": name, "txns_in": ci, "amount_in": round(ai, 2),
                        "txns_out": co, "amount_out": round(ao, 2),
                        "net": round(ai - ao, 2), "both_sides": bool(ci and co)})
    parties.sort(key=lambda p: -(p["amount_in"] + p["amount_out"]))

    # FCU-style flags
    flags = []
    flags.append({"id": "F02", "name": "Cash-in → immediate transfer-out cycle",
                  "severity": "CRITICAL", "fired": cash_cycle["fired"],
                  "count": cash_cycle["count"], "detail": cash_cycle["events"]})
    flags.append({"id": "F03", "name": "Round-tripping parties (two-way flows)",
                  "severity": "WARN", "fired": len(rt) > 0, "count": len(rt),
                  "detail": [{"party": p, "credits": nc, "cr_amt": round(vc, 2),
                              "debits": nd, "dr_amt": round(abs(vd), 2)}
                             for p, nc, vc, nd, vd in rt]})
    for l in life:
        flags.append({"id": "LIFE", "name": f"{l['flag']} spend",
                      "severity": l["severity"], "fired": l["fired"],
                      "count": l["txn_count"],
                      "summary": {"amount": l["amount"], "pct_of_inflows": l["pct_of_inflows"],
                                  "per_month": l["per_month"], "monthly_avg": l["monthly_avg"]},
                      "txns": l.get("txns", [])})

    # high-value
    def hv(rows):
        return [{"date": _d(t["date"]), "description": t["desc"], "amount": round(t["amount"], 2),
                 "category": t["category"], "balance": round(t["balance"], 2)} for t in rows]

    return {
        "schema_version": "1.0",
        "summary": summary,
        "grade": grade,
        "narrative": narrative,
        "months": months,
        "partial_months": partial,
        "analysis": analysis,
        "transactions": tx_rows,
        "category_breakdown": I.category_breakdown(meta),
        "rails": I.rails_block(meta),
        "cashflow": cash,
        "lifestyle": life,
        "balance_hygiene": I.balance_hygiene(meta),
        "eod_series": I.eod_series(meta),
        "top5_credit": top5(rep["top5_credit"]),
        "top5_debit": top5(rep["top5_debit"]),
        "parties": parties[:40],
        "flags": flags,
        "high_value_credit": hv(rep["hv_credit"]),
        "high_value_debit": hv(rep["hv_debit"]),
        "salary": hv(rep.get("salary_rows", [])),
        "loan_disbursed": hv(rep.get("loan_disb", [])),
        "bounces": hv(rep.get("bounced_rows", [])),
        # --- added tabs ---
        "avg_closing_3_4": I.avg_closing_3_4(rep),
        "character": I.character_signals(meta, rep),
        "digitap_analysis": build_analysis(meta, rep),
        "spend_analysis": I.spend_analysis(meta, rep["months"]),
        "loan_analysis": I.loan_analysis(meta),
        "daily_balance": I.daily_open_close(meta),
        "qc": I.qc_block(meta),
    }
