"""BankIQ web app — upload a bank-statement PDF, process it through the
BankIQ engine, view results (summary / insights / analysis / transactions /
flags) and download the XLSX/JSON. FSD §6.13 (M12 core, Phase P1).

Run:  uvicorn webapp.server:app --reload --port 8760   (from the banking-iq dir)
"""
import datetime
import json
import os
import shutil
import sys
import tempfile
import traceback
import uuid

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
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
DATA = os.path.join(HERE, "data")
os.makedirs(DATA, exist_ok=True)

app = FastAPI(title="BankIQ", version="1.0")


@app.middleware("http")
async def _no_cache_assets(request, call_next):
    # internal tool — always serve fresh HTML/CSS/JS so edits show without a hard refresh
    resp = await call_next(request)
    if request.url.path == "/" or request.url.path.startswith(("/static", "/assets", "/logo")):
        resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return resp

# in-memory index; each record also persisted under DATA/<id>/
STATEMENTS = {}


def _index_path():
    return os.path.join(DATA, "index.json")


def _load_index():
    if os.path.exists(_index_path()):
        try:
            with open(_index_path()) as fh:
                for rec in json.load(fh):
                    STATEMENTS[rec["id"]] = rec
        except Exception:
            pass


def _save_index():
    recs = sorted(STATEMENTS.values(), key=lambda r: r["uploaded_at"], reverse=True)
    with open(_index_path(), "w") as fh:
        json.dump(recs, fh, indent=2)


_load_index()


def _process(pdf_path, password, extras):
    """Run the full pipeline; return (payload, xlsx_path) or raise."""
    workdir = tempfile.mkdtemp(prefix="bankiq_")
    meta = parse_statement(pdf_path, password, workdir)
    categorize_all(meta)
    rep = build_report(meta)
    payload = build_payload(meta, rep)
    payload["extras"] = extras
    xlsx = os.path.join(workdir, "report.xlsx")
    render(rep, xlsx)
    add_extra_sheets(xlsx, meta, rep)
    return payload, xlsx


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


@app.get("/api/statements")
def list_statements():
    return sorted(
        [{k: r[k] for k in ("id", "filename", "uploaded_at", "status", "name",
                            "bank", "period", "grade", "reason")}
         for r in STATEMENTS.values()],
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
    sid = uuid.uuid4().hex[:12]
    sdir = os.path.join(DATA, sid)
    os.makedirs(sdir, exist_ok=True)
    pdf_path = os.path.join(sdir, "source.pdf")
    with open(pdf_path, "wb") as fh:
        shutil.copyfileobj(file.file, fh)

    rec = {
        "id": sid, "filename": file.filename,
        "uploaded_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "status": "PARSING", "name": None, "bank": None, "period": None,
        "grade": None, "reason": None,
    }
    STATEMENTS[sid] = rec

    extras = {"applicant_name": applicant_name or None, "reference_id": reference_id or None,
              "proposed_emi": proposed_emi or None, "product": product or None}
    try:
        payload, xlsx = _process(pdf_path, password or None, extras)
        with open(os.path.join(sdir, "result.json"), "w") as fh:
            json.dump(payload, fh)
        shutil.copy(xlsx, os.path.join(sdir, "report.xlsx"))
        s = payload["summary"]
        rec.update(status="READY", name=s["name"], bank=s["bank"],
                   period=f"{s['period_start']} → {s['period_end']}",
                   grade=payload["grade"]["grade"], reason=None)
    except ValueError as e:
        msg = str(e)
        if "password" in msg.lower():
            rec.update(status="NEEDS_PASSWORD", reason=msg)
        elif msg.startswith("Image PDF"):
            rec.update(status="IMAGE_SKIPPED", reason=msg)
        elif "layout" in msg.lower():
            rec.update(status="UNSUPPORTED", reason=msg)
        elif "balance chain" in msg.lower():
            rec.update(status="EXTRACTION_SUSPECT", reason=msg)
        else:
            rec.update(status="FAILED", reason=msg)
    except Exception as e:
        rec.update(status="FAILED", reason=f"{type(e).__name__}: {e}")
        traceback.print_exc()
    _save_index()
    return rec


@app.post("/api/statements/{sid}/password")
def retry_password(sid: str, password: str = Form(...)):
    rec = STATEMENTS.get(sid)
    if not rec:
        raise HTTPException(404, "not found")
    sdir = os.path.join(DATA, sid)
    pdf_path = os.path.join(sdir, "source.pdf")
    try:
        payload, xlsx = _process(pdf_path, password, {})
        with open(os.path.join(sdir, "result.json"), "w") as fh:
            json.dump(payload, fh)
        shutil.copy(xlsx, os.path.join(sdir, "report.xlsx"))
        s = payload["summary"]
        rec.update(status="READY", name=s["name"], bank=s["bank"],
                   period=f"{s['period_start']} → {s['period_end']}",
                   grade=payload["grade"]["grade"], reason=None)
    except ValueError as e:
        rec.update(status="NEEDS_PASSWORD", reason=str(e))
    _save_index()
    return rec


@app.get("/api/statements/{sid}")
def get_statement(sid: str):
    sdir = os.path.join(DATA, sid)
    p = os.path.join(sdir, "result.json")
    if not os.path.exists(p):
        rec = STATEMENTS.get(sid)
        if rec:
            return JSONResponse({"status": rec["status"], "reason": rec.get("reason")}, status_code=409)
        raise HTTPException(404, "not found")
    with open(p) as fh:
        payload = json.load(fh)
    payload["_record"] = STATEMENTS.get(sid)
    return payload


@app.get("/api/statements/{sid}/report.xlsx")
def download_xlsx(sid: str):
    p = os.path.join(DATA, sid, "report.xlsx")
    if not os.path.exists(p):
        raise HTTPException(404, "not ready")
    rec = STATEMENTS.get(sid, {})
    name = (rec.get("name") or "report").replace(" ", "_")
    return FileResponse(p, filename=f"{name}_BSA.xlsx",
                        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


@app.get("/api/statements/{sid}/result.json")
def download_json(sid: str):
    p = os.path.join(DATA, sid, "result.json")
    if not os.path.exists(p):
        raise HTTPException(404, "not ready")
    return FileResponse(p, filename="result.json", media_type="application/json")


@app.delete("/api/statements/{sid}")
def delete_statement(sid: str):
    STATEMENTS.pop(sid, None)
    shutil.rmtree(os.path.join(DATA, sid), ignore_errors=True)
    _save_index()
    return {"deleted": sid}


app.mount("/static", StaticFiles(directory=STATIC), name="static")
if os.path.isdir(os.path.join(SPA, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(SPA, "assets")), name="spa-assets")
