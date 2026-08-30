# BankIQ — bank statement → analysis

Converts an Indian bank-statement PDF into the multi-tab Excel analysis format
(Perfios-style BSA report): Analysis, Derived Analysis, EOD Balance, Top-5
Parties, Transactions, UPI XNS, Recurring, High-value, FCU Indicators,
Round-tripping and Party Xns — plus a **web app** to upload, view and download.

## Web app (upload → analyze → view → download)

```bash
./run_webapp.sh          # or: python3 -m uvicorn --app-dir . webapp.server:app --port 8760
```

Open **http://127.0.0.1:8760**. Upload a statement PDF (drag-drop, optional
password + applicant name + reference/EMI), and view the result across eight
tabs — **Summary** (character grade, narrative, key indicators, cautions),
**Analysis** (monthwise grid), **Transactions** (filter by category/rail/
direction + search), **Insights** (end-of-day balance chart, credit/debit
category breakdown, lifestyle flags), **Cash & Rails**, **Parties** (ledger +
monthly Top-5), **Flags (FCU)** (F02 cash-cycle, F03 round-tripping,
lifestyle — each with transaction drill-down), **High Value** — then download
the XLSX or JSON.

First run needs `pip3 install fastapi uvicorn python-multipart` (see
`requirements.txt`). Data is stored under `webapp/data/<id>/`; passwords are
used in-memory only and never persisted.

**Scope vs. the FSD:** this implements the FSD's **M12 web-app core (§6.13,
Phase P1)** over the current engine, and surfaces the insights the engine
supports (obligations, rails incl. NACH/AEPS, cash-cycle & round-tripping FCU,
lifestyle/alcohol/gaming flags, a lightweight A–E grade). The FSD's deeper
engines — full four-shape obligation detection, the complete 20-rule FCU set,
the 5-factor character scorecard, auth/roles, and cell-for-cell 13-tab parity —
are the larger follow-on (Phases P0–P2). On the UBI golden fixture the engine
already hits the FSD targets: 985 txns, obligations ₹2,40,906.70, 27.8%
obligation-to-inflow, NACH count 6, AEPS 2, gaming ₹20 detected but correctly
INFO-only.

## CLI usage

```bash
python3 bankiq_run.py "<statement.pdf>" --password <PW> -o "<output.xlsx>"
```

- `--password` / `-p` only for protected PDFs (omit otherwise).
- `-o` optional; defaults to `<Account Holder>.xlsx` next to the PDF.

Example:

```bash
python3 bankiq_run.py "SBI Statement.pdf" -p 60382270773 -o "VINAYAGAM V.xlsx"
```

## Supported banks

Auto-detected from the statement:

| Bank | Layout |
|------|--------|
| Union Bank of India | `UPIAR/…/DR/…`, `Amount( ) Balance( )` with `(Cr)/(Dr)` |
| City Union Bank | `TO ONL / BY ONL`, Debit/Credit/Balance columns |
| State Bank of India | WhatsApp / e-statement, `Txn Date Value Date Description Debit Credit Balance` |

To add a bank: write a `parse_<bank>()` in `bankiq/parse.py` returning the
same dict shape and register it in `parse_statement()`.

## How it works

```
parse.py       PDF text/word extraction → normalized transactions (date, desc, ±amount, balance)
categorize.py  description → category (Transfer to/from <party>, Loan, Salary, Cash Deposit, …)
analyze.py     monthwise aggregates, EOD grid, Top-5, recurring, high-value, FCU triggers, round-tripping
render.py      writes the exact reference workbook (fonts, fills, formulas, hyperlinks, freeze panes)
```

Balances are self-checked: the running balance chain must reconcile
(`prev_balance + amount == balance`) or parsing aborts.

## Accuracy vs. the reference exports (3 sample statements)

| Area | Match | Notes |
|------|-------|-------|
| Transactions ledger | 99.4–99.9% | amounts/dates/balances byte-exact; residual = fuzzy party-name variants |
| Categorization | 96–99% | |
| Analysis / Derived / EOD Balance | 100% | |
| Top-5, High-value, Salary, Loan disb., Bounced | 96–100% | |
| Statements Considered | 96–100% | |
| Recurring / FCU triggers / Round-tripping / Party Xns | structural match; content approximate | these use Perfios's proprietary grouping, fuzzy name-merge and fraud-trigger algorithms — reproduced in spirit, not cell-for-cell |

Two known interpretation differences from the proprietary tool:

1. **Loan Transactions (Amount)** row uses the transparent sum of actual loan
   debits. The reference imputes recurring-EMI *obligations* even in months the
   debit is absent, so its figure runs higher.
2. **Party-name merging** (e.g. `MURUGANV`→`MURUGAN`, `BOOMINAT`→`NBOOMINA`) is
   done conservatively (initials + truncation variants); Perfios's fuzzy matcher
   merges more aggressively via UPI handles.

## Validate against the samples

```bash
python3 validate.py
```

Regenerates the three sample outputs and diffs every sheet against the
reference workbooks in `~/Downloads`.

## Security & privacy

BankIQ is **zero-storage by design** — it handles real bank statements, so
nothing is ever written to disk:

- The uploaded PDF is read into memory, decrypted in memory, parsed in memory;
  results (the analysis payload and the Excel workbook) live only in the
  server process's RAM.
- Every result **auto-deletes after `RETENTION_MINUTES`** (default 60) and is
  wiped instantly by any restart or redeploy. The trash button deletes on the
  spot. Password-locked PDFs are held in RAM only while a password retry is
  pending, then dropped.
- **Server logs contain no personal data** — only short random ids, sizes,
  timings and statuses. No filenames, holder names, or transaction text.
- All `/api/*` responses carry `Cache-Control: no-store`; the app also sets
  `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy:
  no-referrer` and a CSP on the page.
- Downloads (XLSX/JSON) are deliberate user actions — the downloaded file is
  the only copy that persists, on the user's own machine.
- The app must run with **one worker** (`--workers 1`): all state is in-process
  memory.

## Deploy on Render

The React SPA is pre-built and committed (`webapp/spa/`), so Render only needs
Python — no Node build step. A [`render.yaml`](render.yaml) blueprint is included.

**Blueprint (one-click):** Render Dashboard → **New +** → **Blueprint** → pick this
repo → **Apply**.

**Or configure a Web Service manually:**

| Setting | Value |
| --- | --- |
| Language | Python 3 |
| Build command | `pip install -r requirements.txt` |
| Start command | `python -m uvicorn webapp.server:app --host 0.0.0.0 --port $PORT --workers 1` |
| Plan | Free |

Notes: the app is zero-storage (see **Security & privacy**) — do **not** attach
a Disk; `--workers 1` is required. Python is pinned to 3.12 via
`.python-version`. `RETENTION_MINUTES` (env) tunes the auto-delete window.
