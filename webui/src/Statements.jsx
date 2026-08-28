import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, MagnifyingGlass, ArrowRight, Trash, Key } from "@phosphor-icons/react";
import { api, fmtDate, initials, avColor } from "./api";
import { Card, Skeleton, Empty, stagger, rise, spring } from "./ui";

const statusTone = {
  READY: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PARSING: "bg-sky-50 text-sky-700 ring-sky-200",
  NEEDS_PASSWORD: "bg-amber-50 text-amber-700 ring-amber-200",
  EXTRACTION_SUSPECT: "bg-amber-50 text-amber-700 ring-amber-200",
  FAILED: "bg-rose-50 text-rose-700 ring-rose-200",
  UNSUPPORTED: "bg-rose-50 text-rose-700 ring-rose-200",
  IMAGE_SKIPPED: "bg-zinc-100 text-zinc-500 ring-zinc-200",
};
const gradeTone = { A: "bg-emerald-600", B: "bg-lime-600", C: "bg-amber-500", D: "bg-orange-600", E: "bg-rose-600" };

export default function Statements() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const load = () => api.list().then(setRows);
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (rows && rows.some((r) => ["PARSING", "ANALYZING", "QUEUED"].includes(r.status))) {
      const t = setTimeout(load, 2500); return () => clearTimeout(t);
    }
  }, [rows]);

  const del = async (id) => { if (!confirm("Delete this statement?")) return; await api.del(id); load(); };
  const retry = async (id) => { const pw = prompt("PDF password:"); if (!pw) return; const r = await api.retry(id, pw); if (r.status === "READY") location.hash = "#/statement/" + id; else load(); };

  const filtered = (rows || []).filter((r) => !q || (r.name || r.filename || "").toLowerCase().includes(q.toLowerCase()) || (r.bank || "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">Statements</h1>
          <p className="mt-1 text-sm text-zinc-500">Parsed bank statements and their analysis.</p>
        </div>
        <a href="#/upload" className="focusable inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-transform hover:bg-zinc-800 active:scale-[0.98]">
          <Plus size={17} weight="bold" /> Upload statement
        </a>
      </div>

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
              <motion.div key={r.id} variants={rise} className="grid grid-cols-2 items-center gap-4 px-5 py-3.5 transition-colors hover:bg-zinc-50/70 md:grid-cols-[1.6fr_1fr_1.1fr_0.7fr_0.5fr_auto]">
                <div className="col-span-2 flex items-center gap-3 md:col-span-1">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[12px] font-bold text-white" style={{ background: avColor(r.name || r.filename) }}>{initials(r.name || r.filename)}</span>
                  <span className="truncate font-semibold text-zinc-800">{r.name || r.filename}</span>
                </div>
                <span className="text-[13px] text-zinc-600">{r.bank || "—"}</span>
                <span className="tnum text-[12px] text-zinc-500">{r.period || "—"}</span>
                <div className="flex flex-col items-start gap-1">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${statusTone[r.status] || statusTone.PARSING}`}>
                    {["PARSING", "ANALYZING", "QUEUED"].includes(r.status) && <motion.span animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 1.3 }} className="h-1.5 w-1.5 rounded-full bg-current" />}
                    {r.status.replace(/_/g, " ")}
                  </span>
                  {r.reason && <p className={`text-[11px] leading-snug ${["FAILED", "UNSUPPORTED"].includes(r.status) ? "text-rose-600" : r.status === "IMAGE_SKIPPED" ? "text-zinc-500" : "text-amber-700"}`}>{r.reason}</p>}
                </div>
                <span>{r.grade ? <span className={`grid h-7 w-7 place-items-center rounded-lg text-[13px] font-extrabold text-white ${gradeTone[r.grade]}`}>{r.grade}</span> : <span className="text-zinc-300">—</span>}</span>
                <div className="col-span-2 flex justify-end gap-1.5 md:col-span-1">
                  {r.status === "READY" && <a href={`#/statement/${r.id}`} className="focusable inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-[12.5px] font-semibold text-zinc-700 transition-transform hover:bg-zinc-50 active:scale-[0.97]">View <ArrowRight size={13} weight="bold" /></a>}
                  {r.status === "NEEDS_PASSWORD" && <button onClick={() => retry(r.id)} className="focusable inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-[12.5px] font-semibold text-zinc-700 hover:bg-zinc-50"><Key size={13} /> Password</button>}
                  <button onClick={() => del(r.id)} aria-label="Delete" className="focusable grid h-8 w-8 place-items-center rounded-lg border border-zinc-200 text-zinc-500 transition-colors hover:bg-rose-50 hover:text-rose-600"><Trash size={14} /></button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </Card>
      )}
    </div>
  );
}
