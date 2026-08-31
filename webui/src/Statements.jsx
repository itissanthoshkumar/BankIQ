import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, MagnifyingGlass, ArrowRight, Trash, Key } from "@phosphor-icons/react";
import { api, fmtDate, initials, avColor } from "./api";
import { Card, Skeleton, Empty, PrivacyBanner, ExpiryChip, ExpiryModal, useNow, leftMs, warnMs, stagger, rise, spring, haptic, tactile } from "./ui";

const statusTone = {
  READY: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PARSING: "bg-sky-50 text-sky-700 ring-sky-200",
  NEEDS_PASSWORD: "bg-amber-50 text-amber-700 ring-amber-200",
  EXTRACTION_SUSPECT: "bg-amber-50 text-amber-700 ring-amber-200",
  FAILED: "bg-rose-50 text-rose-700 ring-rose-200",
  UNSUPPORTED: "bg-rose-50 text-rose-700 ring-rose-200",
  IMAGE_SKIPPED: "bg-zinc-100 text-zinc-500 ring-zinc-200",
  LOW_COVERAGE: "bg-amber-50 text-amber-700 ring-amber-200",
};
const gradeTone = { A: "bg-emerald-600", B: "bg-lime-600", C: "bg-amber-500", D: "bg-orange-600", E: "bg-rose-600" };

export default function Statements({ retention = 60 }) {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [dismissed, setDismissed] = useState({});   // `${id}:${expires_at}` -> true
  const now = useNow(1000);
  const load = () => api.list().then(setRows);
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (rows && rows.some((r) => ["PARSING", "ANALYZING", "QUEUED"].includes(r.status))) {
      const t = setTimeout(load, 2500); return () => clearTimeout(t);
    }
  }, [rows]);

  const del = async (id) => { if (!confirm("Delete this statement?")) return; await api.del(id); load(); };
  const retry = async (id) => { const pw = prompt("PDF password:"); if (!pw) return; const r = await api.retry(id, pw); if (r.status === "READY") location.hash = "#/statement/" + id; else load(); };
  const extend = async (id) => {
    try { const r = await api.extend(id); setRows((rs) => (rs || []).map((x) => (x.id === id ? { ...x, ...r } : x))); } catch { load(); }
  };

  // first row inside the warning window that hasn't been dismissed for this cycle
  const warnRow = (rows || []).find((r) => {
    const left = leftMs(r, now);
    return left != null && left > 0 && left <= warnMs(retention) && !dismissed[`${r.id}:${r.expires_at}`];
  });

  const filtered = (rows || []).filter((r) => !q || (r.name || r.filename || "").toLowerCase().includes(q.toLowerCase()) || (r.bank || "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">Statements</h1>
          <p className="mt-1 text-sm text-zinc-500">Parsed bank statements and their analysis.</p>
        </div>
        <motion.a href="#/upload" {...tactile} className="focusable inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-soft hover:bg-zinc-800">
          <Plus size={17} weight="bold" /> Upload statement
        </motion.a>
      </div>

      <PrivacyBanner minutes={retention} className="mb-4" />

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-soft focus-within:ring-2 focus-within:ring-accent-ring/60 sm:max-w-xs">
        <MagnifyingGlass size={16} className="text-zinc-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or bank" className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400" />
      </div>

      {rows === null ? (
        <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <Empty title="No statements yet" hint="Upload a bank-statement PDF to get a full analysis." icon={<MagnifyingGlass size={26} className="text-zinc-300" />} />
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[1.6fr_1fr_1.1fr_0.7fr_0.5fr_auto] gap-4 border-b border-zinc-200 px-5 py-3 text-[10.5px] font-bold uppercase tracking-wider text-zinc-400 md:grid">
            <span>Customer</span><span>Bank</span><span>Period</span><span>Status</span><span>Grade</span><span></span>
          </div>
          <motion.div variants={stagger} initial="hidden" animate="show" className="divide-y divide-zinc-100">
            {filtered.map((r) => (
              <motion.div key={r.id} variants={rise} whileHover={{ y: -1 }} className="grid grid-cols-2 items-center gap-4 px-5 py-3.5 transition-colors hover:bg-zinc-50/70 md:grid-cols-[1.6fr_1fr_1.1fr_0.7fr_0.5fr_auto]">
                <div className="col-span-2 flex items-center gap-3 md:col-span-1">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[12px] font-bold text-white" style={{ background: avColor(r.name || r.filename) }}>{initials(r.name || r.filename)}</span>
                  <span className="truncate font-semibold text-zinc-800">{r.name || r.filename}</span>
                </div>
                <span className="flex flex-col"><span className="text-[13px] text-zinc-600">{r.bank || "—"}</span>
                  {r.coverage != null && <span className={`tnum text-[10.5px] ${r.coverage >= (r.min_coverage ?? 95) ? "text-emerald-600" : "text-amber-700"}`}>{r.coverage}% classified</span>}</span>
                <span className="flex flex-col items-start gap-1"><span className="tnum text-[12px] text-zinc-500">{r.period || "—"}</span><ExpiryChip rec={r} now={now} retention={retention} onExtend={() => extend(r.id)} /></span>
                <div className="flex flex-col items-start gap-1">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${statusTone[r.status] || statusTone.PARSING}`}>
                    {["PARSING", "ANALYZING", "QUEUED"].includes(r.status) && <motion.span animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 1.3 }} className="h-1.5 w-1.5 rounded-full bg-current" />}
                    {r.status.replace(/_/g, " ")}
                  </span>
                  {r.reason && <p className={`text-[11px] leading-snug ${["FAILED", "UNSUPPORTED"].includes(r.status) ? "text-rose-600" : r.status === "IMAGE_SKIPPED" ? "text-zinc-500" : "text-amber-700"}`}>{r.reason}</p>}
                </div>
                <span>{r.grade ? <span className={`grid h-7 w-7 place-items-center rounded-lg text-[13px] font-extrabold text-white ${gradeTone[r.grade]}`}>{r.grade}</span> : <span className="text-zinc-300">—</span>}</span>
                <div className="col-span-2 flex justify-end gap-1.5 md:col-span-1">
                  {r.status === "READY" && <motion.a href={`#/statement/${r.id}`} {...tactile} className="focusable inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-[12.5px] font-semibold text-zinc-700 hover:bg-zinc-50">View <ArrowRight size={13} weight="bold" /></motion.a>}
                  {r.status === "NEEDS_PASSWORD" && <motion.button {...tactile} onClick={() => retry(r.id)} className="focusable inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-[12.5px] font-semibold text-zinc-700 hover:bg-zinc-50"><Key size={13} /> Password</motion.button>}
                  <motion.button {...tactile} onClick={() => del(r.id)} aria-label="Delete" className="focusable grid h-8 w-8 place-items-center rounded-lg border border-zinc-200 text-zinc-500 transition-colors hover:bg-rose-50 hover:text-rose-600"><Trash size={14} /></motion.button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </Card>
      )}

      <AnimatePresence>
        {warnRow && (
          <ExpiryModal
            name={warnRow.name || warnRow.filename}
            msLeft={leftMs(warnRow, now)}
            retention={retention}
            onExtend={() => { extend(warnRow.id); setDismissed((d) => ({ ...d, [`${warnRow.id}:${warnRow.expires_at}`]: true })); }}
            onDismiss={() => setDismissed((d) => ({ ...d, [`${warnRow.id}:${warnRow.expires_at}`]: true }))}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
