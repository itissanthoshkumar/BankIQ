"""Transaction categorisation replicating the reference (Perfios-style) taxonomy.

Category strings must match the reference reports exactly, including
"Transfer to <NAME>" / "Transfer from <NAME>" built from the counterparty
token embedded in the description. A two-pass canonicalisation merges
party-name variants (same UPI handle, or substring-related names).
"""
import re
from collections import Counter, defaultdict

_HONORIFICS = ("MR. ", "MRS. ", "MR ", "MRS ", "Mr. ", "Mrs. ", "Mr ", "Mrs ")


def _clean_party(name):
    name = name.strip().strip("*").strip()
    for h in _HONORIFICS:
        if name.startswith(h):
            name = name[len(h):]
            break
    name = re.sub(r"\s+", " ", name).strip()
    name = re.sub(r" \.$", "", name)
    return name.upper()


def _upi_fields(desc, bank):
    """(party, handle) from a UPI/IMPS description, else (None, None).

    Bank-specific layouts are tried first (they are the most exact), then a set of
    format-driven fallbacks so ANY bank's narration resolves a counterparty name —
    without this, statements from banks we haven't hand-tuned fall through to
    "Others" and the Parties ledger / Top-5 / Spend Analysis come out empty."""
    m = None
    if bank == "Union Bank of India":
        m = re.match(r"^UPI(?:AR|AB)/\d+/(?:DR|CR)/([^/]*)/[^/]*/(.*)$", desc)
    elif bank == "City Union Bank":
        m = re.search(r"UPI/(?:DR|CR)/\d+/([^/]*)/[^/]*/(.*)$", desc)
    elif bank == "State Bank of India":
        # name may itself contain '/' (M/S.SHRI) — anchor on the 4-letter bank code
        m = re.match(r"^UPI/(?:DR|CR)/\d+/(.+?)/([A-Z]{4}[A-Z ]?)/(.*)$", desc)
        if m:
            return m.group(1), m.group(3).split("/")[0]
        m = re.match(r"^UPI/(?:DR|CR)/\d+/([^/]*)/[^/]*/(.*)$", desc)
    if not m:
        # ---- bank-agnostic fallbacks (SEARCH, not match: many banks print a
        # reference number before the UPI block, e.g. Canara's "<ref> UPI/CR/...") ----
        # <ref>/DR|CR/<NAME>/<BANK>/...  — ref before DR/CR (IOB)
        m = re.search(r"UPI/\d+/(?:DR|CR)/\s*(.+?)/([A-Za-z*]{2,6})/", desc)
        if m:
            return m.group(1), m.group(2)
        # UPI/DR|CR/<ref>/<NAME>/<BANK>/... — DR/CR before ref (Canara, CUB, SBI)
        m = re.search(r"UPI/(?:DR|CR)/\d+/\s*(.+?)/([A-Za-z*]{2,6})/", desc)
        if m:
            return m.group(1), m.group(2)
        # HDFC style: UPI-<NAME>-<vpa>-... (trailing part optional)
        m = re.match(r"^UPI-([^-]+)(?:-([^-]*))?", desc)
        if m:
            return m.group(1), (m.group(2) or "").split("@")[0]
        # IMPS: IMPS/<ref>/<NAME>/<BANK>/...  and  /IMPS/P2A/<ref>/ /IMPS/<NAME>
        m = re.search(r"IMPS/\d+/([^/]+)/([A-Za-z]{3,4})/", desc)
        if m:
            return m.group(1), m.group(2)
        m = re.search(r"/IMPS/P2A/\d+/\s*/IMPS/\s*(.+?)(?:\s*/|$)", desc)
        if m:
            return m.group(1), ""
        # last resort: UPI ref then a name, with no bank segment printed
        m = re.search(r"UPI/(?:DR|CR)/\d+/\s*([A-Za-z][A-Za-z .&]{2,40})", desc)
        if m:
            return m.group(1).strip(), ""
        return None, None
    handle = m.group(2).split("/")[0]
    return m.group(1), handle


