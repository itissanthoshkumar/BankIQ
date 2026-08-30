"""BankIQ web app — upload a bank-statement PDF, process it through the
BankIQ engine, view results (summary / insights / analysis / transactions /
flags) and download the XLSX/JSON. FSD §6.13 (M12 core, Phase P1).

ZERO-STORAGE BY DESIGN: nothing is ever written to disk. Statements are
processed entirely in memory; results (payload + workbook bytes) live only in
the in-process STATEMENTS dict, auto-expire after RETENTION_MINUTES, and
vanish on restart. Requires a single worker (--workers 1).

Run:  uvicorn webapp.server:app --reload --port 8760   (from the banking-iq dir)
"""
import datetime
import io
import json
import logging
import os
import sys
import threading
import time
import traceback
import uuid

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from bankiq.parse import parse_statement          # noqa: E402
from bankiq.categorize import categorize_all       # noqa: E402
from bankiq.analyze import build_report            # noqa: E402
from bankiq.render import render                    # noqa: E402
from webapp.export import build_payload             # noqa: E402
from webapp.extra_sheets import add_extra_sheets    # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.join(HERE, "static")
SPA = os.path.join(HERE, "spa")            # built React app (vite build output)

# ── zero-storage configuration ───────────────────────────────────────────────
RETENTION_MINUTES = int(os.environ.get("RETENTION_MINUTES", "60"))
MAX_STATEMENTS = int(os.environ.get("MAX_STATEMENTS", "25"))
MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "30"))
PDF_HOLD_MAX = 5          # max records allowed to pin raw PDF bytes (NEEDS_PASSWORD)
STALE_PARSING_S = 1200    # PARSING with no result for 20 min → the worker died
DEBUG = bool(os.environ.get("DEBUG"))

TERMINAL = ("READY", "FAILED", "UNSUPPORTED", "IMAGE_SKIPPED", "EXTRACTION_SUSPECT")
PENDING = ("PARSING", "ANALYZING", "QUEUED")
XLSX_MT = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

app = FastAPI(title="BankIQ", version="2.0")


@app.middleware("http")
async def _security(request, call_next):
    resp = await call_next(request)
    path = request.url.path
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Referrer-Policy"] = "no-referrer"
    if path.startswith("/api"):
        # statement data must never land in a browser or proxy cache
        resp.headers["Cache-Control"] = "no-store"
    elif path == "/" or path.startswith(("/static", "/assets", "/logo")):
        resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        if path == "/":
            resp.headers["Content-Security-Policy"] = (
                "default-src 'self'; script-src 'self'; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "font-src https://fonts.gstatic.com; img-src 'self' data:; "
                "connect-src 'self'; object-src 'none'; frame-ancestors 'none'; "
                "base-uri 'self'; form-action 'self'")
    return resp


# In-memory store — the ONLY place statement data lives. Light keys are safe to
# serialise (list rows / _record); heavy keys hold the actual data:
#   payload (dict)  — the full analysis, served as result.json and to the viewer
#   xlsx (bytes)    — the rendered workbook
#   pdf (bytes)     — the raw upload, kept ONLY while status is NEEDS_PASSWORD
STATEMENTS = {}
_LIGHT_KEYS = ("id", "filename", "uploaded_at", "status", "name",
               "bank", "period", "grade", "reason", "expires_at")


def _light(rec):
    return {k: rec.get(k) for k in _LIGHT_KEYS}


# ── logging → stdout (visible in the hosting platform's log stream) ──────────
# Deliberately PII-free: statement ids, sizes, timings and counts only — never
# the holder's name, the upload filename, or raw exception/narration text.
log = logging.getLogger("bankiq")
if not log.handlers:
    _h = logging.StreamHandler(sys.stdout)
    _h.setFormatter(logging.Formatter("%(asctime)s [bankiq] %(message)s", "%H:%M:%S"))
    log.addHandler(_h)
    log.setLevel(logging.INFO)
    log.propagate = False


def _mem_mb():
    """Resident memory in MB — Linux /proc (current RSS), else peak RSS."""
    try:
        with open("/proc/self/status") as fh:
            for line in fh:
                if line.startswith("VmRSS:"):
                    return int(line.split()[1]) / 1024.0
    except Exception:
        pass
    try:
        import resource
        rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        # ru_maxrss is bytes on macOS/BSD, kilobytes on Linux
        return rss / (1048576.0 if sys.platform == "darwin" else 1024.0)
    except Exception:
        return -1.0


def _sweep():
    """Enforce the retention promise: drop expired records, and fail PARSING
    records whose worker evidently died (no result after STALE_PARSING_S)."""
    now = time.time()
    for sid, rec in list(STATEMENTS.items()):
        if rec.get("expires_at") and now > rec["expires_at"]:
            STATEMENTS.pop(sid, None)
            log.info("%s == expired (retention %dm) — purged from memory", sid[:6], RETENTION_MINUTES)
            continue
        if rec.get("status") in PENDING:
            try:
                age = (datetime.datetime.now()
                       - datetime.datetime.fromisoformat(rec["uploaded_at"])).total_seconds()
            except Exception:
                age = 0.0
            if age > STALE_PARSING_S:
                rec.pop("pdf", None)
                rec.update(status="FAILED", reason="Processing did not complete — the worker may "
                           "have restarted or run out of memory. Try re-uploading.")


