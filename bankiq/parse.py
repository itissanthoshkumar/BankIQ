"""Bank statement PDF parsers.

Each parser returns a dict:
    {
      "bank": "Union Bank of India" | "City Union Bank" | "State Bank of India",
      "institution": "<bank>, India",
      "name": raw holder name as printed,
      "address": joined address string,
      "mobile": str or None, "email": None, "pan": None,
      "account_no": str, "account_type": str or None,
      "ifsc": str or None,
      "period": (date, date) or None,          # statement period as printed
      "transactions": [ {date, desc, amount(+cr/-dr), balance, cheque} ... ],
    }
Transactions are in statement order; balance is the running balance after the txn.
"""
import datetime
import re

import fitz  # PyMuPDF — ~40x faster text/word extraction than pdfplumber
from pypdf import PdfReader, PdfWriter


# ── fitz-backed compatibility shim ─────────────────────────────────────────
# Exposes the small slice of the pdfplumber API the parsers rely on
# (doc.pages / page.extract_text() / page.extract_words()), so the tuned
# per-bank logic runs unchanged on the much faster MuPDF engine.
class _Page:
    __slots__ = ("_p",)

    def __init__(self, fpage):
        self._p = fpage

    def extract_text(self, ytol=2.6):
        # rebuild text so each VISUAL row is one line (matches pdfplumber's grouping,
        # which the per-bank regexes depend on — fitz's native get_text splits differently)
        words = self._p.get_text("words")  # (x0, y0, x1, y1, "word", block, line, word_no)
        if not words:
            return ""
        words.sort(key=lambda w: (w[1], w[0]))
        rows = []
        for w in words:
            if rows and abs(w[1] - rows[-1][0]) <= ytol:
                rows[-1][1].append(w)
            else:
                rows.append([w[1], [w]])
        return "\n".join(" ".join(w[4] for w in sorted(ws, key=lambda w: w[0]))
                         for _, ws in rows)

    def extract_words(self, **_kw):
        return [{"text": w[4], "x0": w[0], "x1": w[2], "top": w[1], "bottom": w[3]}
                for w in self._p.get_text("words")]

    def flush_cache(self):
        pass


class _Doc:
    def __init__(self, src):
        # accept either a filesystem path or raw PDF bytes (zero-storage server flow)
        if isinstance(src, (bytes, bytearray)):
            self._d = fitz.open(stream=src, filetype="pdf")
        else:
            self._d = fitz.open(src)
        self.pages = [_Page(p) for p in self._d]

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self._d.close()
        return False


def _open(src):
    return _Doc(src)


def decrypt_bytes(src_bytes, password=None):
    """Return (decrypted_pdf_bytes, was_protected). Pure in-memory — nothing
    touches disk, so no plaintext copy of a statement ever lands in a temp dir."""
    import io
    reader = PdfReader(io.BytesIO(src_bytes))
    if not reader.is_encrypted:
        return src_bytes, False
    if not password:
        raise ValueError("PDF is password-protected; pass --password")
    if reader.decrypt(password) == 0:
        raise ValueError("wrong PDF password")
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue(), True


def decrypt_to(src, password, dest):
    """Write a decrypted copy of src to dest (pass-through when not encrypted).
    Kept for compatibility; the app itself uses decrypt_bytes."""
    with open(src, "rb") as fh:
        data, _ = decrypt_bytes(fh.read(), password)
    with open(dest, "wb") as fh:
        fh.write(data)
    return dest


def _num(s):
    return float(s.replace(",", ""))


def _join_frag(parts):
    """Join wrapped description fragments the way the reference reports do:
    single space between fragments, except no space after a hyphen break."""
    out = ""
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if not out:
            out = p
        elif out.endswith("-"):
            out += p
        elif out[-1].isdigit() and p[0].isdigit():
            out += p
        else:
            out += " " + p
    return out


def _rows_from_words(page, ytol=2.6):
    """Group pdfplumber words into visual rows by their top coordinate."""
    words = page.extract_words(keep_blank_chars=False)
    rows = []
    for w in sorted(words, key=lambda w: (w["top"], w["x0"])):
        if rows and abs(w["top"] - rows[-1][0]) <= ytol:
            rows[-1][1].append(w)
        else:
            rows.append([w["top"], [w]])
    out = [(top, sorted(ws, key=lambda w: w["x0"])) for top, ws in rows]
    _flush(page)   # release pdfplumber's per-page cache — it balloons over many pages
    return out


def _flush(page):
    """Free a pdfplumber page's cached objects (keeps peak memory bounded on big PDFs)."""
    try:
        page.flush_cache()
    except Exception:
        pass


# --------------------------------------------------------------- Union Bank
_UBI_TXN = re.compile(
    r"^(\d{2}-\d{2}-\d{4})\s+(\S+)\s+(.*?)\s+([\d,]+\.\d{2})\((Cr|Dr)\)\s+([\d,]+\.\d{2})\((Cr|Dr)\)$"
)