def _is_self_name(party, holder):
    p = re.sub(r"[^A-Z]", "", (party or "").upper())
    h = re.sub(r"[^A-Z]", "", (holder or "").upper())
    for hon in ("MRS", "MR", "MS"):
        if h.startswith(hon) and len(h) > len(hon) + 3:
            h = h[len(hon):]
            break
    # BOTH names must be substantial: with an empty/short holder name every
    # counterparty would "match" (p.startswith("") is always True), silently
    # turning the whole ledger into self-transfers.
    if not p or len(p) < 4 or not h or len(h) < 4:
        return False
    return h.startswith(p) or p.startswith(h)


# merchant/keyword rules checked on the WHOLE description (name + vpa),
# before party-transfer extraction; first match wins.
_KEYWORD_RULES = [
    (r"TASMAC", "Alcohol"),
    (r"gpay-utility|GPAY-UTILI|bbpsbp @axl", "Utilities"),
    (r"MYJIO|myjio|Jio Rech|JIOINAPPDI|gpayrecharge|GPAYRECHAR|Airtel R|AIRTELPRED|Vodafone|VIIN|BSNL|aircel", "Utilities (Phone)"),
    (r"my\.sundirect|SUN DIRE|/mysundir/", "Utilities (Cable TV)"),
    (r"relianceretail", "Household"),
    (r"GPAY-TOLL|IRCTC|REDBUS|redbus", "Travel"),
    (r"HOTELBAG|ZOMATO|SWIGGY", "Food"),
    (r"PETRO|Petro| FUEL/|FUEL/|FUELS|BHARAT PET|INDIAN OIL", "Fuel"),
    (r"/Spt silk|SILKS|TEXTILE|GARMENT", "Clothing"),
    (r"MEESHO|EKART|FLIPKART|AMAZON|MYNTRA|AJIO", "Online Shopping"),
    (r"District/|JioHotstar|HOT STARONL|HOTSTAR|NETFLIX|SPOTIFY|BOOKMYSHOW", "Entertainment"),
    (r"CRAFTO|FTOONLI", "Software"),
    (r"FINVESCO|fin vesco|GROWW|ZERODHA|UPSTOX", "Investment Expense"),
    (r"capitalindiafi", "Business Loan"),
    (r"goog-payments", "Cash Back"),
    (r"GOOGLEINDIADIGITAL", "UPI Settlement"),
]

_LOAN_UPI = re.compile(
    r"MUTHOOT|UGROCAPITA|Bajaj Fi|bajajfinserv|lntmll|LNTMLL|L T FINA|loan\.|"
    r"VISTAAR|SAMASTA|MICROF|DMI FIN|TVS CRED|HDB FIN|CHOLA|FIVESTAR", re.I)


