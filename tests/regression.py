#!/usr/bin/env python3
"""Regression harness: parse every known statement and assert quality.

Run:  python3 tests/regression.py
Checks per file: transaction count, balance-continuity breaks, categorisation
coverage, and that no statement 'chrome' (page footers, column headers, summary
blocks) has bled into a transaction description.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from bankiq.parse import parse_statement           # noqa: E402
from bankiq.categorize import categorize_all        # noqa: E402

D = os.path.expanduser("~/Downloads")
CASES = [
    ("Union / BHUVANESHWARI", f"{D}/202885XXXX_DoPW BHUV1205.pdf", "BHUV1205"),
    ("SBI WhatsApp / VINAYAGAM", f"{D}/SBI Statement Password : 60382270773.pdf", "60382270773"),
    ("SBI SOA / PALA", f"{D}/Bank Statement .pdf", None),
    ("SBI SOA / ISMAIL", f"{D}/BANK STATEMENT.pdf", None),
    ("SBI SOA / PAVAN", f"{D}/bank statement salary.pdf", None),
    ("Canara / JOHN BABU", f"{D}/Bank Statement John babu.pdf", None),
    ("HDFC / SYED AZEEZ", f"{D}/86cd0358-6ca3-409d-8a5e-a343b0551fd1.pdf", None),
    ("Indian SOA / VENKATESAN", f"{D}/Venkatesan K stmt.PDF", None),
    ("IOB / AFINA", f"{D}/Statement-337901000010510 (1) (4).pdf", None),
    ("Activity-INR / SAKIN", f"{D}/Sakinkumar.pdf", None),
]
CHROME = (r"Page\s*(?:no\.?|No\.?)\s*\d|Brought Forward|Carried Forward|Statement Summary|"
          r"Dr\.?\s*Count|Cr\.?\s*Count|Post Date|Value Date|WITHDRAWS|computer generated|"
          r"CLOSING BALANCE\s*:|Confidential|ATM WDL ATM CASH\s*$")


def breaks(t):
    return sum(1 for a, b in zip(t, t[1:])
               if a["balance"] is not None and b["balance"] is not None and b["amount"] is not None
               and abs(a["balance"] + b["amount"] - b["balance"]) > 0.01)


def main():
    fails = 0
    print(f"{'case':26}{'txns':>6}{'breaks':>8}{'cover%':>9}{'bleed':>7}  verdict")
    for label, path, pw in CASES:
        if not os.path.exists(path):
            print(f"{label:26}{'(file missing — skipped)':>30}")
            continue
        m = parse_statement(path, password=pw)
        categorize_all(m)
        t = m["transactions"]
        b = breaks(t)
        cov = 100 * (1 - sum(1 for x in t if x["category"] == "Others") / max(len(t), 1))
        bleed = sum(1 for x in t if re.search(CHROME, x["desc"] or "", re.I))
        ok = b <= max(2, len(t) * 0.01) and bleed == 0 and cov >= 85
        fails += 0 if ok else 1
        print(f"{label:26}{len(t):>6}{b:>8}{cov:>8.1f}%{bleed:>7}  {'PASS' if ok else 'FAIL'}")
    print("\nRESULT:", "all cases pass" if not fails else f"{fails} case(s) FAILED")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