def parse_union_bank(pdf):
    meta = {"bank": "Union Bank of India", "institution": "Union Bank of India, India",
            "mobile": None, "email": None, "pan": None, "account_type": None,
            "ifsc": None, "period": None, "name": None, "address": None,
            "account_no": None, "account_name": None}
    txns = []
    with _open(pdf) as doc:
        first = doc.pages[0].extract_text() or ""
        m = re.search(r"Name\s+(.+?)\s+Customer/CIF ID", first)
        if m:
            meta["name"] = m.group(1).strip()
        m = re.search(r"Account Name\s+([A-Z][^\n]*?)\s*$", first, re.M)
        if m:
            meta["account_name"] = m.group(1).strip()
        m = re.search(r"Account Number\s+(\d+)", first)
        if m:
            meta["account_no"] = m.group(1)
        m = re.search(r"Account Type\s+([A-Za-z ]+?)(?:\s{2,}|\n)", first)
        if m:
            meta["account_type"] = m.group(1).strip()
        m = re.search(r"IFSC\s+(\w+)", first)
        if m:
            meta["ifsc"] = m.group(1)
        m = re.search(r"Mobile No\s+([^\n]+)", first)
        if m:
            mob = re.sub(r"\s*(Currency|IFSC|Account).*$", "", m.group(1)).strip()
            meta["mobile"] = mob or None
        m = re.search(r"Statement Period\s+(\d{2}-\d{2}-\d{4}) to (\d{2}-\d{2}-\d{4})", first)
        if m:
            meta["period"] = (datetime.datetime.strptime(m.group(1), "%d-%m-%Y").date(),
                              datetime.datetime.strptime(m.group(2), "%d-%m-%Y").date())
        # address block: the lines around the 'Address' label (left column only),
        # from the line after the Name row down to the Mobile No row
        lines = [l.strip() for l in first.splitlines()]
        addr_parts = []
        name_i = addr_i = None
        for i, l in enumerate(lines):
            if name_i is None and re.match(r"^Name\s+\S", l):
                name_i = i
            if l.startswith("Address"):
                addr_i = i
                break
        if addr_i is not None:
            start = name_i + 1 if name_i is not None else max(0, addr_i - 2)
            for j in range(start, len(lines)):
                lj = lines[j]
                if lj.startswith("Mobile No"):
                    break
                lj = re.sub(r"(Customer/CIF ID|Account Type|Account Name|Account Number|Currency|IFSC).*$", "", lj).strip()
                if lj:
                    addr_parts.append(lj)
        if addr_parts:
            meta["address"] = _join_frag(addr_parts)

        pend = None
        for page in doc.pages:
            text = page.extract_text() or ""
            _flush(page)
            for line in text.splitlines():
                line = line.strip()
                m = _UBI_TXN.match(line)
                if m:
                    d, txid, desc, amt, drcr, bal, baldrcr = m.groups()
                    amount = _num(amt) * (1 if drcr == "Cr" else -1)
                    balance = _num(bal) * (1 if baldrcr == "Cr" else -1)
                    txns.append({"date": datetime.datetime.strptime(d, "%d-%m-%Y").date(),
                                 "desc": re.sub(r"\s+", " ", desc).strip(),
                                 "amount": amount, "balance": balance, "cheque": None})
    meta["transactions"] = txns
    return meta


# --------------------------------------------------------------- City Union Bank
_CUB_DATE = re.compile(r"^\d{2}-[A-Z]{3}-\d{4}$")


def parse_cub(pdf):
    meta = {"bank": "City Union Bank", "institution": "City Union Bank, India",
            "mobile": None, "email": None, "pan": None, "account_type": None,
            "ifsc": None, "period": None, "name": None, "address": None,
            "account_no": None, "account_name": None}
    txns = []
    with _open(pdf) as doc:
        first = doc.pages[0].extract_text() or ""
        m = re.search(r"Account No\s*:\s*(\d+)", first)
        if m:
            meta["account_no"] = m.group(1)
        m = re.search(r"Account Type\s*:\s*(.+?)\s+(?:Date of Opening|Mode Of|CKYC|\s{2,}|$)",
                      first, re.M)
        if m:
            meta["account_type"] = m.group(1).strip()
        m = re.search(r"IFSC:(\w+)", first)
        if m:
            meta["ifsc"] = m.group(1)
        m = re.search(r"Statement Dt\s*:\s*(\d{2}-[A-Z]{3}-\d{4}) to (\d{2}-[A-Z]{3}-\d{4})", first)
        if m:
            meta["period"] = (datetime.datetime.strptime(m.group(1), "%d-%b-%Y".replace("%b", "%b")).date()
                              if False else datetime.datetime.strptime(m.group(1).title(), "%d-%b-%Y").date(),
                              datetime.datetime.strptime(m.group(2).title(), "%d-%b-%Y").date())
        # name: line after "Customer No"-block, all-caps with MR/MRS
        lines = [l.strip() for l in first.splitlines() if l.strip()]
        addr_parts = []
        for i, l in enumerate(lines):
            if re.match(r"^(MR|MRS|MS|M/S)\.? .+", l) and meta["name"] is None:
                meta["name"] = l
                for j in range(i + 1, len(lines)):
                    if lines[j].startswith("Opening Balance") or "Particulars" in lines[j]:
                        break
                    addr_parts.append(lines[j])
                break
        if addr_parts:
            meta["address"] = _join_frag(addr_parts)

        # transactions from word rows (Debit/Credit columns by x position);
        # wrapped description fragments attach to the NEAREST date row by y.
        BOUNDARY = re.compile(
            r"Page \d+ of \d+|STATEMENT|Branch:|Opening Balance|Particulars|Chq No|"
            r"CITY UNION|TRANSACTION TOTAL|Closing Balance|GRAND TOTAL|Statement Dt|"
            r"Account (No|Type)|Customer No|Ref No|Visit www|Dial your bank|Door No|"
            r"Regd\. Office|CIN\s*:|Telephone No|Fax\s*:|Website|Amt (Brought|Carried) Forward|"
            r"Date of Opening|Mode Of Operation|CKYC No", re.I)
        for page in doc.pages:
            rows = _rows_from_words(page)
            xdebit = xcredit = xbal = None
            header_y = -1.0
            for top, ws in rows:
                labels = {w["text"]: w for w in ws}
                if "Debit" in labels and "Credit" in labels and "Balance" in labels:
                    xdebit = (labels["Debit"]["x0"] + labels["Debit"]["x1"]) / 2
                    xcredit = (labels["Credit"]["x0"] + labels["Credit"]["x1"]) / 2
                    xbal = (labels["Balance"]["x0"] + labels["Balance"]["x1"]) / 2
                    header_y = top
                    break
            if xdebit is None:
                xdebit, xcredit, xbal = 320, 400, 490
            anchors = []   # (top, txn-dict)
            frags = []     # (top, text)
            for top, ws in rows:
                texts = [w["text"] for w in ws]
                if not texts:
                    continue
                joined = " ".join(texts)
                if _CUB_DATE.match(texts[0]):
                    date = datetime.datetime.strptime(texts[0].title(), "%d-%b-%Y").date()
                    nums = [w for w in ws[1:] if re.fullmatch(r"[\d,]+\.\d{2}", w["text"])]
                    descw = [w for w in ws[1:] if w not in nums]
                    amount = balance = None
                    for w in nums:
                        cx = (w["x0"] + w["x1"]) / 2
                        v = _num(w["text"])
                        dd, dc, db = abs(cx - xdebit), abs(cx - xcredit), abs(cx - xbal)
                        if db <= min(dd, dc):
                            balance = v
                        elif dd <= dc:
                            amount = -v
                        else:
                            amount = v
                    anchors.append((top, {"date": date, "mid": " ".join(w["text"] for w in descw),
                                          "amount": amount, "balance": balance, "cheque": None}))
                elif BOUNDARY.search(joined) or top <= header_y:
                    continue
                else:
                    nums = [w for w in ws if re.fullmatch(r"[\d,]+\.\d{2}", w["text"])]
                    descw = [w for w in ws if w not in nums]
                    line_txt = " ".join(w["text"] for w in descw)
                    if line_txt:
                        frags.append((top, line_txt))
            # attach each fragment to the nearest anchor on this page
            for ftop, text in frags:
                if not anchors:
                    continue
                best = min(anchors, key=lambda a: abs(a[0] - ftop))
                t = best[1]
                t.setdefault("above" if ftop < best[0] else "below", []).append((ftop, text))
            for top, t in anchors:
                parts = ([x[1] for x in sorted(t.pop("above", []))] +
                         [t.pop("mid")] +
                         [x[1] for x in sorted(t.pop("below", []))])
                t["desc"] = _join_frag(parts)
                txns.append(t)
    meta["transactions"] = [t for t in txns if t["amount"] is not None and t["balance"] is not None]
    return meta


