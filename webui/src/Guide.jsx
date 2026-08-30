import { useState } from "react";
import { motion } from "framer-motion";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { haptic } from "./ui";
import { GUIDE } from "./guideContent";

// Plain-terms explainer for every tab and every field, grounded in the engine logic.
// Each field: `what` it is, `how` it is computed, and `ex` — a real example.
// Examples use real parsed statements (Mr. PALA SRINIVAS — SBI, 1,376 txns, and
// BHUVANESHWARI R — Union Bank, 985 txns) so the numbers are genuine, not invented.

const GROUPS = ["Overview", "Transactions", "Money", "Balances", "Risk", "General"];

function Field({ f }) {
  return (
    <div className="border-t border-zinc-100 py-3.5 first:border-t-0">
      <div className={`font-semibold text-zinc-900 ${f.compact ? "text-[13px]" : "text-[14px]"}`}>{f.name}</div>
      {!f.compact && <div className="mt-0.5 text-[13.5px] leading-relaxed text-zinc-600">{f.what}</div>}
      <div className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">
        <span className="font-semibold text-accent-fg">How it's worked out — </span>{f.how}
      </div>
      <div className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">
        <span className="font-semibold text-zinc-600">Example — </span>{f.ex}
      </div>
    </div>
  );
}

export default function Guide() {
  const [active, setActive] = useState("summary");
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const matches = (f) =>
    (f.name + " " + (f.what || "") + " " + f.how + " " + (f.ex || "")).toLowerCase().includes(query);

  const searching = query.length > 0;
  const results = searching
    ? GUIDE.map((t) => ({ ...t, fields: t.fields.filter(matches) })).filter((t) => t.fields.length)
    : GUIDE.filter((t) => t.key === active);

  let lastGroup = null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">Guide</h1>
        <p className="mt-1.5 max-w-[66ch] text-[14px] leading-relaxed text-zinc-500">
          What every tab and field means, the exact logic behind each number, and a real example for every item.
          Examples come from genuinely parsed statements, not invented data.
        </p>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-soft focus-within:ring-2 focus-within:ring-accent-ring/60 sm:max-w-md">
        <MagnifyingGlass size={16} className="text-zinc-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any field — e.g. FOIR, self, bounce, UPI, Balance on 14th"
          className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400" />
      </div>

      <div className="grid gap-5 md:grid-cols-[214px_1fr]">
        {/* tab rail */}
        <nav className="sticky top-24 hidden h-max rounded-2xl border border-zinc-200 bg-white p-2 shadow-soft md:block">
          {GUIDE.map((t) => {
            const head = t.group !== lastGroup ? ((lastGroup = t.group), t.group) : null;
            const on = !searching && t.key === active;
            return (
              <div key={t.key}>
                {head && <div className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400">{head}</div>}
                <button onClick={() => { setActive(t.key); setQ(""); haptic(5); }}
                  className={`focusable relative block w-full rounded-lg px-3 py-2 text-left text-[13.5px] font-medium transition-colors ${on ? "bg-accent-soft text-accent-fg" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"}`}>
                  {on && <motion.span layoutId="guidemark" className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-accent" />}
                  {t.tab}
                </button>
              </div>
            );
          })}
        </nav>

        {/* mobile tab select */}
        {!searching && (
          <select value={active} onChange={(e) => setActive(e.target.value)}
            className="mb-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm md:hidden">
            {GUIDE.map((t) => <option key={t.key} value={t.key}>{t.tab}</option>)}
          </select>
        )}

        <div className="min-w-0 space-y-5">
          {searching && (
            <p className="text-[13px] text-zinc-500">
              {results.reduce((n, t) => n + t.fields.length, 0)} field(s) matching “{q}”
            </p>
          )}
          {results.length === 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">
              No fields match that search.
            </div>
          )}
          {results.map((t) => (
            <section key={t.key} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-soft">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-extrabold tracking-tight text-zinc-900">{t.tab}</h2>
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t.group}</span>
              </div>
              <p className="mt-1 text-[13.5px] leading-relaxed text-zinc-500">{t.purpose}</p>
              {t.key === "fullanalysis" && !searching && (
                <p className="mt-2 rounded-lg bg-accent-soft px-3 py-2 text-[12.5px] text-accent-fg">
                  The first six entries explain the metric families; after them, every one of the 148 metrics is listed individually — use the search box above to jump to any metric by name.
                </p>
              )}
              <div className="mt-3">
                {t.fields.map((f) => <Field key={f.name} f={f} />)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