def categorize(txn, meta):
    desc = txn["desc"] or ""
    amt = txn["amount"]
    bank = meta["bank"]
    holder = meta.get("name") or ""
    credit = amt > 0

    # empty description (SBI prints blank rows for interest and misc)
    if desc in ("", '""'):
        return ("Interest" if abs(amt) <= 500 else "Others") if credit else "Others"

    if re.search(r"Int\.Pd|CREDIT INTEREST|INTEREST CREDIT|INTEREST PAID|:Int\.|^SBINT|SBINT FOR THE",
                 desc, re.I):
        return "Interest"
    if re.search(r"Mandate fail Chrg|RTN CHG|CHQ RTN CHG", desc, re.I):
        return "Bounced I/W ECS Charges"
    if re.search(r"SMS CHARGES|Sms Charges|MAINTENANCE CHARGES|DEBIT CARD CHARGE|ANN\.FEE|"
                 r"ATMCard AMC|Chrg |CONSOLIDATED CHARGES|CHG FOR |CHARGES? FOR |SERVICE CHARGE|"
                 r"^GST |GST ON |INCIDENTAL|CHRGS-|ANNUAL FEE|AMC_Charges|AMC CHARGE|"
                 r"SMS ALERT|ALERT CHARGE|^CHGS\b", desc, re.I):
        return "Bank Charges"
    if re.search(r"UGRO.*?/Colle|/Colle$", desc):
        return "Bank Charges"
    if re.search(r"PMSBY|PMJJBY|SBI LIFE|LIC OF INDIA|INSURANCE|PM SURAKSHA|JEEVAN JYOTI", desc, re.I):
        return "Insurance"
    if re.search(r"^APB/|LPG SUBSIDY|SUBSIDY|KALAINGAR|PMKISAN", desc):
        return "Subsidy"
    if re.search(r"UPI/REV/|^REVERSAL[:\s]|\bREVERSAL:", desc):
        return "Reversal"
    if credit and re.search(r"^BY CASH\b|^CDM\d|CASH DEPOSIT|CASH DEP\b", desc):
        return "Cash Deposit"
    if not credit and re.search(r"AEPS-ONUS-CW|ATM CASH|TO ATM WDL|^SELF$|CASH WITHDRAWAL BY CHQ|"
                                r"CASH WDL|ATM WDL|BY CLG|CASH PAID", desc):
        return "Cash Withdrawal"
    if re.search(r"CREDIT CARD PAYMENT|\bCC \d{3,}.*AUTOPAY|CARD PAYMENT|CREDITCARD", desc):
        return "Credit Card Payment"
    if credit and (re.search(r"TREASURYDIS|MERCHANT_DISBURS|DISBURSEMENT", desc) or
                   re.search(r"MUTHOOT.*P2AMOB", desc)):
        return "Loan Disbursed"
    if re.search(r"NEFT:GOOGLE INDIA DIGITAL", desc):
        return "UPI Settlement"
    if re.search(r"PAYTM\. REFU", desc):
        return "UPI Settlement"

    # merchant keyword table (matches on vpa/handle too)
    for pat, cat in _KEYWORD_RULES:
        if re.search(pat, desc):
            return cat

    # PhonePe in any form → canonical party
    if re.search(r"PHONEPE|PhonePe|Phonepe", desc):
        return ("Transfer from PHONEPE LIMITED" if credit else "Transfer to PHONEPE LIMITED")

    # UPI fields
    party, handle = _upi_fields(desc, bank)

    # salary-tagged VPA
    if handle and re.search(r"sal\b|\.999sal|salary", handle, re.I):
        return "Salary" if credit else "Salary Paid"

    # loan payees via UPI / mandate debits
    if not credit and (_LOAN_UPI.search(desc) and "NEFT*" not in desc):
        return "Loan"
    if not credit and re.search(r"MAND DR-|CMP MANDATE DEBIT|ACHDr|NACH0|^ACH D-|\bACH D-|"
                                r"Loan Repayment|LOAN REPAY|EMI DEBIT", desc):
        return "Loan"
    if credit and re.search(r"DEP BY SALARY|BY SALARY|SALARY CREDIT|/SALARY\b", desc, re.I):
        return "Salary"
    if re.search(r"^APY/|ATAL PENSION|\bAPY\b", desc):
        return "Insurance"
    if re.search(r"^FIT/|FIXED DEPOSIT|\bRD\b INSTAL|RDTAX|TERM DEPOSIT", desc):
        return "Investment Expense"
    if re.search(r"^B/F\b|BROUGHT FORWARD|OPENING BALANCE", desc):
        return "Opening Balance"
    if re.search(r"IB FUNDS TRANSFER|FUNDS TRANSFER|^FT-|TRANSFER FROM \d|TRANSFER TO \d|"
                 r"TPD-ONUS|^BY SB \d|^TO TRF", desc):
        return "Transfer in" if credit else "Transfer out"
    if not credit and re.search(r"^NWD-|\bNWD-|TO CASH\b|-ATM-|\bATM\b.*(?:ROAD|BRANCH|MAIN)", desc):
        return "Cash Withdrawal"
    if credit and re.search(r"-BNA-|\bBNA\b|CASH ACCEPT", desc):
        return "Cash Deposit"
    if re.search(r"-TPT-|\bTPT\b|MOB-IMPS|^SB \d+$|\bcdm rev\b", desc, re.I):
        if re.search(r"cdm rev", desc, re.I):
            return "Reversal"
        return "Transfer in" if credit else "Transfer out"
    if re.search(r"POS TXN|^POS |/POS/|PURCHASE AT", desc):
        return "Online Shopping" if re.search(r"AMAZON|FLIPKART|MEESHO", desc) else "Household"
    if re.search(r"INSTAALERTCHG|INTER-BRN CASH CHG|_DAP_RENEWAL|ATM DECLINE|CHGS ACH DR RTN|"
                 r"CHG INCL GST|RTN CHG", desc):
        return "Bounced I/W ECS Charges" if re.search(r"RTN|RETURN", desc) else "Bank Charges"
    if re.search(r"CHQ PAID|CHEQUE PAID", desc):
        return "Cheque Payment"
    if re.search(r"I/W CHQ RETURN|CHQ RETURN|CHEQUE RETURN", desc):
        return "Bounced I/W ECS Charges"
    if not credit and re.search(r"ESFB/loan", desc):
        return "Loan"

    if party is not None:
        p = party.strip()
        digits = re.sub(r"\D", "", p)
        if p == "" or (digits and len(digits) >= 6 and len(digits) >= len(p.replace(" ", "")) - 1) or p.upper().startswith("BANK ACC"):
            return "Transfer in" if credit else "Transfer out"
        if _is_self_name(p, holder):
            return "Transfer from Self" if credit else "Transfer to Self"
        name = _clean_party(p)
        if not name:
            return "Transfer in" if credit else "Transfer out"
        # merchant-code tokens extend from the handle (e.g. 6EGZKE1J -> 6EGZKE1J1Q)
        if handle:
            h = handle.strip().rstrip(".").replace(" ", "")
            if any(c.isdigit() for c in name) and h.upper().startswith(name.replace(" ", "")) and len(h) > len(name):
                name = h.upper()
        txn["_party_handle"] = (handle or "").strip().lower()
        return ("Transfer from " if credit else "Transfer to ") + name

    # SBI IMPS: IMPS/<num>/<bank>-XX<digits>-<NAME>/<ref>
    m = re.match(r"^IMPS/\d+/\w+-XX\d+-\s*([^/]+?)\s*/", desc)
    if m:
        nm = _clean_party(re.sub(r"\d+$", "", m.group(1).strip()))
        if nm.startswith("PHONEPE"):
            nm = "PHONEPE LIMITED"
        if _is_self_name(nm, holder):
            return "Transfer from Self" if credit else "Transfer to Self"
        return ("Transfer from " if credit else "Transfer to ") + nm

    # POS purchases carrying the merchant name
    m = re.match(r"^OTHPOS\d+(.+)$", desc)
    if m:
        return ("Transfer from " if credit else "Transfer to ") + _clean_party(m.group(1))

    # UBI IMPS: IMPSAB/<num>/<NAME>/<acct>
    m = re.match(r"^IMPS(?:AB|AR)/\d+/([^/]+)/", desc)
    if m:
        nm = _clean_party(m.group(1))
        if _is_self_name(nm, holder):
            return "Transfer from Self" if credit else "Transfer to Self"
        return ("Transfer from " if credit else "Transfer to ") + nm

    # CUB IMPS: BY ONL 0000IMPSXXX<num>: <NAME>/<ref>::branch
    m = re.search(r"IMPS[A-Z]{3}\d+:\s*([^/:]+?)\s*/", desc)
    if m:
        nm = _clean_party(m.group(1))
        if _is_self_name(nm, holder):
            return "Transfer from Self" if credit else "Transfer to Self"
        return ("Transfer from " if credit else "Transfer to ") + nm

    # SBI special transfer rows
    m = re.search(r"UPI/(REF|DRC)/\d+", desc)
    if m:
        return ("Transfer from " if credit else "Transfer to ") + m.group(1)
    m = re.search(r"TO TRANSFER INB (E mandate) (\w{4})", desc)
    if m:
        return "Transfer to E MANDATE " + m.group(2)[:4]
    if re.search(r"^TO TRANSFER INB ", desc):
        nm = _clean_party(re.sub(r"^TO TRANSFER INB ", "", desc)[:30])
        return "Transfer to " + nm if nm else "Transfer out"

    # own account number in description (card loads etc.)
    own = meta.get("account_no") or ""
    if own and not own.startswith("X") and own in desc:
        return "Transfer from Self" if credit else "Transfer to Self"

    # a narration that is JUST a name (IOB prints the counterparty alone) —
    # letters/dots/spaces only, no digits, so it cannot be a reference code
    if re.fullmatch(r"[A-Za-z][A-Za-z .]{2,40}", desc.strip()):
        nm = _clean_party(desc.strip())
        if _is_self_name(nm, holder):
            return "Transfer from Self" if credit else "Transfer to Self"
        if nm:
            return ("Transfer from " if credit else "Transfer to ") + nm

    # NEFT with trailing party name (stop at the next '*')
    m = re.search(r"NEFT\*[^*]+\*[^*]+\*\s*([^*]+)", desc)
    if m:
        nm = _clean_party(m.group(1))
        if nm.startswith("PHONEPE"):
            nm = "PHONEPE LIMITED"
        if nm:
            return ("Transfer from " if credit else "Transfer to ") + nm
    m = re.search(r"NEFT TRF:([^-]+?)-", desc)
    if m:
        nm = _clean_party(m.group(1))
        if nm:
            return ("Transfer from " if credit else "Transfer to ") + nm
    if re.search(r"^RTGS|^IMPS|NEFT", desc):
        return "Transfer in" if credit else "Transfer out"
    return "Others"


