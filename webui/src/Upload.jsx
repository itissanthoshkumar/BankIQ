import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadSimple, FilePdf, X, CircleNotch, ShieldCheck, CheckCircle, ArrowRight } from "@phosphor-icons/react";
import { api } from "./api";
import { stagger, rise, spring, haptic } from "./ui";

const BANKS = ["Union Bank", "City Union", "SBI", "HDFC", "+ generic"];

function Field({ label, hint, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between">
        <span className="text-[12px] font-semibold text-zinc-600">{label}</span>
        {hint && <span className="text-[11px] text-zinc-400">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
const inputCls = "focusable w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[13.5px] outline-none transition-shadow placeholder:text-zinc-400 focus:border-accent focus:ring-2 focus:ring-accent-ring/50";

export default function Upload() {
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fi = useRef();
  const f = useRef({});

  const pick = (x) => { if (x && x.type === "application/pdf") { setFile(x); setErr(""); haptic(12); } };

  const submit = async () => {
    if (!file) return;
    setBusy(true); setErr("");
    const fd = new FormData();
    fd.append("file", file);
    ["password", "applicant_name", "reference_id", "proposed_emi", "product"].forEach((k) => fd.append(k, f.current[k] || ""));
    let r;
    try { r = await api.upload(fd); }
    catch (e) { setBusy(false); setErr(`Upload failed — ${e?.message || "is the server running?"}`); return; }
    // processing runs in the background; land on the list, which polls PARSING → READY
    if (r.id) { location.hash = "#/"; }
    else { setBusy(false); setErr(`${(r.status || "error").replace(/_/g, " ")}${r.reason ? " — " + r.reason : ""}`); }
  };

  return (
    <div className="mx-auto max-w-[1080px]">
      <div className="mb-7">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">Upload statement</h1>
        <p className="mt-1.5 max-w-[62ch] text-[14px] leading-relaxed text-zinc-500">
          Drop a bank-statement PDF. BankIQ reconstructs the ledger, checks balance continuity, and returns a full analysis across 16 tabs.
        </p>
      </div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-5 md:grid-cols-[1.28fr_1fr]">
        {/* ---- left: the drop zone ---- */}
        <motion.section variants={rise}>
          <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400">Statement PDF</div>
          <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-soft">
            <div
              onClick={() => fi.current.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDrag(false); }}
              onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
              className={`group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors ${drag ? "border-accent bg-accent-soft" : "border-zinc-200 bg-zinc-50/60 hover:border-zinc-300 hover:bg-zinc-50"}`}
            >
              <motion.div
                animate={drag ? { y: -4, scale: 1.06 } : { y: [0, -6, 0] }}
                transition={drag ? spring : { duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
                className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${drag ? "bg-accent text-white" : "bg-white text-zinc-500 shadow-soft"}`}
              >
                <UploadSimple size={24} weight="bold" />
              </motion.div>
              <div className="mt-4 text-[15px] font-bold text-zinc-800">{drag ? "Release to add" : "Drop PDF here"}</div>
              <div className="mt-0.5 text-[12.5px] text-zinc-500">or <span className="font-semibold text-accent-fg">click to browse</span> · native-text PDF up to 25 MB</div>
              <input ref={fi} type="file" accept="application/pdf" className="hidden" onChange={(e) => pick(e.target.files[0])} />
            </div>

            <AnimatePresence>
              {file && (
                <motion.div
                  initial={{ opacity: 0, y: 8, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -6, height: 0 }}
                  transition={spring}
                  className="mt-3 flex items-center gap-3 rounded-2xl border border-accent-ring/60 bg-accent-soft px-3.5 py-3"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white shadow-soft"><FilePdf size={20} weight="fill" className="text-rose-500" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold text-zinc-800">{file.name}</div>
                    <div className="tnum text-[11.5px] text-accent-fg"><CheckCircle size={12} weight="fill" className="mb-px mr-1 inline" />Ready · {(file.size / 1048576).toFixed(1)} MB</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setFile(null); }} aria-label="Remove file" className="focusable grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-white hover:text-zinc-700"><X size={15} weight="bold" /></button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-4 flex flex-wrap items-center gap-1.5 px-1">
              <span className="mr-1 text-[11.5px] font-semibold text-zinc-500">Recognises</span>
              {BANKS.map((b) => (
                <span key={b} className="tnum rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">{b}</span>
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 px-1 text-[12px] text-zinc-500">
            <ShieldCheck size={15} weight="fill" className="text-accent-fg" />
            Parsed on your server — the PDF is never sent to a third party.
          </div>
        </motion.section>

        {/* ---- right: details ---- */}
        <motion.section variants={rise}>
          <div className="mb-2 flex items-center gap-2 px-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400">Applicant details</span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">Optional</span>
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-soft">
            <div className="flex flex-col gap-4">
              <Field label="PDF password" hint="if protected"><input type="password" className={inputCls} onChange={(e) => (f.current.password = e.target.value)} placeholder="e.g. BHUV1205" /></Field>
              <Field label="Applicant name" hint="name-match"><input className={inputCls} onChange={(e) => (f.current.applicant_name = e.target.value)} placeholder="As per application" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Reference / LOS ID"><input className={inputCls} onChange={(e) => (f.current.reference_id = e.target.value)} placeholder="LOS-00123" /></Field>
                <Field label="Proposed EMI" hint="₹"><input type="number" className={`${inputCls} tnum`} onChange={(e) => (f.current.proposed_emi = e.target.value)} placeholder="15000" /></Field>
              </div>
              <Field label="Product"><select className={inputCls} onChange={(e) => (f.current.product = e.target.value)}><option value="">—</option><option>personal</option><option>LAP</option><option>MSME</option></select></Field>
            </div>

            <motion.button
              disabled={!file || busy} onClick={submit}
              whileHover={file && !busy ? { y: -1.5 } : {}}
              whileTap={file && !busy ? { scale: 0.98 } : {}}
              onTapStart={() => { if (file && !busy) haptic(16); }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className="focusable mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-[14px] font-semibold text-white shadow-soft transition-colors enabled:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? <><CircleNotch size={17} weight="bold" className="animate-spin" /> Parsing statement…</> : <>Process statement <ArrowRight size={16} weight="bold" /></>}
            </motion.button>

            <AnimatePresence>
              {err && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 rounded-xl bg-rose-50 px-3 py-2.5 text-[12.5px] font-medium text-rose-700 ring-1 ring-inset ring-rose-200">{err}</motion.p>
              )}
            </AnimatePresence>
            {!err && <p className="mt-3 text-center text-[11.5px] text-zinc-400">Analysis usually completes in a few seconds.</p>}
          </div>
        </motion.section>
      </motion.div>
    </div>
  );
}
