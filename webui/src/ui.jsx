import { motion, useMotionValue, useTransform, animate, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Question, ShieldCheck } from "@phosphor-icons/react";
import { num } from "./api";

export const spring = { type: "spring", stiffness: 120, damping: 20 };
export const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } } };
export const rise = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: spring },
};

// ── tactile feedback ─────────────────────────────────────────────
// real haptic buzz on devices that support it (mobile); silent no-op elsewhere
export const haptic = (ms = 7) => { try { navigator.vibrate && navigator.vibrate(ms); } catch {} };
// spread onto any framer-motion element: springy hover-lift + press-scale + a haptic tick
export const tactile = {
  whileHover: { y: -1.5 },
  whileTap: { scale: 0.94 },
  onTapStart: () => haptic(),
  transition: { type: "spring", stiffness: 400, damping: 22 },
};
// same, but a gentler lift for large surfaces (rows, cards)
export const tactileSoft = {
  whileHover: { y: -2 },
  whileTap: { scale: 0.985 },
  onTapStart: () => haptic(5),
  transition: { type: "spring", stiffness: 320, damping: 26 },
};

// count-up number (spring-eased), respects reduced motion
export function Count({ value, dec = 0, prefix = "", suffix = "", className = "" }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const out = useTransform(mv, (v) => prefix + num(v, dec) + suffix);
  const [txt, setTxt] = useState(prefix + num(value ?? 0, dec) + suffix);
  useEffect(() => {
    if (value == null || !isFinite(value)) { setTxt("—"); return; }
    if (reduce) { setTxt(prefix + num(value, dec) + suffix); return; }
    const un = out.on("change", setTxt);
    const controls = animate(mv, value, { duration: 0.7, ease: [0.16, 1, 0.3, 1] });
    return () => { un(); controls.stop(); };
  }, [value]); // eslint-disable-line
  return <span className={className}>{txt}</span>;
}

// ── in-context help tooltip ─────────────────────────────────────
// A tiny "?" that reveals the Guide entry for a field right where the field is.
// Hover on desktop, tap on touch; fixed-position popover so it never clips
// inside scrolling tables. Pass {title, what, how, ex} (from guideContent.helpFor).
export function Help({ title, what, how, ex, className = "" }) {
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const openAt = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const W = 300, m = 8;
    const left = Math.min(Math.max(m, r.left + r.width / 2 - W / 2), window.innerWidth - W - m);
    const up = window.innerHeight - r.bottom < 230;
    setPos({ left, top: r.bottom + 6, bottom: window.innerHeight - r.top + 6, up });
  };
  const close = () => setPos(null);
  useEffect(() => {
    if (!pos) return;
    const esc = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("keydown", esc); };
  }, [pos]);
  if (!how) return null;
  return (
    <span className={`relative inline-flex ${className}`} onMouseEnter={openAt} onMouseLeave={close}>
      <button ref={ref} type="button" aria-label={`About: ${title}`}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); pos ? close() : openAt(); }}
        className="focusable grid h-4 w-4 cursor-help place-items-center rounded-full text-zinc-300 transition-colors hover:text-accent-fg">
        <Question size={13} weight="bold" />
      </button>
      {pos && (
        <div role="tooltip"
          className="fixed z-50 w-[300px] whitespace-normal rounded-xl border border-zinc-200 bg-white p-3.5 text-left font-normal normal-case tracking-normal shadow-diffuse"
          style={pos.up ? { left: pos.left, bottom: pos.bottom } : { left: pos.left, top: pos.top }}>
          <div className="text-[12.5px] font-bold leading-snug text-zinc-900">{title}</div>
          {what && <div className="mt-0.5 text-[12px] leading-relaxed text-zinc-600">{what}</div>}
          <div className="mt-1.5 text-[11.5px] leading-relaxed text-zinc-500"><span className="font-semibold text-accent-fg">How — </span>{how}</div>
          {ex && <div className="mt-1 text-[11.5px] leading-relaxed text-zinc-500"><span className="font-semibold text-zinc-600">Example — </span>{ex}</div>}
        </div>
      )}
    </span>
  );
}

