import { useState } from "react";
import { motion } from "framer-motion";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { haptic } from "./ui";

// Plain-terms explainer for every tab and its key fields, grounded in the engine logic.
// Each field: `what` it is, and `how` it is computed.
const GUIDE = [
  { key: "summary", tab: "Summary", group: "Overview",
    purpose: "The one-screen verdict on the account — who it is, how much flows through, and an overall grade.",
    fields: [
      { name: "Character grade (A–E)", what: "A single letter summarising credit-worthiness of behaviour.",
        how: "Starts at 100, then deducts: obligation-to-inflow > 30% (−15), any lifestyle flag e.g. alcohol/gaming (−15), a cash-in→transfer-out cycle (−20), bounces (−10 each, max 3), 5+ round-tripping parties (−10). A ≥ 90, B ≥ 75, C ≥ 60, D ≥ 45, else E." },
      { name: "Monthly income", what: "Typical genuine income per month.",
        how: "Classified income ÷ number of months. Classified income = credits that look like real income — excludes your own self-transfers and non-income categories (loans, reversals, cashback)." },
      { name: "Gross credits", what: "All money that came in.",
        how: "Sum of every credit, EXCLUDING transfers from your own accounts (self-transfers)." },
      { name: "Gross debits", what: "All money that went out.",
        how: "Sum of every debit (self-transfers excluded)." },
      { name: "Net surplus", what: "What's left after outflows.",
        how: "Gross credits − gross debits. Negative means more went out than came in over the period." },
      { name: "Obligations", what: "Money going to loans / EMIs.",
        how: "Sum of all debits categorised as loan repayment — NACH/ACH mandates, EMIs, daily-collection, etc." },
      { name: "Obligation / inflow %", what: "How much of income is already committed to debt (a FOIR-like ratio).",
        how: "Obligations ÷ gross credits × 100. Above 30% is a stress signal and costs the grade points." },
      { name: "Opening / closing balance", what: "Balance at the start and end of the statement.",
        how: "Opening = first row's balance minus its amount; closing = last row's balance." },
      { name: "Extraction verified · N continuity errors", what: "Confidence that the ledger was read correctly.",
        how: "Checks that every row satisfies previous balance + amount = new balance. 0 errors = the figures reconcile against the bank's own running balance." },
    ] },

  { key: "character", tab: "Character", group: "Overview",
    purpose: "Every behavioural signal we can read from the statement — good, bad, and neutral — so nothing is hidden from the reviewer.",
    fields: [
      { name: "Severity colours", what: "RED = adverse, AMBER = watch, GREEN = positive, INFO = neutral / for-context.",
        how: "Each signal is coloured by thresholds (see below). Positive and neutral signals are shown too, not just risks." },
      { name: "Lifestyle & vice", what: "Vice spend that lowers the grade — Alcohol, Gambling/Betting, Lottery.",
        how: "Merchant/keyword match on the narration (e.g. TASMAC → Alcohol; DREAM11/RUMMY → Gambling). Alcohol flags RED at ≥ 4 txns/month or ≥ 2% of inflows; gambling at ≥ 3/month or ≥ 1%." },
      { name: "Discretionary lifestyle", what: "How money is spent — Shopping (Amazon/Flipkart), OTT, Food delivery, Travel.",
        how: "Keyword dictionaries per category; shown as count + amount + % of debits. Informational, not scored." },
      { name: "Borrowing behaviour", what: "Leverage and repayment stress — active lenders, lender stacking, daily-collection loans.",
        how: "Counts distinct lenders detected in loan narrations; multiple simultaneous lenders (stacking) and daily-collection patterns raise severity." },
      { name: "Financial discipline (positive)", what: "Signals that RAISE the grade — SIP / mutual funds, insurance premiums, recurring savings.",
        how: "Keyword match on investment/insurance narrations; presence shows GREEN." },
      { name: "Income quality", what: "Regularity, concentration and cash-dependence of income.",
        how: "Looks at how steady the salary/settlement credits are and how much income is cash vs traceable." },
      { name: "Balance hygiene", what: "Cash-flow cushion — min balance, days running near zero.",
        how: "Daily closing balances across the statement; counts days below ₹1,000 / ₹100 and the minimum reached." },
      { name: "Risk & manipulation", what: "Fraud-adjacent signals — round-tripping, cash-cycle, turnover inflation.",
        how: "Same detectors as the FCU flags tab, surfaced here as character context." },
    ] },

  { key: "analysis", tab: "Analysis", group: "Overview",
    purpose: "The classic month-by-month ledger summary (Perfios-style): one row per metric, one column per month, plus a total.",
    fields: [
      { name: "Gross Credits / Debits", what: "Total in and out each month.",
        how: "Sum of credits (or debits) per month, excluding self-transfers." },
      { name: "Self_Sister Credits", what: "Money received from your own / related accounts.",
        how: "Credits where the counterparty name matches the account holder (or the account number is yours). Carved out separately so it doesn't inflate real income." },
      { name: "Business Credits / Debits", what: "Genuine earning and genuine spending.",
        how: "Gross figure minus borrowed money — business credits exclude loan disbursements; business debits exclude loan repayments." },
      { name: "Each row × month", what: "The grid shows every metric across each month.",
        how: "Aggregated over a window from the first month to the last COMPLETE month (a trailing partial month is dropped for these summary rows, matching the reference report)." },
    ] },

  { key: "fullanalysis", tab: "Analysis (Full)", group: "Overview",
    purpose: "The exhaustive metric set (~148 metrics), matching a Digitap Analysis sheet — every metric per month plus an Overall column.",
    fields: [
      { name: "Balance-date averages", what: "Average end-of-day balance, and balance on specific dates (1st, 3rd–4th, 14th, 30th, ABB).",
        how: "Carries the closing balance forward for every calendar day, then averages over the requested dates. Used to judge liquidity when EMIs/salary hit." },
      { name: "Rail grid", what: "Count and amount of money by channel — UPI, IMPS, NEFT, RTGS, ATM, Cash, Cheque.",
        how: "Each transaction is tagged with its rail from the narration keywords, then counted and summed per month." },
      { name: "Category grid", what: "Count and amount across ~24 spend/income categories.",
        how: "Each transaction's category (from the classifier) rolled up per month." },
      { name: "Salary / Business / Ratios / Flags", what: "Salary credits, business cr/dr, net-above-₹1000, surplus, and derived ratios.",
        how: "Computed from the categorised ledger; the Overall column is the whole-statement figure (including the partial month, like Digitap's month*)." },
    ] },

  { key: "insights", tab: "Insights", group: "Overview",
    purpose: "The visual read — how the balance moved, where money went, and which channels were used.",
    fields: [
      { name: "EOD balance chart", what: "Daily closing balance across the whole statement.",
        how: "Takes each day's last balance and carries it forward on days with no transaction. Dips toward zero show tight liquidity." },
      { name: "Category breakdown", what: "Spending grouped by category.",
        how: "Sums debits per category and shows the largest as bars." },
      { name: "Rails", what: "Split of money by payment channel.",
        how: "Groups transactions by rail (UPI/IMPS/NEFT/ATM/Cash…) with count and amount." },
    ] },

  { key: "transactions", tab: "Transactions", group: "Transactions",
    purpose: "The full reconstructed ledger, every row, with our enrichments.",
    fields: [
      { name: "Date / Description / Debit / Credit / Balance", what: "The ledger exactly as printed by the bank.",
        how: "Parsed from the statement; debit/credit are the signed amount split into two columns." },
      { name: "Category", what: "What kind of transaction it is — Salary, Loan, Cash, Transfer to <name>, a merchant, etc.",
        how: "A rules engine reads the narration (keywords + merchant dictionaries + party-name extraction) and assigns the best-fit category." },
      { name: "Rail", what: "The payment channel used.",
        how: "Detected from narration tokens — UPI/, IMPS, NEFT, RTGS, ATM, CASH, CHQ." },
      { name: "Remitter / Beneficiary", what: "The other party's name.",
        how: "Extracted from the UPI/IMPS narration (handles the different orderings each bank prints)." },
    ] },

  { key: "upi", tab: "UPI Analysis", group: "Transactions",
    purpose: "An interactive look at small-ticket UPI behaviour.",
    fields: [
      { name: "Threshold ₹X", what: "You type an amount; it shows how many UPI transactions were BELOW it, and their total.",
        how: "Filters to transactions on the UPI rail with |amount| < X and counts/sums them live. Lots of sub-₹100 UPI usually means retail/QR merchant activity." },
    ] },

  { key: "highvalue", tab: "High Value", group: "Transactions",
    purpose: "The biggest single inflows and outflows.",
    fields: [
      { name: "High-value credits / debits", what: "The largest transactions, which usually explain the account's story (loan lump-sums, salary, big payments).",
        how: "Transactions whose amount exceeds a high-value threshold, listed largest-first for credits and debits separately." },
    ] },

  { key: "spend", tab: "Spend Analysis", group: "Money",
    purpose: "Where the money is spent, rolled up by category, month by month.",
    fields: [
      { name: "Category spend", what: "Monthly totals per spend category (shopping, food, travel, bills, utilities…).",
        how: "Sums debits per category per month from the classifier." },
      { name: "Lifestyle flags", what: "Alcohol / gaming spend surfaced alongside normal spend.",
        how: "Same detectors as the Character tab — shown here in the spending context." },
    ] },

  { key: "loans", tab: "Loan Analysis", group: "Money",
    purpose: "Every loan/EMI outflow, with the lender identified and the repayment pattern classified.",
    fields: [
      { name: "Lender name", what: "The actual lender behind an EMI/NACH debit (e.g. Capital India, ESFB, Bajaj, L&T, Muthoot, UGRO).",
        how: "Matches lender keywords/short-codes in the narration to a legal-name lookup." },
      { name: "Pattern", what: "The type of obligation — NACH mandate, daily-collection, or EMI.",
        how: "Detected from mandate/ACH/NACH tokens and the frequency/regularity of the debits." },
    ] },

  { key: "cashrails", tab: "Cash & Rails", group: "Money",
    purpose: "How cash-dependent the account is, and which rails move the money.",
    fields: [
      { name: "Cashflow", what: "Cash deposits vs cash withdrawals, and net cash.",
        how: "Sums cash-deposit and cash-withdrawal categories; high cash dependence is a quality signal for income." },
      { name: "Rails (in / out)", what: "Each channel — UPI, IMPS, NEFT, RTGS, ATM, Cash, Cheque — with count and amount.",
        how: "rail_of() tags each transaction from the narration; then grouped by direction." },
    ] },

  { key: "parties", tab: "Parties", group: "Money",
    purpose: "Everyone the account transacts with, and who money flows both ways with.",
    fields: [
      { name: "Amount in / out / net per party", what: "For each counterparty, total received, total sent, and the net.",
        how: "Groups transactions by the extracted counterparty name (self-transfers excluded)." },
      { name: "Both-sides flag", what: "The same party appears on BOTH the credit and debit side.",
        how: "Flagged when a party has money both in and out — a round-tripping candidate (money circling back can inflate turnover)." },
    ] },

  { key: "avgbal", tab: "Avg Bal (3rd/4th)", group: "Balances",
    purpose: "Liquidity cushion at the start of the month, when EMIs and rent usually hit.",
    fields: [
      { name: "Avg closing balance on 3rd & 4th", what: "The average end-of-day balance on the 3rd and 4th of each month.",
        how: "Averages the carried-forward closing balance on those two dates. A thin balance here means EMIs may bounce." },
    ] },

  { key: "daily", tab: "Daily Balance", group: "Balances",
    purpose: "A day-by-day view of the balance for the whole statement.",
    fields: [
      { name: "Daily open / close", what: "Opening and closing balance for each day.",
        how: "Derived from the ledger, carrying the balance forward across days with no activity." },
    ] },

  { key: "flags", tab: "Flags (FCU)", group: "Risk",
    purpose: "Fraud-Control-Unit style risk flags with drill-down to the exact transactions.",
    fields: [
      { name: "F02 · Cash-in → immediate transfer-out cycle", what: "Cash deposited and almost immediately pushed out to a fixed party — a possible informal-lender / money-mule pattern.",
        how: "A cash deposit ≥ ₹20,000 followed within 1 day by an outward transfer ≥ 80% of it. Fires if this happens 3+ times." },
      { name: "F03 · Round-tripping parties", what: "Counterparties that money flows to AND from — turnover inflation risk.",
        how: "Parties appearing on both the credit and debit side of the ledger; each is listed with its in/out counts and amounts." },
      { name: "Lifestyle flags", what: "Alcohol / gaming spend that crossed a threshold.",
        how: "Same rule as Character — e.g. alcohol ≥ 4/month or ≥ 2% of inflows. Each flag drills down to its transactions." },
    ] },

  { key: "qc", tab: "Validation & QC", group: "Risk",
    purpose: "Proof that the extraction is trustworthy before you rely on any number.",
    fields: [
      { name: "Balance continuity breaks", what: "Rows where the maths doesn't add up.",
        how: "Counts rows where previous balance + amount ≠ new balance. 0 = every figure reconciles against the bank's printed running balance (a perfect read)." },
      { name: "Categorisation coverage", what: "How much of the ledger got a real category (vs 'Other').",
        how: "Percentage of transactions and of amount that matched a specific category rather than falling through to Other." },
      { name: "Missing ranges", what: "Date gaps that might mean missing pages.",
        how: "Flags stretches between consecutive transactions with an unusually long day-gap." },
      { name: "Duplicate count", what: "Identical rows that may be double-counted.",
        how: "Counts exact-duplicate (date + amount + description) rows." },
    ] },
];

