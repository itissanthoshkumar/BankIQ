import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Wallet, TrendUp, TrendDown, Bank, Percent, ArrowsLeftRight, MagnifyingGlass, ArrowRight, CaretDown, ShieldWarning, CheckCircle, Vault, WarningDiamond, CalendarBlank } from "@phosphor-icons/react";
import { inr, num, fmtDate, monthLabel } from "./api";
import { Card, SectionTitle, DataTable, BarRow, Count, Sev, dot, Pill, Empty, Help, stagger, rise, spring } from "./ui";
import { helpFor, metricHelp } from "./guideContent";

/* in-context help: <H t="summary" q="Gross credits" /> renders a "?" with the Guide entry */
const H = ({ t, q, className = "" }) => { const h = helpFor(t, q); return h ? <Help {...h} className={className} /> : null; };

/* map an Analysis-tab metric row to its Guide entry */
const analysisHelp = (metric) => {
  const q = /^Gross (Credits|Debits)/.test(metric) ? "Gross Credits / Debits"
    : /^Self_Sister/.test(metric) ? "Self_Sister"
    : /^Business/.test(metric) ? "Business Credits / Debits"
    : /^Cash/.test(metric) ? "Cash Deposits"
    : /^Loan/.test(metric) ? "Loan Transactions"
    : /Salary/.test(metric) ? "Salary Credits"
    : /Bounce/.test(metric) ? "Bounce rows"
    : /^Cheque/.test(metric) ? "Cheque Issues"
    : "The month columns";
  return helpFor("analysis", q);
};

/* ---------- tab registry ---------- */
export const TABS = [
  ["summary", "Summary", "Overview"], ["character", "Character", "Overview"], ["analysis", "Analysis", "Overview"], ["fullanalysis", "Analysis (Full)", "Overview"], ["insights", "Insights", "Overview"],
  ["transactions", "Transactions", "Transactions"], ["upi", "UPI Analysis", "Transactions"], ["highvalue", "High Value", "Transactions"],
  ["spend", "Spend Analysis", "Money"], ["loans", "Loan Analysis", "Money"], ["cashrails", "Cash & Rails", "Money"], ["parties", "Parties", "Money"],
  ["avgbal", "Avg Bal (3rd/4th)", "Balances"], ["daily", "Daily Balance", "Balances"],
  ["flags", "Flags (FCU)", "Risk"], ["qc", "Validation & QC", "Risk"],
];

/* ---------- shared bits ---------- */
const jump = (desc) => { window.__txsearch = desc; location.hash = location.hash.replace(/\/[^/]*$/, "/transactions"); };