# --------------------------------------------------------------- SBI
_SBI_TXN = re.compile(r"^(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})\s*(.*)$")
_SBI_AMT = re.compile(r"-?[\d,]+\.\d{2}")


def parse_sbi(pdf):
    meta = {"bank": "State Bank of India", "institution": "State Bank of India, India",
            "mobile": None, "email": None, "pan": None, "account_type": None,
            "ifsc": None, "period": None, "name": None, "address": None,
            "account_no": None, "account_name": None}
    raw = []
    with _open(pdf) as doc:
        first = doc.pages[0].extract_text() or ""
        m = re.search(r"Statement of (.+?) \(A/c-(\S+)\) between (\d{2}/\d{2}/\d{4}) to (\d{2}/\d{2}/\d{4})", first)
        if m:
            meta["name"] = m.group(1).strip()
            meta["account_no"] = m.group(2).replace("x", "X")
            meta["period"] = (datetime.datetime.strptime(m.group(3), "%d/%m/%Y").date(),
                              datetime.datetime.strptime(m.group(4), "%d/%m/%Y").date())
        # address: left-column words between the name row and 'Statement of'
        rows0 = _rows_from_words(doc.pages[0])
        addr_parts = []
        started = False
        for top, ws in rows0:
            left = [w["text"] for w in ws if w["x1"] < 290]
            line = " ".join(left)
            if not line:
                continue
            if not started and re.match(r"^(Mr|Mrs|Ms|M/s)\.? ", line):
                started = True
                continue
            if started:
                if line.startswith("Statement of") or "Account Number" in line:
                    break
                if re.fullmatch(r"\d{6}", line):  # pincode ends the block
                    break
                if line.strip() == "NA":  # placeholder state token
                    continue
                addr_parts.append(line)
        if addr_parts:
            meta["address"] = _join_frag(addr_parts)

        for page in doc.pages:
            text = page.extract_text() or ""
            _flush(page)
            for line in text.splitlines():
                line = line.strip()
                if not line:
                    continue
                m = _SBI_TXN.match(line)
                if m:
                    # SBI prints negative balances with a trailing minus: "123.00-"
                    rest = re.sub(r"([\d,]+\.\d{2})-(?=\s|$)", r"-\1", m.group(3))
                    nums = _SBI_AMT.findall(rest)
                    # balance is the last number; amount the one before (may be absent)
                    balance = _num(nums[-1]) if nums else None
                    amount = _num(nums[-2]) if len(nums) >= 2 else None
                    desc = rest
                    for n in reversed(nums[-2:] if len(nums) >= 2 else nums[-1:]):
                        idx = desc.rfind(n)
                        if idx >= 0:
                            desc = desc[:idx] + desc[idx + len(n):]
                    desc = re.sub(r"\s+", " ", desc).strip()
                    raw.append({"date": datetime.datetime.strptime(m.group(1), "%d/%m/%Y").date(),
                                "frags": [desc], "amount": amount, "balance": balance})
                elif raw and not re.search(r"Txn Date|Value Date|Statement of|computer generated|Page \d|Registered Branch|Account Number|Branch :|Account Name|Interest Rate|CIF NO|Balance as on|Important|Dear Customer|initiative|sent via e-mail|your e-mail|End of Statement", line):
                    raw[-1]["frags"].append(line)
    # resolve sign by balance delta
    txns = []
    prev_bal = None
    for r in raw:
        desc = _join_frag(r["frags"]) or '""'  # blank descriptions render as ""
        amt, bal = r["amount"], r["balance"]
        if amt is None and bal is not None:
            amt = 0.0
        if prev_bal is not None and amt is not None and bal is not None:
            if abs(prev_bal + amt - bal) < 0.005:
                signed = amt
            elif abs(prev_bal - amt - bal) < 0.005:
                signed = -amt
            else:
                # fall back on textual hints
                signed = -amt if re.search(r"/DR/|ATM CASH|DEBIT|ACHDr|Dr\b", desc) else amt
        else:
            signed = amt if amt is not None else 0.0
            if re.search(r"/DR/|ATM CASH|DEBIT|ACHDr", desc):
                signed = -abs(signed)
        txns.append({"date": r["date"], "desc": desc, "amount": signed,
                     "balance": bal, "cheque": None})
        prev_bal = bal
    meta["transactions"] = txns
    return meta


# ------------------------------------------ SBI "Statement of Account" (net-banking export)
# Rows look like:
#   WDL TFR
#   19/08/2026 19/08/2026 UPI/DR/947166.../MASHETT - 35.00 - 25,853.68
#   <wrapped description lines...>
# i.e. TxnDate ValueDate <desc> <Ref> <Debit> <Credit> <Balance>, with '-' as an empty cell.
_SOA_ROW = re.compile(r"^(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})\s+(.+)$")
_SOA_TYPE = re.compile(r"^(WDL|DEP)\s+[A-Z]{2,4}$")          # row-type marker line (WDL TFR / DEP CSH …)
_SOA_MONEY = re.compile(r"^-?[\d,]+\.\d{2}$")


def _soa_money(tok):
    """An SOA amount cell: '-' means empty; strips CR/DR and trailing-minus. Returns float or None."""
    tok = tok.strip()
    if tok in ("-", "", "--"):
        return None
    t = re.sub(r"(?i)(cr|dr)$", "", tok)
    neg = t.endswith("-")
    t = t.rstrip("-").replace(",", "")
    try:
        v = float(t)
    except ValueError:
        return None
    return -v if neg else v