// zero-storage promise, stated where the data is
export function PrivacyBanner({ minutes = 60, className = "" }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-xl bg-accent-soft px-4 py-2.5 text-[12.5px] font-medium text-accent-fg ring-1 ring-inset ring-accent-ring/50 ${className}`}>
      <ShieldCheck size={17} weight="fill" className="shrink-0" />
      <span>Nothing is stored — statements are processed in memory only, auto-deleted after {minutes} min, and gone the moment the server restarts.</span>
    </div>
  );
}

export const sevClass = {
  RED: "bg-rose-50 text-rose-700 ring-rose-200",
  CRITICAL: "bg-rose-50 text-rose-700 ring-rose-200",
  AMBER: "bg-amber-50 text-amber-700 ring-amber-200",
  WARN: "bg-amber-50 text-amber-700 ring-amber-200",
  GREEN: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  INFO: "bg-zinc-100 text-zinc-500 ring-zinc-200",
};
export const Sev = ({ s }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ring-1 ring-inset ${sevClass[s] || sevClass.INFO}`}>{s}</span>
);
export const dot = { RED: "bg-rose-500", CRITICAL: "bg-rose-500", AMBER: "bg-amber-500", WARN: "bg-amber-500", GREEN: "bg-emerald-500", INFO: "bg-zinc-300" };

export function Card({ className = "", children, hover = false }) {
  return (
    <div className={`rounded-3xl border border-zinc-200/70 bg-white shadow-diffuse ${hover ? "transition-transform active:scale-[0.99]" : ""} ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, right, help }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h3 className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
        {children}{help && <Help {...help} />}
      </h3>
      {right}
    </div>
  );
}

export function Skeleton({ className = "" }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-zinc-100 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
    </div>
  );
}

export function Empty({ title, hint, icon }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-12 text-center">
      {icon}
      <div className="font-semibold text-zinc-700">{title}</div>
      {hint && <div className="max-w-sm text-sm text-zinc-500">{hint}</div>}
    </div>
  );
}

// horizontal proportional bar row
export function BarRow({ label, value, max, tint = "bg-accent" }) {
  const w = max ? Math.max(2, (Math.abs(value) / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-[13px]">
      <span className="w-40 shrink-0 truncate text-zinc-600" title={label}>{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
        <motion.span className={`block h-full rounded-full ${tint}`} initial={{ width: 0 }} animate={{ width: w + "%" }} transition={{ ...spring, damping: 24 }} />
      </span>
      <span className="tnum w-28 text-right text-zinc-500">{typeof value === "number" ? num(value) : value}</span>
    </div>
  );
}

// data table — 1px divided rows, mono numbers, sticky header
export function DataTable({ cols, rows, empty, maxH = "64vh" }) {
  if (!rows || !rows.length) return empty || <Empty title="No data" />;
  return (
    <div className="overflow-auto rounded-2xl border border-zinc-200" style={{ maxHeight: maxH }}>
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={i} className={`sticky top-0 z-10 whitespace-nowrap border-b border-zinc-200 bg-zinc-50/95 px-3 py-2 text-[10.5px] font-bold uppercase tracking-wider text-zinc-400 backdrop-blur ${c.num ? "text-right" : "text-left"}`}>
                {c.help ? <span className={`inline-flex items-center gap-1 ${c.num ? "justify-end" : ""}`}>{c.h}<Help {...c.help} /></span> : c.h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/70">
              {cols.map((c, ci) => (
                <td key={ci} className={`whitespace-nowrap px-3 py-2 ${c.num ? "tnum text-right" : ""} ${c.cls ? c.cls(r) : ""}`}>{c.cell(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const Pill = ({ children, tone = "zinc" }) => (
  <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-medium ${tone === "accent" ? "bg-accent-soft text-accent-fg" : "bg-zinc-100 text-zinc-600"}`}>{children}</span>
);

export const MItem = ({ children, className = "" }) => (
  <motion.div variants={rise} className={className}>{children}</motion.div>
);