def _process(pdf_bytes, password, extras, tag=""):
    """Run the full pipeline in memory; return (payload, xlsx_bytes) or raise.
    Logs every stage with elapsed time + resident memory."""

    def start(msg):
        log.info("%s   -> %s ...", tag, msg)

    def done(msg, t0):
        log.info("%s   ok %s (%.1fs, rss %.0fMB)", tag, msg, time.time() - t0, _mem_mb())

    start("parse PDF")
    t = time.time()
    meta = parse_statement(pdf_bytes, password)
    n = len(meta.get("transactions") or [])
    log.info("%s   ok parsed: %s / %d txns (%.1fs, rss %.0fMB)", tag,
             meta.get("bank"), n, time.time() - t, _mem_mb())

    start("categorise transactions")
    t = time.time(); categorize_all(meta); done("categorised", t)

    start("analyse (build_report)")
    t = time.time(); rep = build_report(meta); done("analysed", t)

    start("build UI payload")
    t = time.time(); payload = build_payload(meta, rep); payload["extras"] = extras
    done("payload built", t)

    start("render workbook (in memory)")
    t = time.time()
    wb = render(rep)                 # returns the live Workbook — nothing on disk
    add_extra_sheets(wb, meta, rep)  # mutates in place
    buf = io.BytesIO()
    wb.save(buf)
    done("workbook rendered", t)

    return payload, buf.getvalue()


@app.get("/", response_class=HTMLResponse)
def index():
    # serve the built React SPA (falls back to the legacy static app if unbuilt)
    idx = os.path.join(SPA, "index.html")
    if not os.path.exists(idx):
        idx = os.path.join(STATIC, "index.html")
    with open(idx) as fh:
        return fh.read()


@app.get("/logo.svg")
def logo():
    for base in (SPA, STATIC):
        p = os.path.join(base, "logo.svg")
        if os.path.exists(p):
            return FileResponse(p, media_type="image/svg+xml")
    raise HTTPException(404, "no logo")


@app.get("/api/meta")
def meta():
    return {"retention_minutes": RETENTION_MINUTES, "storage": "memory"}


@app.get("/api/statements")
def list_statements():
    _sweep()
    return sorted([_light(r) for r in STATEMENTS.values()],
                  key=lambda r: r["uploaded_at"], reverse=True)