def parse_sbi_soa(pdf):
    meta = {"bank": "State Bank of India", "institution": "State Bank of India, India",
            "mobile": None, "email": None, "pan": None, "account_type": None,
            "ifsc": None, "period": None, "name": None, "address": None,
            "account_no": None, "account_name": None}
    raw = []
    with _open(pdf) as doc:
        head = "\n".join((doc.pages[i].extract_text() or "") for i in range(min(3, len(doc.pages))))
        alltext = None
        m = re.search(r"As on\s+\d{2}-\d{2}-\d{4}\s*\n\s*((?:Mr|Mrs|Ms|M/s)\.?\s+[^\n]+)", head)
        if m:
            meta["name"] = re.sub(r"\s+", " ", m.group(1)).strip()
        m = re.search(r"Account\s*(?:Number|No)\.?\s*:?\s*([0-9]{9,})", head)
        if not m:
            _parts = []
            for p in doc.pages:
                _parts.append(p.extract_text() or "")
                _flush(p)
            alltext = "\n".join(_parts)
            m = re.search(r"Account\s*(?:Number|No)\.?\s*:?\s*([0-9]{9,})", alltext)
        if m:
            meta["account_no"] = m.group(1)
        m = re.search(r"Product\s*:\s*([^\n]+)", head)
        if m:
            prod = m.group(1).strip()
            meta["account_type"] = ("Savings Account" if re.search(r"SAV", prod, re.I)
                                    else "Current Account" if re.search(r"CURRENT", prod, re.I)
                                    else prod[:40])
        m = re.search(r"IFSC\s*(?:Code)?\s*:?\s*([A-Z]{4}0[A-Z0-9]{6})", head)
        if m:
            meta["ifsc"] = m.group(1)
        m = re.search(r"Statement Summary\s*:\s*(\d{2}-\d{2}-\d{4})\s+To\s+(\d{2}-\d{2}-\d{4})",
                      alltext or head)
        if m:
            try:
                meta["period"] = (datetime.datetime.strptime(m.group(1), "%d-%m-%Y").date(),
                                  datetime.datetime.strptime(m.group(2), "%d-%m-%Y").date())
            except ValueError:
                pass

        for page in doc.pages:
            text = page.extract_text() or ""
            _flush(page)
            for line in text.splitlines():
                line = line.strip()
                if not line or _SOA_TYPE.match(line):
                    continue
                m = _SOA_ROW.match(line)
                if m:
                    toks = m.group(3).split()
                    if len(toks) >= 4 and _SOA_MONEY.match(re.sub(r"(?i)(cr|dr)$", "", toks[-1])):
                        bal = _soa_money(toks[-1])
                        credit = _soa_money(toks[-2])
                        debit = _soa_money(toks[-3])
                        cheque = None if toks[-4] == "-" else toks[-4]
                        # some rows print the WDL/DEP type marker inline instead of the desc
                        desc0 = re.sub(r"^(?:WDL|DEP)\s+[A-Z]{2,4}\b", "", " ".join(toks[:-4])).strip()
                        amt = -abs(debit) if debit else (abs(credit) if credit else 0.0)
                        try:
                            d = datetime.datetime.strptime(m.group(1), "%d/%m/%Y").date()
                        except ValueError:
                            continue
                        raw.append({"date": d, "frags": [desc0] if desc0 else [],
                                    "amount": amt, "balance": bal, "cheque": cheque})
                        continue
                if raw and not re.search(
                        r"Statement Summary|Brought Forward|Please do not share|computer generated|"
                        r"Page \d|Account Number|^Branch |This is a|Power of Attorney|Balance$|"
                        r"Dr Count|Cr Count|[\d,]+\.\d{2}CR\b|Txn Date|Value Date|End of Statement|"
                        r"anyone via email|Bank never asks|does not require a signature|extra care", line):
                    raw[-1]["frags"].append(line)
    txns = [{"date": r["date"], "desc": _join_frag(r["frags"]) or '""', "amount": r["amount"],
             "balance": r["balance"], "cheque": r["cheque"]} for r in raw]
    if not meta["period"] and txns:
        meta["period"] = (min(t["date"] for t in txns), max(t["date"] for t in txns))
    meta["transactions"] = txns
    return meta


# ------------------------------------------ Canara Bank
# Header: TRANS VALUE BRANCH REF/CHQ.NO DESCRIPTION WITHDRAWS DEPOSIT BALANCE
# Row:    06-DEC-25 06-DEC-25 33 NEFT CR- 0.00 18,077.00 18,146.98   (dates are DD-MON-YY)
_CANARA_ROW = re.compile(r"^(\d{2}-[A-Za-z]{3}-\d{2})\s+(\d{2}-[A-Za-z]{3}-\d{2})\s+(.+)$")


def parse_canara(pdf):
    meta = {"bank": "Canara Bank", "institution": "Canara Bank, India",
            "mobile": None, "email": None, "pan": None, "account_type": None,
            "ifsc": None, "period": None, "name": None, "address": None,
            "account_no": None, "account_name": None}
    raw = []
    with _open(pdf) as doc:
        head = "\n".join((doc.pages[i].extract_text() or "") for i in range(min(2, len(doc.pages))))
        for key, pat in (("name", r"Customer Name\s*:\s*([^\n]+)"),
                         ("account_no", r"Account No\s*:\s*([0-9]+)"),
                         ("ifsc", r"IFSC\s*:\s*([A-Z0-9]+)")):
            m = re.search(pat, head)
            if m:
                meta[key] = m.group(1).strip()
        m = re.search(r"Product Name\s*:\s*([^\n]+)", head)
        if m:
            prod = m.group(1).strip()
            meta["account_type"] = "Savings Account" if re.search(r"SAV", prod, re.I) else prod[:40]
        m = re.search(r"Period\s*:\s*(\d{2}-\d{2}-\d{4})\s+To\s+(\d{2}-\d{2}-\d{4})", head)
        if m:
            try:
                meta["period"] = (datetime.datetime.strptime(m.group(1), "%d-%m-%Y").date(),
                                  datetime.datetime.strptime(m.group(2), "%d-%m-%Y").date())
            except ValueError:
                pass

        for page in doc.pages:
            text = page.extract_text() or ""
            _flush(page)
            for line in text.splitlines():
                line = line.strip()
                if not line:
                    continue
                m = _CANARA_ROW.match(line)
                if m:
                    toks = m.group(3).split()
                    money = r"^-?[\d,]+\.\d{2}$"
                    if len(toks) >= 3 and re.match(money, toks[-1]):
                        bal = _num(toks[-1])
                        # WITHDRAWS / DEPOSIT columns; either may carry a leading '-' for a
                        # reversal (e.g. a '-500.00' withdrawal is ₹500 credited back)
                        dep = _num(toks[-2]) if re.match(money, toks[-2]) else 0.0
                        wdl = _num(toks[-3]) if re.match(money, toks[-3]) else 0.0
                        mid = toks[:-3]
                        if mid and mid[0].isdigit():
                            mid = mid[1:]                       # drop the branch-code column
                        desc0 = " ".join(mid).strip()
                        amt = 0.0 if re.match(r"^B/F\b", desc0) else (dep - wdl)
                        try:
                            d = datetime.datetime.strptime(m.group(1), "%d-%b-%y").date()
                        except ValueError:
                            continue
                        raw.append({"date": d, "frags": [desc0] if desc0 else [],
                                    "amount": amt, "balance": bal, "cheque": None})
                        continue
                if raw and not re.search(r"TRANS|VALUE|DESCRIPTION|WITHDRAWS|DEPOSIT|BALANCE|"
                                         r"Page \d|Opening Balance|Closing Balance|Statement of|"
                                         r"CANARA BANK|Total ", line):
                    raw[-1]["frags"].append(line)
    txns = [{"date": r["date"], "desc": _join_frag(r["frags"]) or '""', "amount": r["amount"],
             "balance": r["balance"], "cheque": r["cheque"]} for r in raw]
    if not meta["period"] and txns:
        meta["period"] = (min(t["date"] for t in txns), max(t["date"] for t in txns))
    meta["transactions"] = txns
    return meta


