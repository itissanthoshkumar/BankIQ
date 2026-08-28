#!/usr/bin/env bash
# Start the PrayaanBSA web app (upload → analyze → view → download).
# Then open http://127.0.0.1:8760 in a browser.
cd "$(dirname "$0")" || exit 1
exec python3 -m uvicorn --app-dir "$(pwd)" webapp.server:app --port 8760 --host 127.0.0.1 "$@"
