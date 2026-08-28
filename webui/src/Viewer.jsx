import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, DownloadSimple, FileXls, BracketsCurly } from "@phosphor-icons/react";
import { api, fmtDate } from "./api";
import { Skeleton } from "./ui";
import { TABS, TAB_MAP } from "./tabs";

const gradeTone = { A: "bg-emerald-600", B: "bg-lime-600", C: "bg-amber-500", D: "bg-orange-600", E: "bg-rose-600" };

export default function Viewer({ id, tab }) {
  const [res, setRes] = useState(null);
  useEffect(() => { setRes(null); api.get(id).then(setRes); }, [id]);

  if (!res) return <div className="space-y-4"><Skeleton className="h-14 w-full" /><div className="grid gap-4 md:grid-cols-[220px_1fr]"><Skeleton className="h-96" /><Skeleton className="h-96" /></div></div>;
  if (!res.ok) return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center">
      <div className="font-semibold text-zinc-800">{res.body.status || "Not ready"}</div>
      <div className="mt-1 text-sm text-zinc-500">{res.body.reason || ""}</div>
      <a href="#/" className="mt-4 inline-block rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">← Back</a>
    </div>
  );

  const P = res.body, s = P.summary, g = P.grade;
  const active = TAB_MAP[tab] ? tab : "summary";
  const Comp = TAB_MAP[active];
  const suspect = P._record && P._record.status === "EXTRACTION_SUSPECT";

  let lastGroup = null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className={`grid h-9 w-9 place-items-center rounded-xl text-[15px] font-extrabold text-white ${gradeTone[g.grade]}`}>{g.grade}</span>
        <div>
          <div className="text-xl font-extrabold tracking-tight text-zinc-900">{s.name || "—"}</div>
          <div className="tnum text-[12.5px] text-zinc-500">{s.bank} · A/c ****{(s.account_no || "").slice(-4)} · {fmtDate(s.period_start)} → {fmtDate(s.period_end)} · {s.txn_count} txns</div>
        </div>
        <div className="flex-1" />
        <a href={api.xlsx(id)} className="focusable inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-zinc-700 transition-transform hover:bg-zinc-50 active:scale-[0.97]"><FileXls size={15} /> XLSX</a>
        <a href={api.json(id)} className="focusable inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-zinc-700 transition-transform hover:bg-zinc-50 active:scale-[0.97]"><BracketsCurly size={15} /> JSON</a>
        <a href="#/" className="focusable inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-zinc-700 hover:bg-zinc-50"><ArrowLeft size={14} /> All</a>
      </div>

      {suspect && <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700 ring-1 ring-inset ring-rose-200">Extraction suspect — balance continuity did not fully reconcile. Review before use.</div>}

      <div className="grid gap-5 md:grid-cols-[214px_1fr]">
        <nav className="sticky top-24 hidden h-max rounded-2xl border border-zinc-200 bg-white p-2 shadow-soft md:block">
          {TABS.map(([k, label, group]) => {
            const head = group !== lastGroup ? ((lastGroup = group), group) : null;
            return (
              <div key={k}>
                {head && <div className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400">{head}</div>}
                <a href={`#/statement/${id}/${k}`} className={`focusable relative block rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors ${k === active ? "bg-accent-soft text-accent-fg" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"}`}>
                  {k === active && <motion.span layoutId="tabmark" className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-accent" />}
                  {label}
                </a>
              </div>
            );
          })}
        </nav>

        {/* mobile tab select */}
        <select value={active} onChange={(e) => (location.hash = `#/statement/${id}/${e.target.value}`)} className="mb-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm md:hidden">
          {TABS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>

        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div key={active} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
              <Comp P={P} id={id} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