# ------------------------------------------ Indian Bank "Statement of Account"
# Columns: Post Date | Value Date | Details | Chq.No. | Debit | Credit | Balance
# Row: 10/01/26 10/01/26 <details> 4459.00 5007.60Cr  (one amount printed; balance carries Cr/Dr)
_ISOA_ROW = re.compile(
    r"^(\d{2}/\d{2}/\d{2})\s+(\d{2}/\d{2}/\d{2})\s+(?:(.*?)\s+)?([\d,]+\.\d{2})\s+([\d,]+\.\d{2})(cr|dr)\s*$",
    re.I)


def _isoa_bal(numstr, crdr):
    v = float(numstr.replace(",", ""))
    return v if crdr.lower() == "cr" else -v


def parse_indian_soa(pdf):
    meta = {"bank": "Indian Bank", "institution": "Indian Bank, India",
            "mobile": None, "email": None, "pan": None, "account_type": None,
            "ifsc": None, "period": None, "name": None, "address": None,
            "account_no": None, "account_name": None}
    raw = []
    prev_bal = None
    with _open(pdf) as doc:
        head = "\n".join((doc.pages[i].extract_text() or "") for i in range(min(2, len(doc.pages))))
        m = re.search(r"Account No\s*:\s*(\d+)", head)
        if m:
            meta["account_no"] = m.group(1)
        m = re.search(r"IFSC\s*Code\s*:\s*([A-Z0-9]+)", head)
        if m:
            meta["ifsc"] = m.group(1)
        m = re.search(r"Product\s*:\s*([^\n]+)", head)
        if m:
            prod = m.group(1).strip()
            meta["account_type"] = "Savings Account" if re.search(r"\bSB|SAV", prod, re.I) else prod[:40]
        m1 = re.search(r"Statement From\s*:\s*(\d{2}-[A-Za-z]{3}-\d{4})", head)
        m2 = re.search(r"\bTo\s*:\s*(\d{2}-[A-Za-z]{3}-\d{4})", head)
        if m1 and m2:
            try:
                meta["period"] = (datetime.datetime.strptime(m1.group(1), "%d-%b-%Y").date(),
                                  datetime.datetime.strptime(m2.group(1), "%d-%b-%Y").date())
            except ValueError:
                pass
        m = re.search(r"STATEMENT OF ACCOUNT\s*\n(?:INDIAN BANK\s*\n)?([A-Z][A-Za-z][^\n]*)", head)
        if m:
            meta["name"] = m.group(1).strip()

        for page in doc.pages:
            for line in (page.extract_text() or "").splitlines():
                line = line.strip()
                mb = re.match(r"(?:Brought Forward|Opening Balance)\s+([\d,]+\.\d{2})(cr|dr)\s*$", line, re.I)
                if mb:
                    prev_bal = _isoa_bal(mb.group(1), mb.group(2))
                    continue
                m = _ISOA_ROW.match(line)
                if m:
                    try:
                        d = datetime.datetime.strptime(m.group(1), "%d/%m/%y").date()
                    except ValueError:
                        continue
                    details = (m.group(3) or "").strip()
                    amt = float(m.group(4).replace(",", ""))
                    bal = _isoa_bal(m.group(5), m.group(6))
                    if prev_bal is None:
                        signed = amt
                    elif abs(prev_bal + amt - bal) < 0.02:
                        signed = amt
                    elif abs(prev_bal - amt - bal) < 0.02:
                        signed = -amt
                    else:
                        signed = amt if bal >= prev_bal else -amt   # gap; best-effort by delta sign
                    prev_bal = bal
                    raw.append({"date": d, "frags": [details] if details else [],
                                "amount": signed, "balance": bal, "cheque": None})
                elif raw and not re.search(
                        r"Brought Forward|Carried Forward|Statement Summary|Post Date|Value Date|"
                        r"In Case Your|Page No|STATEMENT OF ACCOUNT|Account No\b", line):
                    raw[-1]["frags"].append(line)
    txns = [{"date": r["date"], "desc": _join_frag(r["frags"]) or '""', "amount": r["amount"],
             "balance": r["balance"], "cheque": None} for r in raw]
    if not meta["period"] and txns:
        meta["period"] = (min(t["date"] for t in txns), max(t["date"] for t in txns))
    meta["transactions"] = txns
    return meta


# --------------------------------------------------------------- HDFC
_HDFC_DATE = re.compile(r"^\d{2}/\d{2}/\d{2}$")
_HDFC_AMT = re.compile(r"^[\d,]+\.\d{2}$")