const accentMap = {
  emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  sky: "bg-sky-50 text-sky-600 ring-sky-100",
  rose: "bg-rose-50 text-rose-600 ring-rose-100",
  violet: "bg-violet-50 text-violet-600 ring-violet-100",
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
  indigo: "bg-indigo-50 text-indigo-600 ring-indigo-100",
};
function Stat({ icon: Icon, label, value, dec = 0, prefix = "", suffix = "", accent = "emerald", plain, help }) {
  return (
    <motion.div variants={rise} className="flex items-center gap-3.5 rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-soft">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${accentMap[accent]}`}><Icon size={19} weight="bold" /></span>
      <div className="min-w-0">
        <div className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">{label}{help && <Help {...help} />}</div>
        <div className="tnum mt-0.5 text-[19px] font-bold text-zinc-900">{plain ? value : <Count value={value} dec={dec} prefix={prefix} suffix={suffix} />}</div>
      </div>
    </motion.div>
  );
}
function Row({ k, v, tone, help }) {
  const c = tone === "warn" ? "text-amber-700" : tone === "bad" ? "text-rose-600" : tone === "good" ? "text-emerald-600" : "text-zinc-900";
  return <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-2.5 text-[13px] last:border-0"><span className="flex items-center gap-1 text-zinc-500">{k}{help && <Help {...help} />}</span><span className={`tnum font-semibold ${c}`}>{v}</span></div>;
}

/* ---------- Summary ---------- */
function Summary({ P }) {
  const s = P.summary, g = P.grade, bh = P.balance_hygiene, q = P.qc || {};
  const months = Math.max(s.months_analyzed, 1);
  const monthlyInc = Math.round(s.classified_income / months);
  const surplus = Math.round(s.gross_credits - s.gross_debits);
  const life = P.lifestyle.filter((l) => l.fired);
  const cautions = P.flags.filter((f) => f.fired && ["CRITICAL", "WARN", "RED"].includes(f.severity));
  const top = (P.loan_analysis || [])[0], dom = P.parties[0];
  const settle = P.transactions.filter((t) => t.category === "UPI Settlement").length;
  const incomeType = settle > 20 ? "Merchant / QR settlements" : (P.salary || []).length ? "Salaried" : "Mixed / transfers";
  const cc = P.flags.find((f) => f.id === "F02"), rt = P.flags.find((f) => f.id === "F03");

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
      {/* identity strip */}
      <motion.div variants={rise} className="flex flex-wrap items-center gap-x-7 gap-y-2 rounded-2xl border border-zinc-200/70 bg-white px-5 py-3.5 text-[12.5px] shadow-soft">
        {[["Account holder", s.name], ["Bank", s.bank], ["Account", "****" + (s.account_no || "").slice(-4)], ["Type", s.account_type || "—"], ["Period", `${fmtDate(s.period_start)} → ${fmtDate(s.period_end)}`], ["Transactions", num(s.txn_count)]].map(([l, v]) => (
          <div key={l} className="flex flex-col"><span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{l}{l === "Account holder" && <H t="summary" q="Identity strip" />}</span><span className="tnum font-semibold text-zinc-800">{v}</span></div>
        ))}
        <span className={`ml-auto inline-flex items-center gap-1.5 text-[12px] font-semibold ${q.balance_continuity_breaks === 0 ? "text-emerald-600" : "text-rose-600"}`}>
          {q.balance_continuity_breaks === 0 ? <><CheckCircle size={15} weight="fill" /> Extraction verified · {num(s.txn_count)} txns · 0 continuity errors</> : <><ShieldWarning size={15} weight="fill" /> {num(q.balance_continuity_breaks)} continuity break(s)</>}
          <H t="summary" q="Extraction verified" />
        </span>
        {q.categorisation_coverage_pct != null && (
          <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${q.categorisation_coverage_pct >= 95 ? "text-emerald-600" : "text-amber-700"}`}>
            <CheckCircle size={15} weight="fill" /> {q.categorisation_coverage_pct}% of transactions classified
            <H t="qc" q="Categorisation coverage" />
          </span>
        )}
      </motion.div>

      {/* bento: grade + KPIs */}
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <motion.div variants={rise} className="flex flex-col justify-between gap-4 rounded-3xl bg-zinc-900 p-6 text-white shadow-diffuse">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/10 text-4xl font-extrabold">{g.grade}</div>
            <div><div className="flex items-center gap-1.5 font-bold">Character grade {g.grade}<H t="summary" q="Character grade" /></div><div className="tnum text-[12px] text-zinc-400">score {g.score} / 100</div></div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/15"><motion.div className="h-full rounded-full bg-accent" initial={{ scaleX: 0 }} animate={{ scaleX: g.score / 100 }} style={{ transformOrigin: "left" }} transition={{ ...spring, damping: 24 }} /></div>
          <p className="text-[12px] leading-relaxed text-zinc-300">{g.reasons.length ? g.reasons.join(" · ") : "No adverse signals of note."}</p>
        </motion.div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat icon={Vault} label={`Last day balance · ${fmtDate(s.period_end)}`} value={s.closing_balance} prefix="₹" dec={2} accent="indigo" help={helpFor("summary", "Last day balance")} />
          <Stat icon={WarningDiamond} label="Min balance in period" value={bh.min_balance} prefix="₹" dec={2} accent={bh.min_balance < 100 ? "rose" : "amber"} help={helpFor("summary", "Min balance")} />
          <Stat icon={CalendarBlank} label="Days below ₹1,000" value={`${num(bh.days_below_1000)} / ${num(bh.total_days)}`} plain accent={bh.days_below_1000 > bh.total_days * 0.25 ? "rose" : "sky"} help={helpFor("summary", "Days below")} />
          <Stat icon={Wallet} label="Monthly income" value={monthlyInc} prefix="₹" accent="emerald" help={helpFor("summary", "Monthly income")} />
          <Stat icon={TrendUp} label="Gross credits" value={s.gross_credits} prefix="₹" accent="sky" help={helpFor("summary", "Gross credits")} />
          <Stat icon={TrendDown} label="Gross debits" value={s.gross_debits} prefix="₹" accent="rose" help={helpFor("summary", "Gross debits")} />
          <Stat icon={ArrowsLeftRight} label="Net surplus" value={surplus} prefix="₹" accent={surplus < 0 ? "rose" : "violet"} help={helpFor("summary", "Net surplus")} />
          <Stat icon={Bank} label="Obligations" value={s.total_obligations} prefix="₹" accent="amber" help={helpFor("summary", "Obligations")} />
          <Stat icon={Percent} label="Obligation / inflow" value={s.obligation_to_inflow_pct} suffix="%" dec={1} accent="indigo" help={helpFor("summary", "Obligation / inflow %")} />
        </div>
      </div>

      {/* narrative + side panels */}
      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <motion.div variants={rise} className="space-y-3">
          <Card className="p-1.5">
            <div className="flex items-center gap-1.5 px-4 pb-2 pt-3 text-[13px] font-bold text-zinc-800">What the account shows<H t="summary" q="account shows" /></div>
            <div className="space-y-2 px-2 pb-2">
              {P.narrative.map((t, i) => (
                <div key={i} className={`flex gap-2.5 rounded-xl px-3 py-2.5 text-[13px] ${/^⚠/.test(t) ? "bg-rose-50 text-rose-800" : "bg-zinc-50 text-zinc-700"}`}>
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${/^⚠/.test(t) ? "bg-rose-500" : "bg-accent"}`} />{t.replace(/^⚠\s*/, "")}
                </div>
              ))}
            </div>
          </Card>
          {cautions.length > 0 && (
            <Card className="p-1.5">
              <div className="flex items-center gap-1.5 px-4 pb-1 pt-3 text-[13px] font-bold text-zinc-800">Cautions<H t="summary" q="Cautions card" /></div>
              {cautions.map((f, i) => (
                <a key={i} href={location.hash.replace(/\/[^/]*$/, "/flags")} className="flex items-center justify-between gap-2 px-4 py-2.5 text-[13px] hover:bg-zinc-50">
                  <span><b>{f.id}</b> {f.name}</span><span className="tnum font-semibold text-rose-600">{f.count} hit(s) →</span>
                </a>
              ))}
            </Card>
          )}
        </motion.div>

        <motion.div variants={rise} className="space-y-3">
          <Card><div className="px-4 pt-3 pb-1 text-[13px] font-bold text-zinc-800">Income &amp; obligations</div>
            <Row k="Income type" v={incomeType} help={helpFor("summary", "Income type")} />
            <Row k="Monthly avg income" v={inr(monthlyInc)} help={helpFor("summary", "Monthly income")} />
            <Row k="Classified income" v={inr(s.classified_income)} help={helpFor("summary", "Classified income")} />
            <Row k="Active lenders" v={top ? num(P.loan_analysis.length) : "0"} help={helpFor("summary", "Active lenders")} />
            <Row k="Top lender" v={top ? `${top.lender} · ${inr(top.total)}` : "—"} help={helpFor("summary", "Top lender")} />
            <Row k="Obligation / inflow" v={s.obligation_to_inflow_pct == null ? "—" : s.obligation_to_inflow_pct + "%"} tone={s.obligation_to_inflow_pct > 30 ? "warn" : ""} help={helpFor("summary", "Obligation / inflow %")} />
          </Card>
          <Card><div className="px-4 pt-3 pb-1 text-[13px] font-bold text-zinc-800">Behaviour &amp; risk</div>
            <Row k="Lifestyle flags" v={life.length ? life.map((l) => l.flag).join(", ") : "None"} tone={life.length ? "warn" : "good"} help={helpFor("flags", "Lifestyle flags")} />
            <Row k="Cash-cycle (F02)" v={cc && cc.fired ? `${cc.count} instances` : "None"} tone={cc && cc.fired ? "bad" : "good"} help={helpFor("flags", "F02")} />
            <Row k="Round-tripping (F03)" v={rt && rt.fired ? `${rt.count} parties` : "None"} tone={rt && rt.fired ? "warn" : "good"} help={helpFor("flags", "F03")} />
            <Row k="Dominant payee" v={dom ? dom.party : "—"} help={helpFor("summary", "Dominant payee")} />
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ---------- Character ---------- */
function Character({ P }) {
  const g = P.grade;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200/70 bg-white px-5 py-3.5 shadow-soft">
        <span className={`grid h-10 w-10 place-items-center rounded-xl text-[18px] font-extrabold text-white ${{ A: "bg-emerald-600", B: "bg-lime-600", C: "bg-amber-500", D: "bg-orange-600", E: "bg-rose-600" }[g.grade]}`}>{g.grade}</span>
        <div><div className="text-[13.5px] font-bold">Character grade {g.grade} · score {g.score}/100</div><div className="text-[12px] text-zinc-500">{g.reasons.length ? g.reasons.join(" · ") : "No adverse signals."}</div></div>
        <div className="ml-auto flex items-center gap-3 text-[11px] text-zinc-500">
          {[["RED", "Adverse"], ["AMBER", "Watch"], ["GREEN", "Positive"], ["INFO", "Neutral"]].map(([k, l]) => <span key={k} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${dot[k]}`} />{l}</span>)}
          <H t="character" q="Severity colours" />
        </div>
      </div>
      {(P.character || []).map((grp) => (
        <div key={grp.group}>
          <div className="mb-2.5 flex flex-wrap items-center gap-2.5"><h4 className="flex items-center gap-1.5 text-[14px] font-bold text-zinc-800">{grp.group}<H t="character" q={grp.group.replace(/\s*\(.*/, "")} /></h4><span className="text-[12px] text-zinc-500">{grp.desc}</span></div>
          <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {grp.signals.map((sig, i) => (
              <motion.div key={i} variants={rise} className={`rounded-2xl border p-4 shadow-soft ${sig.severity === "RED" ? "border-rose-200 bg-rose-50/70" : sig.severity === "AMBER" ? "border-amber-200 bg-amber-50/60" : sig.severity === "GREEN" ? "border-emerald-200 bg-emerald-50/50" : "border-zinc-200 bg-white"}`}>
                <div className="mb-1.5 flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-[13px] font-bold text-zinc-800"><span className={`h-2 w-2 rounded-full ${dot[sig.severity]}`} />{sig.label}</span><Sev s={sig.severity} /></div>
                <div className="text-[12px] leading-snug text-zinc-500">{sig.note}</div>
                {sig.amount > 0 && <div className="tnum mt-2 text-[15px] font-bold text-zinc-800">{inr(sig.amount)}</div>}
              </motion.div>
            ))}
          </motion.div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Transactions ---------- */
function Transactions({ P }) {
  const tx = P.transactions;
  const cats = useMemo(() => [...new Set(tx.map((t) => t.category))].sort(), [tx]);
  const rails = useMemo(() => [...new Set(tx.map((t) => t.rail))].sort(), [tx]);
  const [q, setQ] = useState(window.__txsearch || ""); window.__txsearch = "";
  const [fc, setFc] = useState(""); const [fr, setFr] = useState(""); const [fd, setFd] = useState("");
  const rows = tx.filter((t) => (!q || t.description.toLowerCase().includes(q.toLowerCase())) && (!fc || t.category === fc) && (!fr || t.rail === fr) && (!fd || (fd === "cr" ? t.credit : t.debit)));
  const CAP = 10000;
  const shown = rows.slice(0, CAP);
  const sel = "focusable rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[12.5px]";
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5"><MagnifyingGlass size={15} className="text-zinc-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search description" className="w-48 bg-transparent text-[12.5px] outline-none" /></div>
        <select className={sel} value={fc} onChange={(e) => setFc(e.target.value)}><option value="">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
        <select className={sel} value={fr} onChange={(e) => setFr(e.target.value)}><option value="">All rails</option>{rails.map((r) => <option key={r}>{r}</option>)}</select>
        <select className={sel} value={fd} onChange={(e) => setFd(e.target.value)}><option value="">Cr + Dr</option><option value="cr">Credits</option><option value="dr">Debits</option></select>
        <span className="tnum ml-auto text-[12px] text-zinc-500">
          showing {num(shown.length)} of {num(tx.length)}{rows.length > CAP && <span className="ml-1 font-semibold text-amber-700">(display capped — full set is in the XLSX)</span>}
        </span>
      </div>
      <DataTable
        cols={[
          { h: "#", num: true, cell: (t) => <span className="text-zinc-400">{t.seq}</span> },
          { h: "Date", cell: (t) => fmtDate(t.date), help: helpFor("transactions", "Date / Description") },
          { h: "Description", cell: (t) => <span className="text-zinc-700">{t.description}</span> },
          { h: "Debit", num: true, cell: (t) => t.debit ? <span className="text-rose-600">{num(t.debit, 2)}</span> : "" },
          { h: "Credit", num: true, cell: (t) => t.credit ? <span className="text-emerald-600">{num(t.credit, 2)}</span> : "" },
          { h: "Balance", num: true, cell: (t) => num(t.balance, 2) },
          { h: "Category", cell: (t) => <Pill>{t.category}</Pill>, help: helpFor("transactions", "Category") },
          { h: "Rail", cell: (t) => <Pill tone="accent">{t.rail}</Pill>, help: helpFor("transactions", "Rail") },
          { h: "Remitter / Beneficiary", cell: (t) => <span className="text-zinc-500">{t.remitter || ""}</span>, help: helpFor("transactions", "Remitter") },
        ]}
        rows={shown}
        empty={<Empty title="No matching transactions" hint="Clear the search or filters." />}
      />
    </div>
  );
}

/* ---------- UPI Analysis ---------- */
function UPIAnalysis({ P }) {
  const upi = useMemo(() => P.transactions.filter((t) => t.rail === "UPI"), [P]);
  const totAmt = upi.reduce((a, t) => a + Math.abs(t.amount), 0);
  const [x, setX] = useState(1000); const [dir, setDir] = useState("");
  const rows = upi.filter((t) => Math.abs(t.amount) < x && (!dir || (dir === "cr" ? t.credit : t.debit)));
  const amt = rows.reduce((a, t) => a + Math.abs(t.amount), 0);
  const crc = rows.filter((t) => t.credit).length, drc = rows.filter((t) => t.debit).length;
  return (
    <div>
      <SectionTitle help={helpFor("upi", "Threshold")}>UPI analysis</SectionTitle>
      <p className="mb-4 text-[13px] text-zinc-500"><span className="tnum">{num(upi.length)}</span> UPI transactions · <span className="tnum">{inr(totAmt)}</span> total. Set a threshold to see how many fall below it.</p>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1"><span className="text-[12px] font-semibold text-zinc-600">Amount threshold (₹)</span><input type="number" value={x} onChange={(e) => setX(+e.target.value || 0)} className="focusable tnum w-40 rounded-lg border border-zinc-200 px-3 py-2 text-[13.5px]" /></label>
        <label className="flex flex-col gap-1"><span className="text-[12px] font-semibold text-zinc-600">Direction</span><select value={dir} onChange={(e) => setDir(e.target.value)} className="focusable rounded-lg border border-zinc-200 px-3 py-2 text-[13.5px]"><option value="">Cr + Dr</option><option value="cr">Credits</option><option value="dr">Debits</option></select></label>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["UPI txns below ₹" + num(x), `${num(rows.length)} / ${num(upi.length)}`], ["% of UPI count", (upi.length ? (100 * rows.length / upi.length).toFixed(1) : 0) + "%"], ["Total value below", inr(amt)], ["Credits / Debits", `${num(crc)} / ${num(drc)}`]].map(([l, v], i) => (
          <div key={l} className="rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-soft"><div className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">{l}{i === 0 && <H t="upi" q="Stat cards" />}</div><div className="tnum mt-1 text-[16px] font-bold text-zinc-900">{v}</div></div>
        ))}
      </div>
      <SectionTitle>Transactions below threshold</SectionTitle>
      <DataTable maxH="46vh" rows={rows.slice(0, 1000)} empty={<Empty title={`No UPI transactions below ₹${num(x)}`} hint="Raise the threshold." />} cols={[
        { h: "#", num: true, cell: (t) => <span className="text-zinc-400">{t.seq}</span> }, { h: "Date", cell: (t) => fmtDate(t.date) }, { h: "Description", cell: (t) => t.description },
        { h: "Debit", num: true, cell: (t) => t.debit ? <span className="text-rose-600">{num(t.debit, 2)}</span> : "" }, { h: "Credit", num: true, cell: (t) => t.credit ? <span className="text-emerald-600">{num(t.credit, 2)}</span> : "" },
        { h: "Balance", num: true, cell: (t) => num(t.balance, 2) }, { h: "Category", cell: (t) => <Pill>{t.category}</Pill> },
      ]} />
    </div>
  );
}

/* ---------- Insights (EOD chart + breakdowns) ---------- */
function EodChart({ series }) {
  const [hover, setHover] = useState(null);
  if (!series.length) return <div className="text-sm text-zinc-400">No data</div>;
  const W = 980, H = 220, pad = 40;
  let pts = series; if (pts.length > 380) { const step = Math.ceil(pts.length / 380); pts = series.filter((_, i) => i % step === 0); }
  const xs = (i) => pad + i / (pts.length - 1) * (W - pad * 1.5);
  const bmax = Math.max(...pts.map((p) => p.balance), 1), bmin = Math.min(...pts.map((p) => p.balance), 0);
  const ys = (v) => H - pad - (v - bmin) / ((bmax - bmin) || 1) * (H - pad * 1.6);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)},${ys(p.balance).toFixed(1)}`).join(" ");
  const area = `${line} L${xs(pts.length - 1).toFixed(1)},${H - pad} L${xs(0).toFixed(1)},${H - pad} Z`;
  const y1000 = ys(1000);
  const onMove = (e) => { const r = e.currentTarget.getBoundingClientRect(); let i = Math.round(((e.clientX - r.left) / r.width * W - pad) / (W - pad * 1.5) * (pts.length - 1)); i = Math.max(0, Math.min(pts.length - 1, i)); setHover({ i, x: xs(i), y: ys(pts[i].balance), p: pts[i] }); };
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full overflow-visible" role="img" aria-label={`End-of-day balance ${fmtDate(series[0].date)} to ${fmtDate(series[series.length - 1].date)}, range ${inr(bmin)} to ${inr(bmax)}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {[0, .25, .5, .75, 1].map((f, i) => { const v = bmin + (bmax - bmin) * f; return <g key={i}><text x="4" y={ys(v) + 4} fontSize="10" fill="#a1a1aa" className="tnum">{inr(Math.round(v))}</text><line x1={pad} x2={W - pad * .5} y1={ys(v)} y2={ys(v)} stroke="#f4f4f5" /></g>; })}
        {y1000 > pad && y1000 < H - pad && <><line x1={pad} x2={W - pad * .5} y1={y1000} y2={y1000} stroke="#d97706" strokeDasharray="4 3" /><text x={W - pad * .5} y={y1000 - 4} fontSize="9" fill="#b45309" textAnchor="end">₹1,000</text></>}
        <path d={area} fill="rgba(13,148,136,.08)" />
        <path d={line} fill="none" stroke="#0d9488" strokeWidth="1.8" />
        {hover && <><line x1={hover.x} x2={hover.x} y1={pad * .5} y2={H - pad} stroke="#0d9488" strokeWidth="1" strokeDasharray="3 3" /><circle cx={hover.x} cy={hover.y} r="3.6" fill="#0d9488" /></>}
        <text x={pad} y={H + 12} fontSize="10" fill="#a1a1aa">{fmtDate(series[0].date)}</text>
        <text x={W - pad * .5} y={H + 12} fontSize="10" fill="#a1a1aa" textAnchor="end">{fmtDate(series[series.length - 1].date)}</text>
      </svg>
      {hover && <div className="tnum pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-zinc-900 px-2 py-1 text-[11px] text-white shadow-lg" style={{ left: `${hover.x / W * 100}%`, top: `${hover.y / (H + 18) * 100}%` }}><b>{fmtDate(hover.p.date)}</b> · {inr(hover.p.balance)}</div>}
    </div>
  );
}
function Insights({ P }) {
  const cb = P.category_breakdown;
  const maxD = Math.max(1, ...cb.debits.map((x) => x.amount)), maxC = Math.max(1, ...cb.credits.map((x) => x.amount));
  return (
    <div className="space-y-4">
      <Card className="p-5"><SectionTitle help={helpFor("insights", "EOD balance chart")}>End-of-day balance</SectionTitle><EodChart series={P.eod_series} /></Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5"><SectionTitle help={helpFor("insights", "Where money went")}>Where money went (debits)</SectionTitle><div className="space-y-1.5">{cb.debits.map((x) => <BarRow key={x.group} label={x.group} value={x.amount} max={maxD} tint="bg-rose-400" />)}</div></Card>
        <Card className="p-5"><SectionTitle help={helpFor("insights", "Where money came from")}>Where money came from (credits)</SectionTitle><div className="space-y-1.5">{cb.credits.map((x) => <BarRow key={x.group} label={x.group} value={x.amount} max={maxC} tint="bg-emerald-500" />)}</div></Card>
      </div>
      {P.lifestyle.length > 0 && <Card className="p-5"><SectionTitle help={helpFor("flags", "Lifestyle flags")}>Lifestyle spend</SectionTitle>{P.lifestyle.map((l) => <div key={l.flag} className="flex items-center gap-3 py-1 text-[13px]"><span className="flex w-40 items-center gap-2"><span className={`h-2 w-2 rounded-full ${dot[l.severity]}`} />{l.flag}</span><span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100"><span className={`block h-full rounded-full ${l.severity === "RED" ? "bg-rose-500" : "bg-amber-400"}`} style={{ width: Math.min(100, l.pct_of_inflows * 10) + "%" }} /></span><span className="tnum w-40 text-right text-zinc-500">{inr(l.amount)} · {l.pct_of_inflows}%</span></div>)}</Card>}
    </div>
  );
}

/* ---------- monthwise Analysis ---------- */
function Analysis({ P }) {
  return (
    <div>
      <SectionTitle help={helpFor("analysis", "The month columns")}>Monthwise analysis</SectionTitle>
      <DataTable rows={P.analysis} cols={[
        { h: "Metric", cell: (r) => { const h = analysisHelp(r.metric); return <span className="flex items-center gap-1">{r.metric}{h && <Help {...h} />}</span>; } },
        ...P.months.map((m, i) => ({ h: monthLabel(m), num: true, cell: (r) => num(r.values[i], /Amount/.test(r.metric) && !/Count/.test(r.metric) ? 2 : 0) })),
        { h: "Total", num: true, cell: (r) => <b>{num(r.total, /Amount/.test(r.metric) && !/Count/.test(r.metric) ? 2 : 0)}</b> },
      ]} />
    </div>
  );
}
function FullAnalysis({ P }) {
  const d = P.digitap_analysis; const [q, setQ] = useState("");
  if (!d) return <Empty title="Not available" />;
  const rows = d.metrics.filter((r) => !q || r.label.toLowerCase().includes(q.toLowerCase()));
  const fmt = (v) => v === "" || v == null ? "" : typeof v === "number" ? num(v, Number.isInteger(v) ? 0 : 2) : v;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3"><SectionTitle>Analysis — full metric set (Digitap parity)</SectionTitle><span className="tnum text-[12px] text-zinc-500">{num(d.metrics.length)} metrics · {d.months.length} months + Overall</span></div>
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 sm:max-w-xs"><MagnifyingGlass size={15} className="text-zinc-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter metrics" className="w-full bg-transparent text-[12.5px] outline-none" /></div>
      <DataTable rows={rows} cols={[{ h: "Metric", cell: (r) => { const h = metricHelp(r.label); return <span className="flex items-center gap-1">{r.label}{h && <Help {...h} />}</span>; } }, ...d.months.map((m, i) => ({ h: monthLabel(m), num: true, cell: (r) => fmt(r.values[i]) })), { h: "Overall", num: true, cell: (r) => <b>{fmt(r.overall)}</b>, help: helpFor("fullanalysis", "Reading this tab") }]} />
    </div>
  );
}

/* ---------- Spend / Loans / Cash&Rails / Parties ---------- */
function Spend({ P }) {
  const rows = P.spend_analysis;
  return (
    <div className="space-y-5">
      <div><SectionTitle help={helpFor("spend", "Category rows")}>Spend by category</SectionTitle>
        <DataTable rows={rows} empty={<Empty title="No categorised spend" />} cols={[
          { h: "Category", cell: (r) => <span className="flex items-center gap-2">{r.category}{r.lifestyle && <Sev s="RED" />}</span>, help: helpFor("spend", "Category column") },
          ...P.months.map((m, i) => ({ h: monthLabel(m), num: true, cell: (r) => r.monthly[i] ? num(r.monthly[i]) : "" })),
          { h: "Total", num: true, cell: (r) => <b>{num(r.total, 2)}</b> }, { h: "Count", num: true, cell: (r) => num(r.count) }, { h: "% debits", num: true, cell: (r) => r.pct_of_debits + "%", help: helpFor("spend", "% debits column") },
        ]} /></div>
      {P.lifestyle.length > 0 && <div><SectionTitle help={helpFor("flags", "Lifestyle flags")}>Lifestyle detail</SectionTitle><DataTable maxH="30vh" rows={P.lifestyle} cols={[
        { h: "Category", cell: (l) => l.flag }, { h: "Txns", num: true, cell: (l) => num(l.txn_count) }, { h: "Total", num: true, cell: (l) => num(l.amount, 2) },
        { h: "Monthly avg", num: true, cell: (l) => num(l.monthly_avg, 2) }, { h: "% inflows", num: true, cell: (l) => l.pct_of_inflows + "%" }, { h: "Per month", num: true, cell: (l) => l.per_month }, { h: "Flag", cell: (l) => <Sev s={l.severity} /> },
      ]} /></div>}
    </div>
  );
}
function Loans({ P }) {
  const rows = P.loan_analysis, total = rows.reduce((a, l) => a + l.total, 0);
  return (
    <div className="space-y-5">
      <SectionTitle>Loan / EMI analysis by lender</SectionTitle>
      {!rows.length ? <Empty title="No loan repayments detected" /> : <>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4"><div className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-amber-700/80">Total obligations<H t="loans" q="Total obligations stat" /></div><div className="tnum mt-1 text-[19px] font-bold text-amber-800">{inr(total)}</div></div>
          <div className="rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-soft"><div className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">Active lenders<H t="summary" q="Active lenders" /></div><div className="tnum mt-1 text-[19px] font-bold">{rows.length}</div></div>
          <div className="rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-soft"><div className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">Obligation / inflow<H t="summary" q="Obligation / inflow %" /></div><div className="tnum mt-1 text-[19px] font-bold">{P.summary.obligation_to_inflow_pct == null ? "—" : P.summary.obligation_to_inflow_pct + "%"}</div></div>
        </div>
        <DataTable rows={rows} cols={[
          { h: "Lender", cell: (l) => <b>{l.lender}</b>, help: helpFor("loans", "Lender name") }, { h: "Type", cell: (l) => <Pill tone="accent">{l.lender_type}</Pill>, help: helpFor("loans", "Type") }, { h: "Pattern", cell: (l) => l.pattern, help: helpFor("loans", "Pattern") },
          { h: "Txns", num: true, cell: (l) => num(l.txn_count) }, { h: "Total paid", num: true, cell: (l) => <b>{num(l.total, 2)}</b>, help: helpFor("loans", "Totals") }, { h: "Monthly avg", num: true, cell: (l) => num(l.monthly_avg, 2) },
          { h: "First", cell: (l) => fmtDate(l.first_seen) }, { h: "Last", cell: (l) => fmtDate(l.last_seen) },
        ]} />
      </>}
    </div>
  );
}
function CashRails({ P }) {
  const c = P.cashflow;
  return (
    <div className="space-y-5">
      <div><SectionTitle help={helpFor("cashrails", "Cashflow cards")}>Cash flow</SectionTitle><div className="grid grid-cols-2 gap-3 sm:max-w-lg">
        <div className="rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-soft"><div className="text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">Cash deposits</div><div className="tnum mt-1 text-[15px] font-bold">{num(c.deposit_count)} · {inr(c.deposit_amount)}</div></div>
        <div className="rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-soft"><div className="text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">Cash withdrawals</div><div className="tnum mt-1 text-[15px] font-bold">{num(c.withdrawal_count)} · {inr(c.withdrawal_amount)}</div></div>
      </div></div>
      <div><SectionTitle help={helpFor("cashrails", "Rails table")}>Rails (payment channels)</SectionTitle><DataTable rows={P.rails} cols={[
        { h: "Rail", cell: (r) => <Pill tone="accent">{r.rail}</Pill> }, { h: "Cr #", num: true, cell: (r) => num(r.cr_count) }, { h: "Credit ₹", num: true, cell: (r) => r.cr_amt ? <span className="text-emerald-600">{inr(r.cr_amt)}</span> : "" },
        { h: "Dr #", num: true, cell: (r) => num(r.dr_count) }, { h: "Debit ₹", num: true, cell: (r) => r.dr_amt ? <span className="text-rose-600">{inr(r.dr_amt)}</span> : "" },
      ]} /></div>
    </div>
  );
}
function Parties({ P }) {
  return (
    <div className="space-y-5">
      <div><SectionTitle help={helpFor("parties", "Top-40 cutoff")}>Counterparty ledger (top 40)</SectionTitle><DataTable rows={P.parties} cols={[
        { h: "Party", cell: (x) => <span className="flex items-center gap-2 font-semibold">{x.party}{x.both_sides && <Pill tone="accent">both-sides</Pill>}</span>, help: helpFor("parties", "Both-sides flag") },
        { h: "In #", num: true, cell: (x) => num(x.txns_in) }, { h: "Amount in", num: true, cell: (x) => x.amount_in ? <span className="text-emerald-600">{inr(x.amount_in)}</span> : "" },
        { h: "Out #", num: true, cell: (x) => num(x.txns_out) }, { h: "Amount out", num: true, cell: (x) => x.amount_out ? <span className="text-rose-600">{inr(x.amount_out)}</span> : "" },
        { h: "Net", num: true, cell: (x) => <span className={x.net >= 0 ? "text-emerald-600" : "text-rose-600"}>{inr(x.net)}</span>, help: helpFor("parties", "Party ledger") },
      ]} /></div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[["Received", P.top5_credit, "bg-emerald-500"], ["Transferred", P.top5_debit, "bg-rose-400"]].map(([title, data, tint]) => (
          <Card key={title} className="p-5"><SectionTitle help={helpFor("parties", "Monthly Top-5")} right={<Help {...helpFor("parties", "Why Top-5 can show names")} />}>Monthly Top-5 {title}</SectionTitle>
            {Object.entries(data).map(([m, list]) => list.length ? <div key={m}><div className="mb-1 mt-2 text-[11px] text-zinc-400">{monthLabel(m)}</div>{list.map((r, i) => <BarRow key={i} label={r.desc} value={r.amount} max={Math.max(1, ...list.map((x) => x.amount))} tint={tint} />)}</div> : null)}
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------- Balances ---------- */
function AvgBal({ P }) {
  const a = P.avg_closing_3_4, max = Math.max(1, ...a.rows.map((r) => r.avg || 0));
  return (
    <div className="space-y-4">
      <div><SectionTitle help={helpFor("avgbal", "Close on 3rd")}>Average closing balance — 3rd &amp; 4th of each month</SectionTitle>
        <p className="mb-3 text-[13px] text-zinc-500">Closing balance on the 3rd and 4th of every month and their average — a key-date liquidity read for EMIs/NACH that present early in the month.</p>
        <DataTable maxH="48vh" rows={[...a.rows, { month: "__ov", close_3: a.avg_3, close_4: a.avg_4, avg: a.overall_avg, ov: true }]} cols={[
          { h: "Month", cell: (r) => r.ov ? <b>Overall</b> : <b>{monthLabel(r.month)}</b> }, { h: "Closing · 3rd", num: true, cell: (r) => r.close_3 == null ? "—" : num(r.close_3, 2) },
          { h: "Closing · 4th", num: true, cell: (r) => r.close_4 == null ? "—" : num(r.close_4, 2) }, { h: "Average (3rd+4th)", num: true, cell: (r) => <b>{r.avg == null ? "—" : num(r.avg, 2)}</b> },
        ]} /></div>
      <Card className="p-5"><SectionTitle>Monthly average (3rd &amp; 4th)</SectionTitle>{a.rows.map((r) => <BarRow key={r.month} label={monthLabel(r.month)} value={r.avg || 0} max={max} />)}</Card>
    </div>
  );
}
function Daily({ P }) {
  return (
    <div><SectionTitle help={helpFor("daily", "Daily open / close")}>Daily balance — open &amp; close ({num(P.daily_balance.length)} days)</SectionTitle>
      <DataTable rows={P.daily_balance} cols={[
        { h: "Date", cell: (d) => fmtDate(d.date) }, { h: "Opening", num: true, cell: (d) => num(d.open, 2) }, { h: "Closing", num: true, cell: (d) => num(d.close, 2) },
        { h: "Txns", num: true, cell: (d) => d.txns || "" }, { h: "Net change", num: true, cell: (d) => d.net ? <span className={d.net < 0 ? "text-rose-600" : "text-emerald-600"}>{num(d.net, 2)}</span> : "" },
        { h: "Below ₹1k", cell: (d) => d.close < 1000 ? <Sev s="AMBER" /> : "", help: helpFor("daily", "Below-₹1,000") },
      ]} /></div>
  );
}

/* ---------- Flags ---------- */
function FlagCard({ f }) {
  const [open, setOpen] = useState(false);
  const fh = helpFor("flags", f.id === "F02" ? "F02" : f.id === "F03" ? "F03" : "Lifestyle flags");
  return (
    <div className={`overflow-hidden rounded-2xl border shadow-soft ${f.fired ? "border-rose-200" : "border-zinc-200"}`}>
      <div role="button" tabIndex={0} onClick={() => setOpen((o) => !o)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen((o) => !o); }}
        className={`flex w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-left transition-colors ${f.fired ? "bg-rose-50/60" : "bg-white hover:bg-zinc-50"}`}>
        <Sev s={f.severity} /><b className="text-[13.5px]">{f.id} · {f.name}</b>{fh && <Help {...fh} />}
        <span className="tnum ml-auto flex items-center gap-2 text-[12px] text-zinc-500">{f.fired ? `FIRED · ${f.count} hit(s)` : "not fired"}<CaretDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} /></span>
      </div>
      {open && (
        <div className="border-t border-zinc-100 p-3">
          {f.txns && f.txns.length ? <>
            {f.summary && <div className="tnum mb-2 text-[12px] text-zinc-500">{f.count} txn(s) · {inr(f.summary.amount)} total · {f.summary.pct_of_inflows}% of inflows</div>}
            <DataTable maxH="40vh" rows={f.txns} cols={[
              { h: "Date", cell: (t) => fmtDate(t.date) }, { h: "Description", cell: (t) => t.description }, { h: "Amount", num: true, cell: (t) => <span className={t.amount < 0 ? "text-rose-600" : "text-emerald-600"}>{num(t.amount, 2)}</span> },
              { h: "Balance", num: true, cell: (t) => num(t.balance, 2) }, { h: "Category", cell: (t) => <Pill>{t.category}</Pill> },
              { h: "", cell: (t) => <button onClick={() => jump(t.description)} className="text-accent-fg hover:underline">view →</button> },
            ]} />
          </> : f.id === "F02" && f.detail?.length ? (
            <DataTable rows={f.detail} cols={[{ h: "Deposit date", cell: (e) => fmtDate(e.deposit_date) }, { h: "Deposit ₹", num: true, cell: (e) => num(e.deposit_amount, 2) }, { h: "Out ₹", num: true, cell: (e) => num(e.outflow_amount, 2) }, { h: "To", cell: (e) => e.outflow_to }, { h: "Desc", cell: (e) => e.outflow_desc }]} />
          ) : f.id === "F03" && f.detail?.length ? (
            <DataTable rows={f.detail} cols={[{ h: "Party", cell: (e) => e.party }, { h: "Cr #", num: true, cell: (e) => e.credits }, { h: "Cr ₹", num: true, cell: (e) => num(e.cr_amt) }, { h: "Dr #", num: true, cell: (e) => e.debits }, { h: "Dr ₹", num: true, cell: (e) => num(e.dr_amt) }]} />
          ) : <div className="py-2 text-[13px] text-zinc-400">No underlying transactions{f.fired ? "" : " (flag not fired)"}.</div>}
        </div>
      )}
    </div>
  );
}
function Flags({ P }) {
  return <div><SectionTitle help={helpFor("flags", "Severity scale")}>FCU &amp; behaviour flags</SectionTitle><div className="space-y-3">{P.flags.map((f, i) => <FlagCard key={i} f={f} />)}</div></div>;
}

/* ---------- High Value & QC ---------- */
function HighValue({ P }) {
  const tbl = (title, rows) => (
    <div><SectionTitle help={helpFor("highvalue", "High-value credits")} right={<span className="tnum text-[12px] text-zinc-400">{rows.length}</span>}>{title}</SectionTitle>
      <DataTable maxH="38vh" rows={rows} empty={<Empty title="None above threshold" />} cols={[
        { h: "Date", cell: (t) => fmtDate(t.date) }, { h: "Description", cell: (t) => t.description }, { h: "Amount", num: true, cell: (t) => <span className={t.amount < 0 ? "text-rose-600" : "text-emerald-600"}>{num(t.amount, 2)}</span> },
        { h: "Category", cell: (t) => <Pill>{t.category}</Pill> }, { h: "Balance", num: true, cell: (t) => num(t.balance, 2) },
      ]} /></div>
  );
  return <div className="space-y-5">{tbl("High-value credits", P.high_value_credit)}{tbl("High-value debits", P.high_value_debit)}</div>;
}
function QC({ P }) {
  const q = P.qc;
  const qh = (label) => helpFor("qc",
    /Bank|Account type/.test(label) ? "Bank & account echo"
      : /Password/.test(label) ? "Password protected"
      : /continuity/.test(label) ? "Balance continuity"
      : /Duplicate/.test(label) ? "Duplicate count"
      : /coverage/.test(label) ? "Categorisation coverage"
      : /Missing/.test(label) ? "Missing date ranges"
      : "Balance continuity");
  const kv = [["Bank", q.bank], ["Account type", q.account_type || "—"], ["Password protected", q.password_protected || "—"], ["Transactions extracted", num(q.txn_count)],
  ["Balance continuity breaks", num(q.balance_continuity_breaks), q.balance_continuity_breaks ? "warn" : ""], ["Duplicate transactions", num(q.duplicate_count)],
  ["Categorisation coverage (count)", q.categorisation_coverage_pct + "%"], ["Categorisation coverage (amount)", q.categorisation_coverage_amt_pct + "%"], ["Missing date ranges (>15d)", num(q.missing_ranges.length), q.missing_ranges.length ? "warn" : ""]];
  return (
    <div className="space-y-4">
      <SectionTitle help={helpFor("qc", "Balance continuity")}>Validation &amp; QC</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{kv.map(([l, v, w]) => { const h = qh(l); return <div key={l} className={`rounded-2xl border p-4 shadow-soft ${w === "warn" ? "border-amber-200 bg-amber-50/60" : "border-zinc-200/70 bg-white"}`}><div className={`flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide ${w === "warn" ? "text-amber-700/80" : "text-zinc-500"}`}>{l}{h && <Help {...h} />}</div><div className={`tnum mt-1 text-[15px] font-bold ${w === "warn" ? "text-amber-800" : "text-zinc-900"}`}>{v}</div></div>; })}</div>
      {(q.unclassified || []).length > 0 && (
        <div><SectionTitle help={helpFor("qc", "Unclassified transactions")}
               right={<span className="tnum text-[12px] text-zinc-400">{num(q.unclassified.length)} row(s)</span>}>
               Unclassified transactions (“Others”)</SectionTitle>
          <DataTable maxH="30vh" rows={q.unclassified} cols={[
            { h: "Date", cell: (t) => fmtDate(t.date) },
            { h: "Description", cell: (t) => t.description || <span className="text-zinc-400">(blank in the statement)</span> },
            { h: "Amount", num: true, cell: (t) => <span className={t.amount < 0 ? "text-rose-600" : "text-emerald-600"}>{num(t.amount, 2)}</span> },
            { h: "Balance", num: true, cell: (t) => num(t.balance, 2) },
            { h: "", cell: (t) => <button onClick={() => jump(t.description)} className="text-accent-fg hover:underline">view →</button> },
          ]} /></div>
      )}
      {q.missing_ranges.length ? <div><SectionTitle help={helpFor("qc", "Missing date ranges")}>Missing transaction ranges</SectionTitle><DataTable maxH="26vh" rows={q.missing_ranges} cols={[{ h: "From", cell: (m) => fmtDate(m.from) }, { h: "To", cell: (m) => fmtDate(m.to) }, { h: "Gap (days)", num: true, cell: (m) => m.days }]} /></div>
        : <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200"><CheckCircle size={16} weight="fill" /> No missing date ranges · balance continuity intact · full extraction verified.</div>}
    </div>
  );
}

export const TAB_MAP = { summary: Summary, character: Character, analysis: Analysis, fullanalysis: FullAnalysis, insights: Insights, transactions: Transactions, upi: UPIAnalysis, highvalue: HighValue, spend: Spend, loans: Loans, cashrails: CashRails, parties: Parties, avgbal: AvgBal, daily: Daily, flags: Flags, qc: QC };