@app.post("/api/upload")
async def upload(
    file: UploadFile = File(...),
    password: str = Form(""),
    applicant_name: str = Form(""),
    reference_id: str = Form(""),
    proposed_emi: str = Form(""),
    product: str = Form(""),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are accepted.")
    data = await file.read()
    if len(data) > MAX_UPLOAD_MB * 1048576:
        raise HTTPException(413, f"PDF larger than {MAX_UPLOAD_MB} MB.")
    _sweep()
    if len(STATEMENTS) >= MAX_STATEMENTS:
        # evict the oldest finished record; never evict work in flight
        finished = sorted((r for r in STATEMENTS.values() if r.get("status") in TERMINAL),
                          key=lambda r: r["uploaded_at"])
        if finished:
            STATEMENTS.pop(finished[0]["id"], None)
        else:
            raise HTTPException(429, "At capacity — delete a statement or retry shortly.")
    sid = uuid.uuid4().hex[:12]
    log.info("%s == UPLOAD %.1fMB pw=%s", sid[:6], len(data) / 1048576,
             "yes" if password else "no")

    rec = {
        "id": sid, "filename": file.filename,
        "uploaded_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "expires_at": time.time() + RETENTION_MINUTES * 60,
        "status": "PARSING", "name": None, "bank": None, "period": None,
        "grade": None, "reason": None,
    }
    STATEMENTS[sid] = rec

    extras = {"applicant_name": applicant_name or None, "reference_id": reference_id or None,
              "proposed_emi": proposed_emi or None, "product": product or None}
    # Process in a background thread and return immediately (large statements
    # would exceed the hosting proxy's request timeout). The frontend polls the
    # list until PARSING flips to a terminal status.
    threading.Thread(target=_run_processing, args=(sid, data, password or None, extras),
                     daemon=True).start()
    return _light(rec)


def _finish_ok(rec, payload, xlsx_bytes):
    s = payload["summary"]
    rec.pop("pdf", None)
    rec.update(status="READY", name=s["name"], bank=s["bank"],
               period=f"{s['period_start']} → {s['period_end']}",
               grade=payload["grade"]["grade"], reason=None,
               payload=payload, xlsx=xlsx_bytes)


def _run_processing(sid, data, password, extras):
    """Parse -> categorise -> analyse -> render, off the request thread; RAM only."""
    tag = sid[:6]
    rec = STATEMENTS.get(sid)
    if not rec:
        return
    t0 = time.time()
    log.info("%s == processing started (rss %.0fMB)", tag, _mem_mb())
    try:
        payload, xlsx_bytes = _process(data, password, extras, tag=tag)
        _finish_ok(rec, payload, xlsx_bytes)
        log.info("%s == DONE -> READY in %.1fs (rss %.0fMB)", tag, time.time() - t0, _mem_mb())
    except ValueError as e:
        msg = str(e)
        if "password" in msg.lower():
            # keep the raw bytes ONLY for the password retry; bounded pin
            holders = [r for r in STATEMENTS.values() if r.get("pdf") is not None]
            if len(holders) >= PDF_HOLD_MAX:
                oldest = min(holders, key=lambda r: r["uploaded_at"])
                oldest.pop("pdf", None)
                oldest.update(status="FAILED", reason="Expired while awaiting a password — please re-upload.")
            rec["pdf"] = data
            rec.update(status="NEEDS_PASSWORD", reason=msg)
        elif msg.startswith("Image PDF"):
            rec.update(status="IMAGE_SKIPPED", reason=msg)
        elif "layout" in msg.lower():
            rec.update(status="UNSUPPORTED", reason=msg)
        elif "balance chain" in msg.lower():
            rec.update(status="EXTRACTION_SUSPECT", reason=msg)
        else:
            rec.update(status="FAILED", reason=msg)
        log.info("%s == %s in %.1fs", tag, rec["status"], time.time() - t0)
    except Exception as e:
        # log the exception TYPE only — raw text can embed statement narration
        rec.update(status="FAILED", reason=f"{type(e).__name__} while processing — try re-uploading.")
        log.error("%s == FAILED in %.1fs: %s", tag, time.time() - t0, type(e).__name__)
        if DEBUG:
            traceback.print_exc()


@app.post("/api/statements/{sid}/password")
def retry_password(sid: str, password: str = Form(...)):
    _sweep()
    rec = STATEMENTS.get(sid)
    if not rec:
        raise HTTPException(404, "not found")
    data = rec.get("pdf")
    if data is None:
        raise HTTPException(410, "The original PDF is no longer in memory (expired or the "
                                 "server restarted) — please re-upload it.")
    try:
        payload, xlsx_bytes = _process(data, password, {}, tag=sid[:6])
        _finish_ok(rec, payload, xlsx_bytes)
    except ValueError as e:
        rec.update(status="NEEDS_PASSWORD", reason=str(e))
    return _light(rec)


@app.get("/api/statements/{sid}")
def get_statement(sid: str):
    _sweep()
    rec = STATEMENTS.get(sid)
    if not rec:
        raise HTTPException(404, "not found")
    if rec.get("payload") is None:
        return JSONResponse({"status": rec["status"], "reason": rec.get("reason")}, status_code=409)
    return dict(rec["payload"], _record=_light(rec))


@app.get("/api/statements/{sid}/report.xlsx")
def download_xlsx(sid: str):
    _sweep()
    rec = STATEMENTS.get(sid)
    if not rec or rec.get("xlsx") is None:
        raise HTTPException(404, "not ready")
    name = (rec.get("name") or "report").replace(" ", "_")
    return Response(rec["xlsx"], media_type=XLSX_MT,
                    headers={"Content-Disposition": f'attachment; filename="{name}_BSA.xlsx"'})


@app.get("/api/statements/{sid}/result.json")
def download_json(sid: str):
    _sweep()
    rec = STATEMENTS.get(sid)
    if not rec or rec.get("payload") is None:
        raise HTTPException(404, "not ready")
    return Response(json.dumps(rec["payload"]), media_type="application/json",
                    headers={"Content-Disposition": 'attachment; filename="result.json"'})


@app.post("/api/statements/{sid}/extend")
def extend_statement(sid: str):
    """Reset the retention timer: keep this statement for RETENTION_MINUTES more."""
    _sweep()
    rec = STATEMENTS.get(sid)
    if not rec:
        raise HTTPException(404, "not found")
    rec["expires_at"] = time.time() + RETENTION_MINUTES * 60
    log.info("%s == retention extended (+%dm)", sid[:6], RETENTION_MINUTES)
    return _light(rec)


@app.delete("/api/statements/{sid}")
def delete_statement(sid: str):
    STATEMENTS.pop(sid, None)
    return {"deleted": sid}


app.mount("/static", StaticFiles(directory=STATIC), name="static")
if os.path.isdir(os.path.join(SPA, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(SPA, "assets")), name="spa-assets")

log.info("BankIQ server ready — zero-storage (RAM only, retention %dm, cap %d), SPA=%s, rss %.0fMB",
         RETENTION_MINUTES, MAX_STATEMENTS,
         os.path.exists(os.path.join(SPA, "index.html")), _mem_mb())