def _canonicalize_parties(txns):
    """Merge only near-identical party-name variants:
    'RESHMA' + 'RESHMA R' (trailing initial) or 'JEYANTHI' + 'R JEYANTHI'
    (leading initial). Winner = more frequent name; tie → shorter."""
    pat = re.compile(r"^Transfer (to|from) (?!Self$|PHONEPE LIMITED$)(.+)$")
    counts = Counter()
    for t in txns:
        m = pat.match(t.get("category") or "")
        if m:
            counts[m.group(2)] += 1

    def variant(short, lng):
        if len(short) < 4:
            return False
        # "RESHMA" + "RESHMA R" (trailing initial) or "R JEYANTHI" (leading initial)
        if (re.fullmatch(re.escape(short) + r" \S{1,2}\.?", lng) is not None or
                re.fullmatch(r"\S\.? " + re.escape(short), lng) is not None):
            return True
        # truncation variant: one is a prefix of the other, both alphabetic,
        # sharing >=6 leading chars (MURUGAN <- MURUGANV, ANANDURA <- ANANDURAI)
        sa, la = short.replace(" ", ""), lng.replace(" ", "")
        if len(sa) >= 6 and la.startswith(sa) and la[:len(sa)].isalpha() and len(la) - len(sa) <= 2:
            return True
        return False

    remap = {}
    names = sorted(counts, key=lambda n: (-counts[n], len(n)))
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            if a in remap or b in remap:
                continue
            short, lng = (a, b) if len(a) < len(b) else (b, a)
            if variant(short, lng):
                winner = a if (counts[a] > counts[b] or (counts[a] == counts[b] and len(a) < len(b))) else b
                loser = b if winner == a else a
                remap[loser] = winner
    for t in txns:
        m = pat.match(t.get("category") or "")
        if m and m.group(2) in remap:
            t["category"] = f"Transfer {m.group(1)} {remap[m.group(2)]}"
        t.pop("_party_handle", None)
    return txns


def categorize_all(meta):
    for t in meta["transactions"]:
        t["category"] = categorize(t, meta)
    _canonicalize_parties(meta["transactions"])
    return meta