def parse_hdfc(pdf):
    meta = {"bank": "HDFC Bank", "institution": "HDFC Bank, India",
            "mobile": None, "email": None, "pan": None, "account_type": None,
            "ifsc": None, "period": None, "name": None, "address": None,
            "account_no": None, "account_name": None}
    txns = []
    with _open(pdf) as doc:
        first = doc.pages[0].extract_text() or ""
        m = re.search(r"AccountNo\s*:?\s*(\d+)", first)
        if m:
            meta["account_no"] = m.group(1)
        m = re.search(r"IFSC\s*:?\s*(HDFC\w+)", first)
        if m:
            meta["ifsc"] = m.group(1)
        m = re.search(r"AccountType\s*:?\s*([^\n]+?)(?:\s{2,}|$)", first)
        if m:
            meta["account_type"] = m.group(1).strip()
        m = re.search(r"Email\s*:?\s*([^\s]+@[^\s]+)", first)
        if m:
            meta["email"] = m.group(1).strip()
        m = re.search(r"From\s*:?\s*(\d{2}/\d{2}/\d{4})\s*To\s*:?\s*(\d{2}/\d{2}/\d{4})", first)
        if m:
            meta["period"] = (datetime.datetime.strptime(m.group(1), "%d/%m/%Y").date(),
                              datetime.datetime.strptime(m.group(2), "%d/%m/%Y").date())
        # name: the ALL-CAPS holder line (e.g. "MR SYEDAZEEZ")
        for line in first.splitlines():
            s = line.strip()
            if re.match(r"^(MR|MRS|MS|M/S)\b", s) and "IFSC" not in s and meta["name"] is None:
                meta["name"] = re.sub(r"\s{2,}.*$", "", s).strip()
                break

        BOUNDARY = re.compile(r"Closingbalanceincludes|Contentsofthis|PageNo|Statement of|"
                              r"RTGS/NEFT|OpeningBalance|STATEMENTSUMMARY|GeneratedOn|"
                              r"HDFCBANKLIMITED|Registered Office", re.I)
        # sequential accumulation per page: a date-row opens a txn; following
        # narration rows (below the header, left of the amount columns) append
        # to it in order — robust for HDFC's tightly-packed wrapping.
        for page in doc.pages:
            rows = _rows_from_words(page)
            xw = xd = xb = None
            header_y = -1.0
            for top, ws in rows:
                lbl = {w["text"]: (w["x0"] + w["x1"]) / 2 for w in ws}
                if "WithdrawalAmt." in lbl and "DepositAmt." in lbl:
                    xw, xd = lbl["WithdrawalAmt."], lbl["DepositAmt."]
                    xb = lbl.get("ClosingBalance", xd + 78)
                    header_y = top
                    break
            if xw is None:
                xw, xd, xb = 435, 513, 591
            cur = None

            def flush(cur):
                if cur and cur["balance"] is not None:
                    amt, wd = cur.pop("deposit"), cur.pop("withdrawal")
                    cur["amount"] = amt if amt is not None else (-wd if wd is not None else 0.0)
                    cur["desc"] = cur.pop("mid").strip()
                    txns.append(cur)

            for top, ws in rows:
                if top <= header_y:
                    continue
                texts = [w["text"] for w in ws]
                if not texts:
                    continue
                if _HDFC_DATE.match(texts[0]):
                    flush(cur)
                    nums = [w for w in ws if _HDFC_AMT.match(w["text"])]
                    withdrawal = deposit = balance = None
                    for w in nums:
                        cx = (w["x0"] + w["x1"]) / 2
                        v = _num(w["text"])
                        dw, dd, db = abs(cx - xw), abs(cx - xd), abs(cx - xb)
                        if db <= min(dw, dd):
                            balance = v
                        elif dw <= dd:
                            withdrawal = v
                        else:
                            deposit = v
                    narr = [w["text"] for w in ws[1:]
                            if not _HDFC_AMT.match(w["text"]) and not re.fullmatch(r"[\d/]{6,}", w["text"])
                            and (w["x0"] + w["x1"]) / 2 < 340]
                    cur = {"date": datetime.datetime.strptime(texts[0], "%d/%m/%y").date(),
                           "mid": " ".join(narr), "withdrawal": withdrawal, "deposit": deposit,
                           "balance": balance, "cheque": None}
                elif BOUNDARY.search("".join(texts)):
                    flush(cur)
                    cur = None
                elif cur is not None and all(not _HDFC_AMT.match(t) for t in texts) and ws[0]["x0"] < 340:
                    cur["mid"] += "".join(texts)   # continuation joins with no space
            flush(cur)
    meta["transactions"] = txns
    return meta


# --------------------------------------------------------------- GENERIC (any bank)
_DATE_FORMATS = [
    (re.compile(r"^\d{2}/\d{2}/\d{4}$"), "%d/%m/%Y"),
    (re.compile(r"^\d{2}-\d{2}-\d{4}$"), "%d-%m-%Y"),
    (re.compile(r"^\d{2}-[A-Za-z]{3}-\d{4}$"), "%d-%b-%Y"),
    (re.compile(r"^\d{2}/[A-Za-z]{3}/\d{4}$"), "%d/%b/%Y"),
    (re.compile(r"^\d{4}-\d{2}-\d{2}$"), "%Y-%m-%d"),
    (re.compile(r"^\d{2}/\d{2}/\d{2}$"), "%d/%m/%y"),
    (re.compile(r"^\d{2}-\d{2}-\d{2}$"), "%d-%m-%y"),
    (re.compile(r"^\d{2}-[A-Za-z]{3}-\d{2}$"), "%d-%b-%y"),
    (re.compile(r"^\d{2}[A-Za-z]{3}\d{4}$"), "%d%b%Y"),
    (re.compile(r"^\d{2}[A-Za-z]{3}\d{2}$"), "%d%b%y"),
]
_ROLE_KEYWORDS = {
    "date": ["txndate", "transactiondate", "trandate", "postingdate", "date"],
    "desc": ["description", "narration", "particulars", "remarks", "transactiondetails",
             "details", "transaction"],
    "cheque": ["cheque", "chqno", "chq", "refno", "reference", "instrument"],
    "debit": ["withdrawal", "withdrawalamt", "debit", "paidout", "dr"],
    "credit": ["deposit", "depositamt", "credit", "paidin", "cr"],
    "amount": ["amount"],
    "balance": ["closingbalance", "runningbalance", "availablebalance", "balance"],
}


def _amt_token(t):
    """Parse a money token -> (value, 'Cr'|'Dr'|None) or None. Handles
    1,23,456.78 · 10,000.00 · 8768.80 · 1060.00(Cr) · 1.00- (trailing minus)."""
    t = t.strip()
    drcr = None
    m = re.search(r"\((Cr|Dr|CR|DR)\)$", t)
    if m:
        drcr = m.group(1).title()
        t = t[:m.start()].strip()
    if t.endswith("-"):
        t = t[:-1].strip()
        drcr = drcr or "Dr"
    t = t.lstrip("+")
    if not re.fullmatch(r"-?[\d,]+\.\d{1,2}", t):
        return None
    return (abs(float(t.replace(",", ""))), drcr)


