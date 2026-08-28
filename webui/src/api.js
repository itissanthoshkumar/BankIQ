// API client + formatting helpers
const J = (r) => r.json();

export const api = {
  list: () => fetch("/api/statements").then(J),
  get: (id) => fetch("/api/statements/" + id).then(async (r) => ({ ok: r.ok, status: r.status, body: await r.json() })),
  upload: (fd) => fetch("/api/upload", { method: "POST", body: fd }).then(async (r) => {
    if (!r.ok) { const t = await r.text().catch(() => ""); throw new Error(`server error ${r.status}${t ? " — " + t.slice(0, 140) : ""}`); }
    return r.json();
  }),
  retry: (id, pw) => { const fd = new FormData(); fd.append("password", pw); return fetch(`/api/statements/${id}/password`, { method: "POST", body: fd }).then(J); },
  del: (id) => fetch("/api/statements/" + id, { method: "DELETE" }).then(J),
  xlsx: (id) => `/api/statements/${id}/report.xlsx`,
  json: (id) => `/api/statements/${id}/result.json`,
};

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const inr = (n, dec = 0) =>
  n === null || n === undefined ? "—" : "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const num = (n, dec = 0) =>
  n === null || n === undefined ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const fmtDate = (iso) => { if (!iso) return "—"; const d = new Date(iso); return String(d.getDate()).padStart(2, "0") + "-" + MON[d.getMonth()] + "-" + d.getFullYear(); };
export const monthLabel = (iso) => { const d = new Date(iso); return MON[d.getMonth()] + " " + String(d.getFullYear()).slice(2); };
export const initials = (s) => { const w = (s || "?").replace(/[^A-Za-z ]/g, "").trim().split(/\s+/); return ((w[0] || "?")[0] + ((w[1] || "")[0] || "")).toUpperCase(); };
const AV = ["#0d9488", "#4f46e5", "#b45309", "#be123c", "#0369a1", "#7c3aed", "#15803d", "#c2410c"];
export const avColor = (s) => { let h = 0; for (const c of s || "?") h = (h * 31 + c.charCodeAt(0)) >>> 0; return AV[h % AV.length]; };
