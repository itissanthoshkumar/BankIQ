#!/usr/bin/env python3
"""BankIQ — bank statement PDF -> Perfios-style analysis workbook.

Usage:
    python3 bankiq_run.py <statement.pdf> [--password PW] [-o output.xlsx]

Supported banks: Union Bank of India, City Union Bank, State Bank of India
(WhatsApp/e-statement). The output workbook reproduces the reference
multi-tab format: Analysis, Derived Analysis, EOD Balance, Top 5 Parties,
Transactions, UPI XNS, Recurring, High value, FCU Indicators, Round-tripping
and Party Xns (conditional tabs appear only when relevant data exists).
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from bankiq.parse import parse_statement
from bankiq.categorize import categorize_all
from bankiq.analyze import build_report
from bankiq.render import render


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("pdf")
    ap.add_argument("--password", "-p", default=None)
    ap.add_argument("-o", "--out", default=None)
    args = ap.parse_args()

    meta = parse_statement(args.pdf, args.password)
    categorize_all(meta)
    rep = build_report(meta)

    out = args.out
    if not out:
        name = rep["display_name"] or "statement"
        out = os.path.join(os.path.dirname(os.path.abspath(args.pdf)), f"{name}.xlsx")
    render(rep, out)
    n = len(meta["transactions"])
    print(f"{meta['bank']}: {n} transactions, {len(rep['months'])} analysis months")
    print(f"written: {out}")
    return out


if __name__ == "__main__":
    main()