def _detect_date(tok):
    for rx, fmt in _DATE_FORMATS:
        if rx.match(tok):
            try:
                return datetime.datetime.strptime(tok, fmt).date()
            except ValueError:
                pass
    return None


_IFSC_BANK = {
    "SBIN": "State Bank of India", "HDFC": "HDFC Bank", "ICIC": "ICICI Bank",
    "UTIB": "Axis Bank", "KKBK": "Kotak Mahindra Bank", "UBIN": "Union Bank of India",
    "CIUB": "City Union Bank", "CNRB": "Canara Bank", "BARB": "Bank of Baroda",
    "PUNB": "Punjab National Bank", "IOBA": "Indian Overseas Bank", "YESB": "Yes Bank",
    "RATN": "RBL Bank", "IDIB": "Indian Bank", "MAHB": "Bank of Maharashtra",
    "TMBL": "Tamilnad Mercantile Bank", "KVBL": "Karur Vysya Bank", "FDRL": "Federal Bank",
    "INDB": "IndusInd Bank", "IBKL": "IDBI Bank", "BKID": "Bank of India",
    "CBIN": "Central Bank of India", "UCBA": "UCO Bank", "PSIB": "Punjab & Sind Bank",
    "SCBL": "Standard Chartered Bank", "DBSS": "DBS Bank", "ESFB": "Equitas Small Finance Bank",
    "AUBL": "AU Small Finance Bank", "IDFB": "IDFC First Bank", "BANDHN": "Bandhan Bank",
}


def parse_generic(pdf):
    meta = {"bank": "Unknown Bank", "institution": "Unknown Bank, India",
            "mobile": None, "email": None, "pan": None, "account_type": None,
            "ifsc": None, "period": None, "name": None, "address": None,
            "account_no": None, "account_name": None}
    with _open(pdf) as doc:
        first = doc.pages[0].extract_text() or ""
        # best-effort metadata — the account's OWN IFSC (labelled), never a counterparty's
        m = re.search(r"(?:RTGS/NEFT\s*)?IFSC\s*(?:Code)?\s*[:\-]?\s*([A-Z]{4}0[A-Z0-9]{6})", first)
        if m:
            meta["ifsc"] = m.group(1)
        m = re.search(r"(?:Account\s*(?:No|Number)|A/?c\s*(?:No|Number)?)\s*[:\-]?\s*(\d{6,})", first, re.I)
        if m:
            meta["account_no"] = m.group(1)
        # bank name: prefer the reliable IFSC-prefix mapping, else a labelled bank line
        if meta["ifsc"] and meta["ifsc"][:4] in _IFSC_BANK:
            meta["bank"] = _IFSC_BANK[meta["ifsc"][:4]]
        else:
            m = re.search(r"^([A-Z][A-Za-z&. ]+?BANK(?:\s+(?:LTD|LIMITED))?)\b", first, re.M)
            if m:
                meta["bank"] = re.sub(r"\s+", " ", m.group(1).title()).strip()
        meta["institution"] = f"{meta['bank']}, India"
        m = re.search(r"(?:From|Period)\s*[:\-]?\s*(\d{2}[/-][A-Za-z0-9]{2,3}[/-]\d{2,4})\s*(?:To|to|-)\s*(\d{2}[/-][A-Za-z0-9]{2,3}[/-]\d{2,4})", first)
        if m:
            d1, d2 = _detect_date(m.group(1)), _detect_date(m.group(2))
            if d1 and d2:
                meta["period"] = (d1, d2)

        txns = []
        opening = None
        anchors = money_anchors = None    # persist across pages (headers often print once)
        for page in doc.pages:
            rows = _rows_from_words(page)
            # ---- locate the transaction-table header on this page
            page_anchors, header_y, best_score = None, -1.0, 0
            for top, ws in rows:
                found = {}
                for w in ws:
                    t = re.sub(r"[^a-z]", "", w["text"].lower())
                    if not t:
                        continue
                    cx = (w["x0"] + w["x1"]) / 2
                    for role, kws in _ROLE_KEYWORDS.items():
                        if role in found:
                            continue
                        if any(t == kw or (len(kw) >= 5 and kw in t) for kw in kws):
                            found[role] = cx
                score = len(found)
                has_money = any(r in found for r in ("balance", "amount", "debit", "credit"))
                if score > best_score and has_money and ("date" in found or "desc" in found):
                    page_anchors, header_y, best_score = found, top, score
            if page_anchors is not None:
                anchors = page_anchors
                money_anchors = {r: x for r, x in anchors.items()
                                 if r in ("debit", "credit", "amount", "balance")}
            elif anchors is None:
                continue          # no header seen yet on any page
            else:
                header_y = -1.0   # reuse prior page's columns; process all data rows

            cur = None

            def flush(cur):
                if cur and cur["balance"] is not None:
                    txns.append(cur)

            for top, ws in rows:
                if top <= header_y:
                    continue
                texts = [w["text"] for w in ws]
                if not texts:
                    continue
                line = " ".join(texts)
                # opening-balance carry
                if re.search(r"opening balance|balance b/?f|brought forward", line, re.I):
                    ob = next((_amt_token(w["text"]) for w in reversed(ws) if _amt_token(w["text"])), None)
                    if ob:
                        opening = ob[0]
                    flush(cur); cur = None
                    continue
                if re.search(r"closing balance|carried forward|c/?f\b|grand total|page \d|"
                             r"statement of|generated on|total\s|www\.|customer id|"
                             r"\*\*|end of statement", line, re.I):
                    flush(cur); cur = None
                    continue
                date = _detect_date(texts[0]) or (_detect_date(texts[1]) if len(texts) > 1 else None)
                monies = [(w, _amt_token(w["text"])) for w in ws if _amt_token(w["text"])]
                if date and monies:
                    flush(cur)
                    debit = credit = amount = balance = None
                    bal_drcr = None
                    for w, (v, drcr) in monies:
                        cx = (w["x0"] + w["x1"]) / 2
                        role = min(money_anchors, key=lambda r: abs(money_anchors[r] - cx)) if money_anchors else "balance"
                        if role == "balance":
                            balance, bal_drcr = v, drcr
                        elif role == "debit":
                            debit = v
                        elif role == "credit":
                            credit = v
                        else:
                            amount = (v, drcr)
                    # description = words not date/amount, left of the money zone
                    money_x = min(money_anchors.values()) if money_anchors else 9e9
                    desc_words = [w["text"] for w in ws
                                  if not _amt_token(w["text"]) and _detect_date(w["text"]) is None
                                  and not re.fullmatch(r"[\d/]{6,}", w["text"])
                                  and (w["x0"] + w["x1"]) / 2 < money_x - 5]
                    cur = {"date": date, "desc_frags": [" ".join(desc_words)],
                           "debit": debit, "credit": credit, "amount": amount,
                           "balance": balance, "bal_drcr": bal_drcr, "cheque": None}
                elif cur is not None and not monies:
                    # continuation narration
                    money_x = min(money_anchors.values()) if money_anchors else 9e9
                    cw = [w["text"] for w in ws if (w["x0"] + w["x1"]) / 2 < money_x - 5]
                    if cw:
                        cur["desc_frags"].append(" ".join(cw))
            flush(cur)

    # ---- resolve signs (column split -> Cr/Dr hint -> balance continuity)
    out = []
    prev_bal = opening
    for t in txns:
        desc = _join_frag(t["desc_frags"])
        bal = t["balance"]
        if t["debit"] is not None and t["credit"] is None:
            mag, sign = t["debit"], -1
        elif t["credit"] is not None and t["debit"] is None:
            mag, sign = t["credit"], 1
        elif t["amount"] is not None:
            mag, drcr = t["amount"]
            sign = -1 if drcr == "Dr" else 1 if drcr == "Cr" else None
        elif t["debit"] is not None and t["credit"] is not None:
            mag, sign = (t["debit"], -1) if t["debit"] else (t["credit"], 1)
        else:
            mag, sign = 0.0, 1
        # correct/derive sign from balance continuity when possible
        if bal is not None and mag and prev_bal is not None:
            if abs(prev_bal + mag - bal) < 0.02:
                sign = 1
            elif abs(prev_bal - mag - bal) < 0.02:
                sign = -1
        if sign is None:
            sign = -1 if re.search(r"/DR/|withdraw|debit|\bDR\b", desc, re.I) else 1
        out.append({"date": t["date"], "desc": desc or '""', "amount": round(sign * mag, 2),
                    "balance": bal, "cheque": None})
        prev_bal = bal
    meta["transactions"] = out
    return meta