const GROUPS = ["Overview", "Transactions", "Money", "Balances", "Risk"];

function Field({ f }) {
  return (
    <div className="border-t border-zinc-100 py-3.5 first:border-t-0">
      <div className="text-[14px] font-semibold text-zinc-900">{f.name}</div>
      <div className="mt-0.5 text-[13.5px] leading-relaxed text-zinc-600">{f.what}</div>
      <div className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">
        <span className="font-semibold text-accent-fg">How it's worked out — </span>{f.how}
      </div>
    </div>
  );
}

export default function Guide() {
  const [active, setActive] = useState("summary");
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const matches = (f) =>
    (f.name + " " + f.what + " " + f.how).toLowerCase().includes(query);

  const searching = query.length > 0;
  const results = searching
    ? GUIDE.map((t) => ({ ...t, fields: t.fields.filter(matches) })).filter((t) => t.fields.length)
    : GUIDE.filter((t) => t.key === active);

  let lastGroup = null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">Guide</h1>
        <p className="mt-1.5 max-w-[64ch] text-[14px] leading-relaxed text-zinc-500">
          What every tab and field means — and the exact logic behind how each number is worked out.
        </p>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-soft focus-within:ring-2 focus-within:ring-accent-ring/60 sm:max-w-md">
        <MagnifyingGlass size={16} className="text-zinc-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any field — e.g. FOIR, self, bounce, rail"
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