# --------------------------------------------------------------- dispatcher
def parse_statement(pdf, password=None, workdir=None):
    """Parse a statement from a filesystem path OR raw PDF bytes.

    Fully in-memory: decryption and text extraction never write to disk, so no
    plaintext copy of a statement is ever left in a temp directory. The
    `workdir` kwarg is accepted for backwards compatibility and ignored."""
    import os
    if isinstance(pdf, (bytes, bytearray)):
        data = bytes(pdf)
        src_name = None
    else:
        with open(pdf, "rb") as fh:
            data = fh.read()
        src_name = os.path.basename(pdf)
    dec, protected = decrypt_bytes(data, password)
    with _open(dec) as doc:
        first = doc.pages[0].extract_text() or ""
        # scanned / image-only PDF: no usable text layer anywhere -> exclude cleanly
        # (these need OCR, which BankIQ does not do — skip rather than error out)
        sampled = 0
        for pg in doc.pages[:8]:
            sampled += len((pg.extract_text() or "").strip())
            _flush(pg)
            if sampled > 60:
                break
        if sampled <= 60:
            raise ValueError("Image PDF: this looks like a scanned or image-only statement "
                             "(no selectable text). BankIQ needs a text (native) PDF — skipped.")
    up = first.upper()
    # detect by the account's OWN distinctive markers — never by a counterparty
    # IFSC/VPA that can appear inside any bank's narration
    if "CITY UNION" in up:
        meta = parse_cub(dec)
    elif "CANARA BANK" in up or re.search(r"IFSC\s*:?\s*CNRB", first):
        # check Canara before SBI: Canara headers carry a "WhatsApp Banking Num"
        # line that must not be mistaken for an SBI marker
        meta = parse_canara(dec)
    elif ("State Bank of India" in first or "@sbi.co.in" in first
          or re.search(r"IFSC\s*(?:Code)?\s*:?\s*SBIN", first)):
        # two SBI layouts: the WhatsApp/YONO "Statement of X (A/c-…)" one, and the
        # net-banking "STATEMENT OF ACCOUNT" export (WDL/DEP TFR rows, '-' placeholders)
        if re.search(r"Statement of .+ \(A/c-", first):
            meta = parse_sbi(dec)
        else:
            meta = parse_sbi_soa(dec)
    elif ("Chq./Ref.No." in first and "ClosingBalance" in first) or \
            re.search(r"(RTGS/NEFT\s*IFSC|IFSC)\s*:?\s*HDFC", first):
        meta = parse_hdfc(dec)
    elif "Customer/CIF ID" in first or re.search(r"IFSC\s+UBIN", first):
        meta = parse_union_bank(dec)
    elif re.search(r"IFSC\s*Code\s*:?\s*IDIB", first) and "Post Date" in first and "Value Date" in first:
        meta = parse_indian_soa(dec)          # Indian Bank net-banking "Statement of Account"
    else:
        # any other bank -> generic column-detection parser
        meta = parse_generic(dec)
    # if a bank-specific parser came up empty (format variant), retry generic
    if not meta["transactions"]:
        g = parse_generic(dec)
        if g["transactions"]:
            meta = g
    if not meta["transactions"]:
        raise ValueError("no transactions could be extracted — the statement has "
                         "no recognisable transaction table (scanned/image PDF, or "
                         "an unsupported layout)")
    meta["password_protected"] = "Yes" if protected else "No"
    # basename only (or None for in-memory uploads) — never an absolute path
    meta["source_file"] = src_name
    verify_balances(meta["transactions"])
    return meta


def verify_balances(txns):
    """Sanity: running balance must equal prev balance + amount (>=99% of rows)."""
    bad = 0
    for a, b in zip(txns, txns[1:]):
        if a["balance"] is not None and b["balance"] is not None and b["amount"] is not None:
            if abs(a["balance"] + b["amount"] - b["balance"]) > 0.01:
                bad += 1
    if txns and bad > max(2, len(txns) * 0.01):
        raise ValueError(f"balance chain broken for {bad}/{len(txns)} rows — parser problem")
    return bad
