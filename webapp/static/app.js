/* BankingIQ single-page app — vanilla JS, renders from the JSON API. */
const app = document.getElementById("app");
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/* ---------- helpers ---------- */
const inr = (n, dec = 0) => n === null || n === undefined ? "—" :
  "₹" + Number(n).toLocaleString("en-IN", {minimumFractionDigits: dec, maximumFractionDigits: dec});
const num = (n, dec = 0) => n === null || n === undefined ? "—" :
  Number(n).toLocaleString("en-IN", {minimumFractionDigits: dec, maximumFractionDigits: dec});
function fmtDate(iso){ if(!iso) return "—"; const d=new Date(iso);
  return String(d.getDate()).padStart(2,"0")+"-"+MONTHS[d.getMonth()]+"-"+d.getFullYear(); }
function monthLabel(iso){ const d=new Date(iso); return MONTHS[d.getMonth()]+"-"+String(d.getFullYear()).slice(2); }
const esc = s => (s==null?"":String(s)).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function el(html){ const t=document.createElement("template"); t.innerHTML=html.trim(); return t.content.firstElementChild; }
function toast(msg){ const t=el(`<div class="toast">${esc(msg)}</div>`); document.body.appendChild(t); setTimeout(()=>t.remove(),2600); }
const REDUCE=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
/* jump from a flag drill-down to the Transactions tab, pre-searched to that txn */
let TX_SEARCH=null;
window.jumpToTxn=d=>{ TX_SEARCH=d; setActive("transactions"); };
/* CountUp: animate [data-count] numbers from 0 (React-Bits-style, vanilla) */
function animateCounts(root){
  (root||document).querySelectorAll("[data-count]").forEach(elm=>{
    const target=parseFloat(elm.dataset.count);
    const dec=+(elm.dataset.dec||0), pfx=elm.dataset.pfx||"", sfx=elm.dataset.sfx||"";
    const f=v=>pfx+Number(v).toLocaleString("en-IN",{minimumFractionDigits:dec,maximumFractionDigits:dec})+sfx;
    if(REDUCE||!isFinite(target)){ elm.textContent=f(target); return; }
    const dur=680, t0=performance.now();
    const step=now=>{ let p=Math.min(1,(now-t0)/dur); p=1-Math.pow(1-p,3);
      elm.textContent=f(target*p); if(p<1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

/* inline Lucide-style icons for colorful stat cards */
const ICONS={
  wallet:'<path d="M19 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/><circle cx="18" cy="14" r="1.4"/>',
  up:'<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  down:'<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',
  swap:'<path d="m8 3-5 4 5 4"/><path d="M3 7h16"/><path d="m16 21 5-4-5-4"/><path d="M21 17H5"/>',
  bank:'<line x1="3" x2="21" y1="21" y2="21"/><path d="M5 21V10"/><path d="M9.5 21V10"/><path d="M14.5 21V10"/><path d="M19 21V10"/><path d="m3 10 9-6 9 6"/>',
  percent:'<line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>'
};
const ic=n=>`<svg viewBox="0 0 24 24">${ICONS[n]||""}</svg>`;
const AV_PALETTE=["#0176D3","#0f9d58","#7c3aed","#e11d48","#b45309","#0d9488","#4f46e5","#c2410c"];
function avColor(s){ let h=0; for(const c of (s||"?")) h=(h*31+c.charCodeAt(0))>>>0; return AV_PALETTE[h%AV_PALETTE.length]; }
function initials(s){ const w=(s||"?").replace(/[^A-Za-z ]/g,"").trim().split(/\s+/); return ((w[0]||"?")[0]+((w[1]||"")[0]||"")).toUpperCase(); }

const api = {
  list: () => fetch("/api/statements").then(r=>r.json()),
  get: id => fetch("/api/statements/"+id).then(async r=>({ok:r.ok,status:r.status,body:await r.json()})),
  upload: fd => fetch("/api/upload",{method:"POST",body:fd}).then(r=>r.json()),
  retry: (id,pw) => { const fd=new FormData(); fd.append("password",pw);
    return fetch(`/api/statements/${id}/password`,{method:"POST",body:fd}).then(r=>r.json()); },
  del: id => fetch("/api/statements/"+id,{method:"DELETE"}).then(r=>r.json()),
};

/* ---------- router ---------- */
window.addEventListener("hashchange", route);
window.addEventListener("load", route);
function route(){
  const h = location.hash || "#/";
  if(h.startsWith("#/statement/")) return renderViewer(h.split("/")[2]);
  if(h === "#/upload") return renderUpload();
  return renderHome();
}

/* ---------- home ---------- */
async function renderHome(){
  app.innerHTML = `<div class="vbar"><div class="who">Statements</div><div class="spacer"></div>
    <a class="btn orange shimmer" href="#/upload">+ Upload statement</a></div>
    <div class="card"><div class="bd" id="listbd"><div class="empty">Loading…</div></div></div>`;
  const rows = await api.list();
  const bd = document.getElementById("listbd");
  if(!rows.length){ bd.innerHTML = `<div class="empty">No statements yet.<br><a class="btn orange shimmer" style="margin-top:12px;display:inline-block" href="#/upload">Upload your first statement</a></div>`; return; }
  bd.innerHTML = `<table class="list"><thead><tr>
    <th>Uploaded</th><th>Customer</th><th>Bank</th><th>Period</th><th>Status</th><th>Grade</th><th></th></tr></thead>
    <tbody>${rows.map(r=>`<tr>
      <td class="muted">${esc(r.uploaded_at.replace("T"," "))}</td>
      <td><div class="cust"><span class="bankav" style="background:${avColor(r.name||r.filename)}">${initials(r.name||r.filename)}</span><strong>${esc(r.name||r.filename)}</strong></div></td>
      <td>${esc(r.bank||"—")}</td>
      <td class="muted">${esc(r.period||"—")}</td>
      <td><span class="chip ${r.status}">${r.status.replace(/_/g," ")}</span>${r.reason?`<div class="muted" style="font-size:11px;margin-top:3px">${esc(r.reason)}</div>`:""}</td>
      <td>${r.grade?`<span class="gradebadge g-${r.grade}">${r.grade}</span>`:"—"}</td>
      <td>${r.status==="READY"?`<a class="btn ghost sm" href="#/statement/${r.id}">View</a>`:
           r.status==="NEEDS_PASSWORD"?`<button class="btn ghost sm" onclick="pwRetry('${r.id}')">Password</button>`:""}
        <button class="btn ghost sm" onclick="delStmt('${r.id}')">✕</button></td>
    </tr>`).join("")}</tbody></table>`;
  // poll if any in-flight
  if(rows.some(r=>["PARSING","ANALYZING","QUEUED"].includes(r.status))) setTimeout(()=>{ if(location.hash==="#/"||!location.hash) renderHome(); }, 2500);
}
window.delStmt = async id => { if(!confirm("Delete this statement?"))return; await api.del(id); renderHome(); };
window.pwRetry = async id => { const pw=prompt("Enter PDF password:"); if(!pw)return; toast("Retrying…"); const r=await api.retry(id,pw);
  if(r.status==="READY"){ location.hash="#/statement/"+id; } else { toast(r.reason||"Still locked"); renderHome(); } };

/* ---------- upload ---------- */
function renderUpload(){
  app.innerHTML = `<div class="vbar"><div class="who">Upload statement</div></div>
  <div class="grid-2">
    <div class="card"><div class="hd"><h2>Statement PDF</h2><p>Drag &amp; drop or browse. Native-text PDF, ≤ 25 MB.</p></div>
      <div class="bd">
        <div class="dropzone" id="dz"><div class="big">Drop PDF here</div><div class="sub">or click to browse</div>
          <input type="file" id="file" accept="application/pdf" style="display:none"></div>
        <div class="filelist" id="fl"></div>
      </div></div>
    <div class="card"><div class="hd"><h2>Details</h2><p>Optional — unlocks name-match &amp; FOIR context.</p></div>
      <div class="bd">
        <label class="fld"><span>PDF password (if protected)</span><input type="password" id="pw" placeholder="e.g. BHUV1205"></label>
        <label class="fld"><span>Applicant name (name-match)</span><input id="an" placeholder="As per application"></label>
        <div class="row2">
          <label class="fld"><span>Reference / LOS ID</span><input id="ref" placeholder="LOS-00123"></label>
          <label class="fld"><span>Proposed EMI ₹</span><input id="emi" type="number" placeholder="15000"></label>
        </div>
        <label class="fld"><span>Product</span><select id="prod">
          <option value="">—</option><option>personal</option><option>LAP</option><option>MSME</option></select></label>
        <button class="btn orange shimmer" id="go" style="width:100%;margin-top:6px" disabled>Process statement</button>
        <div id="upstatus" class="muted" style="margin-top:12px;font-size:12.5px"></div>
      </div></div>
  </div>`;
  let picked = null;
  const dz=document.getElementById("dz"), fi=document.getElementById("file"), fl=document.getElementById("fl"), go=document.getElementById("go");
  const setFile = f => { picked=f; go.disabled=!f;
    fl.innerHTML = f?`<div class="fileitem"><span>📄</span><span class="nm">${esc(f.name)}</span><span class="muted">${(f.size/1024/1024).toFixed(1)} MB</span><button class="rm" onclick="this.closest('.fileitem').remove()">✕</button></div>`:""; };
  dz.onclick=()=>fi.click();
  fi.onchange=e=>setFile(e.target.files[0]);
  ["dragover","dragenter"].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add("drag");}));
  ["dragleave","drop"].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove("drag");}));
  dz.addEventListener("drop",e=>{ const f=e.dataTransfer.files[0]; if(f&&f.type==="application/pdf")setFile(f); else toast("PDF only"); });
  go.onclick=async()=>{
    if(!picked)return;
    go.disabled=true; go.innerHTML=`<span class="spin"></span> Processing…`;
    document.getElementById("upstatus").textContent="Parsing, categorizing and analyzing… (this can take up to a minute)";
    const fd=new FormData();
    fd.append("file",picked); fd.append("password",document.getElementById("pw").value);
    fd.append("applicant_name",document.getElementById("an").value);
    fd.append("reference_id",document.getElementById("ref").value);
    fd.append("proposed_emi",document.getElementById("emi").value);
    fd.append("product",document.getElementById("prod").value);
    let r; try{ r=await api.upload(fd); }catch(e){ go.disabled=false; go.textContent="Process statement"; toast("Upload failed"); return; }
    if(r.status==="READY"){ location.hash="#/statement/"+r.id; }
    else { go.disabled=false; go.textContent="Process statement";
      document.getElementById("upstatus").innerHTML=`<span style="color:var(--red)">${esc(r.status.replace(/_/g," "))}: ${esc(r.reason||"")}</span>`; }
  };
}

/* ---------- viewer ---------- */
const TABS = [
  ["summary","Summary","Overview"],["character","Character","Overview"],["analysis","Analysis","Overview"],["fullanalysis","Analysis (Full)","Overview"],["insights","Insights","Overview"],
  ["transactions","Transactions","Transactions"],["upi","UPI Analysis","Transactions"],["highvalue","High Value","Transactions"],
  ["spend","Spend Analysis","Money"],["loans","Loan Analysis","Money"],["cashflow","Cash & Rails","Money"],["parties","Parties","Money"],
  ["avgbal","Avg Bal (3rd/4th)","Balances"],["daily","Daily Balance","Balances"],
  ["flags","Flags (FCU)","Risk"],["qc","Validation & QC","Risk"],
];
let PAYLOAD=null, ACTIVE="summary";
async function renderViewer(id){
  app.innerHTML = `<div class="empty">Loading report…</div>`;
  const res = await api.get(id);
  if(!res.ok){ app.innerHTML=`<div class="card"><div class="bd empty">
    <b>${esc(res.body.status||"Not ready")}</b><br>${esc(res.body.reason||"")}<br>
    <a class="btn ghost sm" style="margin-top:12px;display:inline-block" href="#/">← Back</a></div></div>`; return; }
  PAYLOAD=res.body; ACTIVE=(location.hash.split("/")[3])||"summary";
  const s=PAYLOAD.summary, g=PAYLOAD.grade;
  const suspect = PAYLOAD._record && PAYLOAD._record.status==="EXTRACTION_SUSPECT";
  app.innerHTML = `
   <div class="vbar">
     <span class="gradebadge g-${g.grade}" style="width:34px;height:34px;font-size:18px">${g.grade}</span>
     <div><div class="who">${esc(s.name||"—")}</div>
       <div class="meta">${esc(s.bank)} · A/c ****${esc((s.account_no||"").slice(-4))} · ${fmtDate(s.period_start)} → ${fmtDate(s.period_end)} · ${num(s.txn_count)} txns</div></div>
     <div class="spacer"></div>
     <a class="btn ghost sm" href="/api/statements/${id}/report.xlsx">⬇ XLSX</a>
     <a class="btn ghost sm" href="/api/statements/${id}/result.json">⬇ JSON</a>
     <a class="btn ghost sm" href="#/">← All</a>
   </div>
   ${suspect?`<div class="banner suspect">⚠ Extraction suspect — balance continuity did not fully reconcile. Review before use.</div>`:""}
   <div class="viewer">
     <nav class="railnav" id="rail"></nav>
     <div class="viewbody" id="vbody"></div>
   </div>`;
  let railHtml="", lastGrp=null;
  TABS.forEach(([k,l,grp])=>{
    if(grp!==lastGrp){ railHtml+=`<div class="grp">${grp}</div>`; lastGrp=grp; }
    railHtml+=`<a href="#/statement/${id}/${k}" data-k="${k}" class="${k===ACTIVE?"active":""}" onclick="setActive('${k}')">${l}</a>`;
  });
  document.getElementById("rail").innerHTML = railHtml;
  drawTab();
}
window.setActive = k => { ACTIVE=k; document.querySelectorAll(".railnav a").forEach(a=>a.classList.toggle("active",a.dataset.k===k)); drawTab(); };

function drawTab(){
  const b=document.getElementById("vbody"); if(!b)return;
  b.innerHTML=""; b.scrollTop=0;
  ({summary:tabSummary, analysis:tabAnalysis, transactions:tabTxns, insights:tabInsights,
    cashflow:tabCashRails, parties:tabParties, flags:tabFlags, highvalue:tabHighValue,
    upi:tabUPI, spend:tabSpend, loans:tabLoans, avgbal:tabAvgBal, daily:tabDaily, qc:tabQC,
    fullanalysis:tabFullAnalysis, character:tabCharacter}[ACTIVE]||tabSummary)(b);
}

/* --- Character (how to read the borrower's character) --- */
function tabCharacter(b){
  const groups=PAYLOAD.character||[];
  const g=PAYLOAD.grade;
  b.appendChild(el(`<div class="sec-h">Character read — every signal we can derive</div>`));
  b.appendChild(el(`<div class="charhero">
    <span class="gradebadge g-${g.grade}" style="width:40px;height:40px;font-size:20px">${g.grade}</span>
    <div><b>Character grade ${g.grade}</b> · score ${g.score}/100<div class="muted" style="font-size:12px">${g.reasons.length?esc(g.reasons.join(" · ")):"No adverse signals of note."}</div></div>
    <span class="charleg"><span class="dot sev-RED"></span>Adverse <span class="dot sev-AMBER"></span>Watch <span class="dot sev-GREEN"></span>Positive <span class="dot sev-INFO"></span>Neutral</span>
  </div>`));
  groups.forEach(grp=>{
    const sec=el(`<div class="char-group"><div class="char-gh"><h4>${esc(grp.group)}</h4><span class="muted">${esc(grp.desc||"")}</span></div><div class="char-grid"></div></div>`);
    const grid=sec.querySelector(".char-grid");
    grp.signals.forEach((s,i)=>{
      const amt=(s.amount&&s.amount>0)?`<span class="char-amt">${inr(s.amount)}</span>`:"";
      grid.appendChild(el(`<div class="char-sig sev-${s.severity} rise" style="animation-delay:${i*35}ms">
        <div class="char-top"><span class="char-lab">${esc(s.label)}</span><span class="sev ${s.severity}">${s.severity}</span></div>
        <div class="char-note">${esc(s.note||"")}</div>${amt}</div>`));
    });
    b.appendChild(sec);
  });
}

/* --- summary (redesigned) --- */
function tabSummary(b){
  const p=PAYLOAD, s=p.summary, g=p.grade, bh=p.balance_hygiene, q=p.qc||{};
  const months=Math.max(s.months_analyzed,1);
  const monthlyInc=Math.round(s.classified_income/months);
  const surplus=Math.round(s.gross_credits-s.gross_debits);
  const life=p.lifestyle.filter(l=>l.fired);
  const cautions=p.flags.filter(f=>f.fired && (f.severity==="CRITICAL"||f.severity==="WARN"||f.severity==="RED"));
  const topLender=(p.loan_analysis||[])[0];
  const dominant=p.parties[0];
  const settle=p.transactions.filter(t=>t.category==="UPI Settlement").length;
  const salaryTxns=(p.salary||[]).length;
  const incomeType=settle>20?"Merchant / QR settlements":salaryTxns>0?"Salaried":"Mixed / transfers";
  const cashCycle=p.flags.find(f=>f.id==="F02");
  const roundTrip=p.flags.find(f=>f.id==="F03");
  const keyDate=(p.avg_closing_3_4||{}).overall_avg;
  const verified=q.balance_continuity_breaks===0;

  // account band
  b.appendChild(el(`<div class="sumband">
    ${[["Account holder",esc(s.name)],["Bank",esc(s.bank)],["Account","****"+esc((s.account_no||"").slice(-4))],
      ["Type",esc(s.account_type||"—")],["Period",fmtDate(s.period_start)+" → "+fmtDate(s.period_end)],
      ["Transactions",num(s.txn_count)]].map(([l,v])=>`<div class="it"><span class="l">${l}</span><span class="v">${v}</span></div>`).join("")}
    <span class="ok ${verified?"":"bad"}">${verified?`✓ Extraction verified · ${num(s.txn_count)} txns · 0 continuity errors`:`⚠ ${num(q.balance_continuity_breaks)} continuity break(s)`}</span>
  </div>`));

  // hero: grade + headline KPIs (with CountUp + staggered entrance)
  const cards=[
    ["Monthly income",monthlyInc,"c-emerald","wallet",{pfx:"₹"}],
    ["Gross credits",s.gross_credits,"c-sky","up",{pfx:"₹"}],
    ["Gross debits",s.gross_debits,"c-rose","down",{pfx:"₹"}],
    ["Net surplus",surplus,surplus<0?"c-rose":"c-violet","swap",{pfx:"₹"}],
    ["Obligations",s.total_obligations,s.obligation_to_inflow_pct>30?"warn":"c-amber","bank",{pfx:"₹"}],
    ["Obligation / inflow",s.obligation_to_inflow_pct,s.obligation_to_inflow_pct>30?"warn":"c-indigo","percent",{sfx:"%",dec:1}],
  ];
  const kpiHtml=cards.map(([l,v,acc,icon,o],i)=>{
    o=o||{};
    const body=(v==null||!isFinite(v))?`<div class="v">—</div>`
      :`<div class="v" data-count="${v}" data-pfx="${o.pfx||""}" data-sfx="${o.sfx||""}" data-dec="${o.dec||0}">${(o.pfx||"")+num(v,o.dec||0)+(o.sfx||"")}</div>`;
    return `<div class="k ${acc} rise" style="animation-delay:${i*45}ms">
      <div class="kicon">${ic(icon)}</div><div class="kt"><div class="l">${l}</div>${body}</div></div>`;
  }).join("");
  const hero=el(`<div class="herorow">
    <div class="hero-grade">
      <div class="top"><div class="let">${g.grade}</div>
        <div><div class="sc">Character grade ${g.grade}</div><div class="scsub">score <span data-count="${g.score}">${g.score}</span> / 100</div></div></div>
      <div class="scorebar"><span></span></div>
      <div class="rz">${g.reasons.length?esc(g.reasons.join(" · ")):"No adverse signals of note."}</div>
    </div>
    <div class="hero-kpi">${kpiHtml}</div>
  </div>`);
  b.appendChild(hero);
  animateCounts(hero);
  requestAnimationFrame(()=>{ const bar=hero.querySelector(".scorebar span"); if(bar) bar.style.transform="scaleX("+(g.score/100)+")"; });

  // two columns: narrative+cautions | income/obligations + behaviour
  const left=el(`<div></div>`);
  const nar=el(`<div class="panel"><h4>What the account shows</h4></div>`);
  p.narrative.forEach(t=>nar.appendChild(el(`<div class="prow"><span class="k" style="text-align:left;flex:1">${/^⚠/.test(t)?"":""}${esc(t)}</span></div>`)));
  left.appendChild(nar);
  if(cautions.length){
    const cp=el(`<div class="panel"><h4>Cautions</h4></div>`);
    cautions.forEach(f=>cp.appendChild(el(`<div class="prow"><span class="k" style="text-align:left"><b>${esc(f.id)}</b> ${esc(f.name)}</span>
      <span class="v bad">${f.count} hit(s) <a href="#" onclick="setActive('flags');return false;">→</a></span></div>`)));
    left.appendChild(cp);
  }

  const right=el(`<div></div>`);
  const io=el(`<div class="panel"><h4>Income &amp; obligations</h4></div>`);
  [["Income type",incomeType],["Monthly avg income",inr(monthlyInc)],
   ["Classified income",inr(s.classified_income)],["Active lenders",topLender?num(p.loan_analysis.length):"0"],
   ["Top lender",topLender?`${esc(topLender.lender)} · ${inr(topLender.total)}`:"—"],
   ["Obligation / inflow",s.obligation_to_inflow_pct==null?"—":s.obligation_to_inflow_pct+"%",s.obligation_to_inflow_pct>30?"warn":""]]
   .forEach(([k,v,c])=>io.appendChild(el(`<div class="prow"><span class="k">${k}</span><span class="v ${c||""}">${v}</span></div>`)));
  right.appendChild(io);

  const beh=el(`<div class="panel"><h4>Behaviour &amp; risk</h4></div>`);
  [["Lifestyle flags",life.length?life.map(l=>l.flag).join(", "):"None",life.length?"warn":"good"],
   ["Cash-cycle (F02)",cashCycle&&cashCycle.fired?`${cashCycle.count} instances`:"None",cashCycle&&cashCycle.fired?"bad":"good"],
   ["Round-tripping (F03)",roundTrip&&roundTrip.fired?`${roundTrip.count} parties`:"None",roundTrip&&roundTrip.fired?"warn":"good"],
   ["Min balance",inr(bh.min_balance),bh.min_balance<100?"warn":""],
   ["Days below ₹1,000",num(bh.days_below_1000)+" / "+num(bh.total_days)],
   ["Avg bal 3rd/4th",keyDate==null?"—":inr(keyDate)],
   ["Dominant payee",dominant?esc(dominant.party):"—"]]
   .forEach(([k,v,c])=>beh.appendChild(el(`<div class="prow"><span class="k">${k}</span><span class="v ${c||""}">${v}</span></div>`)));
  right.appendChild(beh);

  const two=el(`<div class="twocol"></div>`); two.appendChild(left); two.appendChild(right);
  b.appendChild(two);
}

/* --- analysis --- */
function tabAnalysis(b){
  const p=PAYLOAD;
  const head = `<tr><th>Metric</th>${p.months.map(m=>`<th class="num">${monthLabel(m)}</th>`).join("")}<th class="num">TOTAL</th></tr>`;
  const body = p.analysis.map(r=>{
    const isAmt=/Amount|Credits|Debits/.test(r.metric) && !/Count/.test(r.metric);
    const cell=v=> isAmt? num(v,2) : num(v);
    return `<tr><td>${esc(r.metric)}</td>${r.values.map(v=>`<td class="num">${cell(v)}</td>`).join("")}<td class="num"><b>${cell(r.total)}</b></td></tr>`;
  }).join("");
  b.appendChild(el(`<div class="sec-h">Monthwise analysis</div>`));
  b.appendChild(el(`<div class="tablescroll"><table class="data"><thead>${head}</thead><tbody>${body}</tbody></table></div>`));
}

/* --- Full Analysis (Digitap parity, ~150 metrics × month + Overall) --- */
function tabFullAnalysis(b){
  const d=PAYLOAD.digitap_analysis;
  if(!d){ b.appendChild(el(`<div class="muted">Not available.</div>`)); return; }
  b.appendChild(el(`<div class="sec-h">Analysis — full metric set (Digitap parity)</div>`));
  b.appendChild(el(`<div class="filters"><input id="faq" placeholder="Filter metrics…" style="min-width:240px">
    <span class="count">${num(d.metrics.length)} metrics · ${d.months.length} months + Overall</span></div>`));
  const head=`<tr><th>Metric</th>${d.months.map(m=>`<th class="num">${monthLabel(m)}</th>`).join("")}<th class="num">Overall</th></tr>`;
  const fmtv=v=>v===""||v===null||v===undefined?"":(typeof v==="number"?num(v,Number.isInteger(v)?0:2):esc(v));
  const wrap=el(`<div class="tablescroll"><table class="data"><thead>${head}</thead><tbody id="fab"></tbody></table></div>`);
  b.appendChild(wrap);
  const render=()=>{
    const q=(document.getElementById("faq").value||"").toLowerCase();
    const rows=d.metrics.filter(r=>!q||r.label.toLowerCase().includes(q));
    document.getElementById("fab").innerHTML=rows.map(r=>`<tr>
      <td>${esc(r.label)}</td>${r.values.map(v=>`<td class="num">${fmtv(v)}</td>`).join("")}
      <td class="num"><b>${fmtv(r.overall)}</b></td></tr>`).join("");
  };
  document.getElementById("faq").addEventListener("input",render);
  render();
}

/* --- transactions --- */
function tabTxns(b){
  const p=PAYLOAD, tx=p.transactions;
  const cats=[...new Set(tx.map(t=>t.category))].sort();
  const rails=[...new Set(tx.map(t=>t.rail))].sort();
  b.appendChild(el(`<div class="filters">
    <input id="fq" placeholder="Search description…">
    <select id="fc"><option value="">All categories</option>${cats.map(c=>`<option>${esc(c)}</option>`).join("")}</select>
    <select id="fr"><option value="">All rails</option>${rails.map(r=>`<option>${esc(r)}</option>`).join("")}</select>
    <select id="fd"><option value="">Cr + Dr</option><option value="cr">Credits</option><option value="dr">Debits</option></select>
    <span class="count" id="fcount"></span></div>`));
  const wrap=el(`<div class="tablescroll"><table class="data"><thead><tr>
    <th class="num">#</th><th>Date</th><th>Description</th><th class="num">Debit</th><th class="num">Credit</th>
    <th class="num">Balance</th><th>Category</th><th>Remitter / Beneficiary</th><th>Rail</th></tr></thead><tbody id="txb"></tbody></table></div>`);
  b.appendChild(wrap);
  const render=()=>{
    const q=(document.getElementById("fq").value||"").toLowerCase();
    const fc=document.getElementById("fc").value, fr=document.getElementById("fr").value, fdv=document.getElementById("fd").value;
    let rows=tx.filter(t=>(!q||t.description.toLowerCase().includes(q))&&(!fc||t.category===fc)&&(!fr||t.rail===fr)
      &&(!fdv||(fdv==="cr"?t.credit:t.debit)));
    document.getElementById("fcount").textContent=`${num(rows.length)} of ${num(tx.length)}`;
    rows=rows.slice(0,1500);
    document.getElementById("txb").innerHTML=rows.length?rows.map(t=>`<tr>
      <td class="num muted">${t.seq}</td><td>${fmtDate(t.date)}</td><td>${esc(t.description)}</td>
      <td class="num neg">${t.debit?num(t.debit,2):""}</td><td class="num pos">${t.credit?num(t.credit,2):""}</td>
      <td class="num">${num(t.balance,2)}</td><td><span class="catpill">${esc(t.category)}</span></td>
      <td>${esc(t.remitter||"")}</td><td><span class="railpill">${esc(t.rail)}</span></td></tr>`).join("")
      :`<tr><td colspan="9"><div class="emptyrow"><b>No matching transactions</b>Try clearing the search or filters.</div></td></tr>`;
  };
  ["fq","fc","fr","fd"].forEach(id=>document.getElementById(id).addEventListener("input",render));
  if(TX_SEARCH){ document.getElementById("fq").value=TX_SEARCH; TX_SEARCH=null; }
  render();
}

/* --- insights --- */
function barChart(title, rows, cls){
  const max=Math.max(1,...rows.map(r=>r.amount));
  return `<div class="chartcard"><h4>${title}</h4>${rows.map(r=>`<div class="barrow">
    <span class="lab" title="${esc(r.label)}">${esc(r.label)}</span>
    <span class="track"><span class="fill ${cls||""}" style="width:${(r.amount/max*100).toFixed(1)}%"></span></span>
    <span class="amt">${inr(r.amount)}</span></div>`).join("")}</div>`;
}
function tabInsights(b){
  const p=PAYLOAD;
  // EOD line chart (interactive: hover tooltip + screen-reader summary)
  const card=el(`<div class="chartcard"><h4>End-of-day balance</h4><div class="eodhost"></div></div>`);
  b.appendChild(card);
  mountEod(card.querySelector(".eodhost"), p.eod_series);
  const cb=p.category_breakdown;
  const g=el(`<div class="grid-charts"></div>`);
  g.appendChild(el(barChart("Where money went (debits)", cb.debits.map(x=>({label:x.group,amount:x.amount})), "dr")));
  g.appendChild(el(barChart("Where money came from (credits)", cb.credits.map(x=>({label:x.group,amount:x.amount})), "cr")));
  b.appendChild(g);
  // lifestyle
  if(p.lifestyle.length){
    const ls=el(`<div class="chartcard"><h4>Lifestyle spend flags</h4></div>`);
    p.lifestyle.forEach(l=>ls.appendChild(el(`<div class="barrow">
      <span class="lab">${esc(l.flag)} <span class="sev ${l.severity}">${l.severity}</span></span>
      <span class="track"><span class="fill dr" style="width:${Math.min(100,l.pct_of_inflows*10).toFixed(1)}%"></span></span>
      <span class="amt">${inr(l.amount)} · ${l.pct_of_inflows}%</span></div>`)));
    b.appendChild(ls);
  }
}
function mountEod(host, series){
  if(!series.length){ host.innerHTML="<div class='muted'>No data</div>"; return; }
  const W=980,H=220,pad=40;
  let pts=series; if(pts.length>380){ const step=Math.ceil(pts.length/380); pts=series.filter((_,i)=>i%step===0); }
  const xs=i=>pad+i/(pts.length-1)*(W-pad*1.5);
  const bmax=Math.max(...pts.map(p=>p.balance),1), bmin=Math.min(...pts.map(p=>p.balance),0);
  const ys=v=>H-pad-(v-bmin)/((bmax-bmin)||1)*(H-pad*1.6);
  const line=pts.map((p,i)=>`${i?"L":"M"}${xs(i).toFixed(1)},${ys(p.balance).toFixed(1)}`).join(" ");
  const area=`${line} L${xs(pts.length-1).toFixed(1)},${H-pad} L${xs(0).toFixed(1)},${H-pad} Z`;
  const y1000=ys(1000);
  const ticks=[0,.25,.5,.75,1].map(f=>{const v=bmin+(bmax-bmin)*f;return `<text x="4" y="${(ys(v)+4).toFixed(1)}" font-size="10" fill="#8892a6">${inr(Math.round(v))}</text><line x1="${pad}" x2="${W-pad*.5}" y1="${ys(v).toFixed(1)}" y2="${ys(v).toFixed(1)}" stroke="#eef1f6"/>`;}).join("");
  const last=series[series.length-1];
  const summary=`End-of-day balance ${fmtDate(series[0].date)} to ${fmtDate(last.date)}: opened ${inr(series[0].balance)}, closed ${inr(last.balance)}, range ${inr(bmin)} to ${inr(bmax)}.`;
  host.className="eodwrap";
  host.innerHTML=`<svg viewBox="0 0 ${W} ${H+18}" width="100%" style="overflow:visible" role="img" aria-label="${esc(summary)}"><desc>${esc(summary)}</desc>
    ${ticks}
    ${y1000>pad&&y1000<H-pad?`<line x1="${pad}" x2="${W-pad*.5}" y1="${y1000.toFixed(1)}" y2="${y1000.toFixed(1)}" stroke="#a86403" stroke-dasharray="4 3"/><text x="${W-pad*.5}" y="${(y1000-4).toFixed(1)}" font-size="9" fill="#a86403" text-anchor="end">₹1,000</text>`:""}
    <path d="${area}" fill="rgba(1,118,211,.08)"/>
    <path d="${line}" fill="none" stroke="#0176D3" stroke-width="1.8"/>
    <line class="cursorline" x1="0" x2="0" y1="${(pad*.5).toFixed(0)}" y2="${H-pad}"/>
    <circle class="cursordot" cx="0" cy="0" r="3.6"/>
    <text x="${pad}" y="${H+12}" font-size="10" fill="#8892a6">${fmtDate(series[0].date)}</text>
    <text x="${W-pad*.5}" y="${H+12}" font-size="10" fill="#8892a6" text-anchor="end">${fmtDate(last.date)}</text>
  </svg><div class="eodtip" role="status"></div>`;
  const svg=host.querySelector("svg"), tip=host.querySelector(".eodtip"),
        cl=host.querySelector(".cursorline"), cd=host.querySelector(".cursordot");
  const move=ev=>{
    const r=svg.getBoundingClientRect();
    let i=Math.round(((ev.clientX-r.left)/r.width*W-pad)/(W-pad*1.5)*(pts.length-1));
    i=Math.max(0,Math.min(pts.length-1,i));
    const px=xs(i), py=ys(pts[i].balance);
    cl.setAttribute("x1",px); cl.setAttribute("x2",px); cd.setAttribute("cx",px); cd.setAttribute("cy",py);
    host.classList.add("on"); tip.classList.add("on");
    tip.style.left=(px/W*100)+"%"; tip.style.top=(py/(H+18)*100)+"%";
    tip.innerHTML=`<b>${fmtDate(pts[i].date)}</b> · ${inr(pts[i].balance)}`;
  };
  svg.addEventListener("mousemove",move);
  svg.addEventListener("mouseleave",()=>{host.classList.remove("on");tip.classList.remove("on");});
  return;
}

/* --- cash & rails --- */
function tabCashRails(b){
  const p=PAYLOAD, c=p.cashflow;
  const grid=el(`<div class="kpis"></div>`);
  [["Cash deposits", `${num(c.deposit_count)} · ${inr(c.deposit_amount)}`],
   ["Cash withdrawals", `${num(c.withdrawal_count)} · ${inr(c.withdrawal_amount)}`]]
   .forEach(([l,v])=>grid.appendChild(el(`<div class="kpi"><div class="lbl">${l}</div><div class="val sm">${v}</div></div>`)));
  b.appendChild(el(`<div class="sec-h">Cash flow</div>`)); b.appendChild(grid);
  b.appendChild(el(`<div class="sec-h">Rails (payment channels)</div>`));
  const rows=p.rails.map(r=>`<tr><td><span class="railpill">${esc(r.rail)}</span></td>
    <td class="num">${num(r.cr_count)}</td><td class="num pos">${r.cr_amt?inr(r.cr_amt):""}</td>
    <td class="num">${num(r.dr_count)}</td><td class="num neg">${r.dr_amt?inr(r.dr_amt):""}</td></tr>`).join("");
  b.appendChild(el(`<div class="tablescroll"><table class="data"><thead><tr>
    <th>Rail</th><th class="num">Cr #</th><th class="num">Credit ₹</th><th class="num">Dr #</th><th class="num">Debit ₹</th>
    </tr></thead><tbody>${rows}</tbody></table></div>`));
}

/* --- parties --- */
function tabParties(b){
  const p=PAYLOAD;
  b.appendChild(el(`<div class="sec-h">Counterparty ledger (top 40 by volume)</div>`));
  const rows=p.parties.map(x=>`<tr><td><b>${esc(x.party)}</b>${x.both_sides?` <span class="railpill">both-sides</span>`:""}</td>
    <td class="num">${num(x.txns_in)}</td><td class="num pos">${x.amount_in?inr(x.amount_in):""}</td>
    <td class="num">${num(x.txns_out)}</td><td class="num neg">${x.amount_out?inr(x.amount_out):""}</td>
    <td class="num ${x.net>=0?"pos":"neg"}">${inr(x.net)}</td></tr>`).join("");
  b.appendChild(el(`<div class="tablescroll"><table class="data"><thead><tr>
    <th>Party</th><th class="num">In #</th><th class="num">Amount in</th><th class="num">Out #</th><th class="num">Amount out</th><th class="num">Net</th>
    </tr></thead><tbody>${rows}</tbody></table></div>`));
  // monthly top-5
  b.appendChild(el(`<div class="sec-h">Monthly Top-5 funds</div>`));
  const g=el(`<div class="grid-charts"></div>`);
  g.appendChild(el(top5Card("Received", p.top5_credit, "cr")));
  g.appendChild(el(top5Card("Transferred", p.top5_debit, "dr")));
  b.appendChild(g);
}
function top5Card(title, data, cls){
  const months=Object.keys(data);
  return `<div class="chartcard"><h4>${title}</h4>${months.map(m=>{
    const rows=data[m]; if(!rows.length)return"";
    const max=Math.max(1,...rows.map(r=>r.amount));
    return `<div class="muted" style="font-size:11px;margin:8px 0 4px">${monthLabel(m)}</div>`+
      rows.map(r=>`<div class="barrow"><span class="lab" title="${esc(r.desc)}">${esc(r.desc)}</span>
      <span class="track"><span class="fill ${cls}" style="width:${(r.amount/max*100).toFixed(0)}%"></span></span>
      <span class="amt">${inr(r.amount)}</span></div>`).join("");
  }).join("")}</div>`;
}

/* --- flags --- */
function tabFlags(b){
  const p=PAYLOAD;
  b.appendChild(el(`<div class="sec-h">FCU &amp; behaviour flags</div>`));
  p.flags.forEach((f,i)=>{
    const card=el(`<div class="flagcard ${f.fired?"fired":""}">
      <div class="fh"><span class="sev ${f.severity}">${f.severity}</span>
        <b>${esc(f.id)} · ${esc(f.name)}</b>
        <span class="muted" style="margin-left:auto">${f.fired?`FIRED · ${f.count} hit(s)`:"not fired"}</span></div>
      <div class="fb" id="fb${i}"></div></div>`);
    const fb=card.querySelector(".fb");
    if(f.txns&&f.txns.length){
      // underlying transactions that triggered the flag (drill-down)
      const sm=f.summary?`<div class="muted" style="font-size:12px;margin-bottom:8px">
        ${f.count} transaction(s) · ₹${num(f.summary.amount,0)} total · ${f.summary.pct_of_inflows}% of inflows · ~${f.summary.per_month}/month</div>`:"";
      fb.innerHTML=sm+`<div class="tablescroll" style="max-height:40vh"><table class="data"><thead><tr>
        <th>Date</th><th>Description</th><th class="num">Amount</th><th class="num">Balance</th><th>Category</th><th></th></tr></thead>
        <tbody>${f.txns.map(t=>`<tr><td>${fmtDate(t.date)}</td><td>${esc(t.description)}</td>
          <td class="num ${t.amount<0?"neg":"pos"}">${num(t.amount,2)}</td><td class="num">${num(t.balance,2)}</td>
          <td><span class="catpill">${esc(t.category)}</span></td>
          <td><a href="#" class="jumptx muted" data-d="${encodeURIComponent(t.description)}">view →</a></td></tr>`).join("")}</tbody></table></div>`;
    } else if(f.id==="F02"&&f.detail&&f.detail.length){
      fb.innerHTML=`<table class="data"><thead><tr><th>Deposit date</th><th class="num">Deposit ₹</th><th class="num">Out ₹</th><th>To</th><th>Desc</th></tr></thead>
        <tbody>${f.detail.map(e=>`<tr><td>${fmtDate(e.deposit_date)}</td><td class="num">${num(e.deposit_amount,2)}</td>
        <td class="num">${num(e.outflow_amount,2)}</td><td>${esc(e.outflow_to)}</td><td>${esc(e.outflow_desc)}</td></tr>`).join("")}</tbody></table>`;
    } else if(f.id==="F03"&&f.detail&&f.detail.length){
      fb.innerHTML=`<table class="data"><thead><tr><th>Party</th><th class="num">Cr #</th><th class="num">Cr ₹</th><th class="num">Dr #</th><th class="num">Dr ₹</th></tr></thead>
        <tbody>${f.detail.map(e=>`<tr><td>${esc(e.party)}</td><td class="num">${e.credits}</td><td class="num">${num(e.cr_amt)}</td>
        <td class="num">${e.debits}</td><td class="num">${num(e.dr_amt)}</td></tr>`).join("")}</tbody></table>`;
    } else fb.innerHTML=`<div class="muted" style="padding:6px 0">No underlying transactions${f.fired?"":" (flag not fired)"}.</div>`;
    fb.querySelectorAll(".jumptx").forEach(a=>a.onclick=e=>{e.preventDefault();jumpToTxn(decodeURIComponent(a.dataset.d));});
    card.querySelector(".fh").onclick=()=>card.classList.toggle("open");
    b.appendChild(card);
  });
}

/* --- high value --- */
function tabHighValue(b){
  const p=PAYLOAD;
  const tbl=(title,rows)=>{
    b.appendChild(el(`<div class="sec-h">${title} (${rows.length})</div>`));
    if(!rows.length){ b.appendChild(el(`<div class="muted" style="margin-bottom:14px">None above threshold.</div>`)); return; }
    b.appendChild(el(`<div class="tablescroll" style="max-height:38vh"><table class="data"><thead><tr>
      <th>Date</th><th>Description</th><th class="num">Amount</th><th>Category</th><th class="num">Balance</th></tr></thead>
      <tbody>${rows.map(t=>`<tr><td>${fmtDate(t.date)}</td><td>${esc(t.description)}</td>
      <td class="num ${t.amount<0?"neg":"pos"}">${num(t.amount,2)}</td><td><span class="catpill">${esc(t.category)}</span></td>
      <td class="num">${num(t.balance,2)}</td></tr>`).join("")}</tbody></table></div>`));
  };
  tbl("High-value credits", p.high_value_credit);
  tbl("High-value debits", p.high_value_debit);
}

/* --- UPI Analysis (interactive threshold) --- */
function tabUPI(b){
  const upi=PAYLOAD.transactions.filter(t=>t.rail==="UPI");
  const totCount=upi.length, totAmt=upi.reduce((s,t)=>s+Math.abs(t.amount),0);
  b.appendChild(el(`<div class="sec-h">UPI analysis</div>`));
  b.appendChild(el(`<div class="muted" style="margin-bottom:14px">${num(totCount)} UPI transactions · ${inr(totAmt)} total. Enter a threshold to see how many fall below it.</div>`));
  b.appendChild(el(`<div class="filters" style="align-items:flex-end">
    <label class="fld" style="margin:0"><span>Amount threshold (₹)</span>
      <input id="upx" type="number" value="1000" style="min-width:160px"></label>
    <label class="fld" style="margin:0"><span>Direction</span>
      <select id="upd"><option value="">Cr + Dr</option><option value="cr">Credits</option><option value="dr">Debits</option></select></label>
    <button class="btn sm" id="upgo">Apply</button></div>`));
  b.appendChild(el(`<div class="kpis" id="upkpi"></div>`));
  b.appendChild(el(`<div class="sec-h">Transactions below threshold</div>`));
  b.appendChild(el(`<div class="tablescroll"><table class="data"><thead><tr>
    <th class="num">#</th><th>Date</th><th>Description</th><th class="num">Debit</th><th class="num">Credit</th>
    <th class="num">Balance</th><th>Category</th></tr></thead><tbody id="upb"></tbody></table></div>`));
  const render=()=>{
    const x=parseFloat(document.getElementById("upx").value)||0;
    const dir=document.getElementById("upd").value;
    let rows=upi.filter(t=>Math.abs(t.amount)<x && (!dir||(dir==="cr"?t.credit:t.debit)));
    const cnt=rows.length, amt=rows.reduce((s,t)=>s+Math.abs(t.amount),0);
    const crc=rows.filter(t=>t.credit).length, drc=rows.filter(t=>t.debit).length;
    document.getElementById("upkpi").innerHTML=[
      ["UPI txns below ₹"+num(x), num(cnt)+" of "+num(totCount)],
      ["% of UPI count", (totCount?(100*cnt/totCount).toFixed(1):0)+"%"],
      ["Total value below", inr(amt)],
      ["Credits / Debits", num(crc)+" / "+num(drc)],
    ].map(([l,v])=>`<div class="kpi"><div class="lbl">${l}</div><div class="val sm">${v}</div></div>`).join("");
    document.getElementById("upb").innerHTML=rows.length?rows.slice(0,1000).map(t=>`<tr>
      <td class="num muted">${t.seq}</td><td>${fmtDate(t.date)}</td><td>${esc(t.description)}</td>
      <td class="num neg">${t.debit?num(t.debit,2):""}</td><td class="num pos">${t.credit?num(t.credit,2):""}</td>
      <td class="num">${num(t.balance,2)}</td><td><span class="catpill">${esc(t.category)}</span></td></tr>`).join("")
      :`<tr><td colspan="7"><div class="emptyrow"><b>No UPI transactions below ₹${num(x)}</b>Raise the threshold to see more.</div></td></tr>`;
  };
  document.getElementById("upx").addEventListener("input",render);
  document.getElementById("upd").addEventListener("change",render);
  document.getElementById("upgo").onclick=render;
  render();
}

/* --- Avg Closing Balance 3rd & 4th --- */
function tabAvgBal(b){
  const a=PAYLOAD.avg_closing_3_4;
  b.appendChild(el(`<div class="sec-h">Average closing balance — 3rd &amp; 4th of each month</div>`));
  b.appendChild(el(`<div class="muted" style="margin-bottom:14px">Closing balance on the 3rd and 4th day of every month and their average — a key-date liquidity read for EMIs/NACH that present early in the month.</div>`));
  const rows=a.rows.map(r=>`<tr><td><b>${monthLabel(r.month)}</b></td>
    <td class="num">${r.close_3==null?"—":num(r.close_3,2)}</td>
    <td class="num">${r.close_4==null?"—":num(r.close_4,2)}</td>
    <td class="num"><b>${r.avg==null?"—":num(r.avg,2)}</b></td></tr>`).join("");
  b.appendChild(el(`<div class="tablescroll" style="max-height:50vh"><table class="data"><thead><tr>
    <th>Month</th><th class="num">Closing bal · 3rd</th><th class="num">Closing bal · 4th</th><th class="num">Average (3rd+4th)</th></tr></thead>
    <tbody>${rows}<tr style="background:var(--panel)"><td><b>Overall</b></td>
      <td class="num">${a.avg_3==null?"—":num(a.avg_3,2)}</td><td class="num">${a.avg_4==null?"—":num(a.avg_4,2)}</td>
      <td class="num"><b>${a.overall_avg==null?"—":num(a.overall_avg,2)}</b></td></tr></tbody></table></div>`));
  // bar chart of monthly avg
  const max=Math.max(1,...a.rows.map(r=>r.avg||0));
  b.appendChild(el(`<div class="chartcard" style="margin-top:18px"><h4>Monthly average (3rd &amp; 4th)</h4>${
    a.rows.map(r=>`<div class="barrow"><span class="lab">${monthLabel(r.month)}</span>
    <span class="track"><span class="fill" style="width:${((r.avg||0)/max*100).toFixed(1)}%"></span></span>
    <span class="amt">${inr(r.avg||0)}</span></div>`).join("")}</div>`));
}

/* --- Spend Analysis (Digitap category rollup) --- */
function tabSpend(b){
  const p=PAYLOAD, rows=p.spend_analysis;
  b.appendChild(el(`<div class="sec-h">Spend by category</div>`));
  if(!rows.length){ b.appendChild(el(`<div class="muted">No categorised spend in this statement.</div>`)); return; }
  const head=`<tr><th>Category</th>${p.months.map(m=>`<th class="num">${monthLabel(m)}</th>`).join("")}
    <th class="num">Total</th><th class="num">Count</th><th class="num">% debits</th></tr>`;
  const body=rows.map(r=>`<tr>
    <td>${esc(r.category)}${r.lifestyle?` <span class="sev RED">LIFESTYLE</span>`:""}</td>
    ${r.monthly.map(v=>`<td class="num">${v?num(v,0):""}</td>`).join("")}
    <td class="num"><b>${num(r.total,2)}</b></td><td class="num">${num(r.count)}</td><td class="num">${r.pct_of_debits}%</td></tr>`).join("");
  b.appendChild(el(`<div class="tablescroll"><table class="data"><thead>${head}</thead><tbody>${body}</tbody></table></div>`));
  // lifestyle detail
  const life=p.lifestyle;
  if(life.length){
    b.appendChild(el(`<div class="sec-h">Lifestyle detail</div>`));
    b.appendChild(el(`<div class="tablescroll" style="max-height:30vh"><table class="data"><thead><tr>
      <th>Category</th><th class="num">Txns</th><th class="num">Total</th><th class="num">Monthly avg</th>
      <th class="num">% inflows</th><th class="num">Per month</th><th>Flag</th></tr></thead><tbody>${
      life.map(l=>`<tr><td>${esc(l.flag)}</td><td class="num">${l.txn_count}</td><td class="num">${num(l.amount,2)}</td>
      <td class="num">${num(l.monthly_avg,2)}</td><td class="num">${l.pct_of_inflows}%</td><td class="num">${l.per_month}</td>
      <td><span class="sev ${l.severity}">${l.fired?"FIRED":"INFO"}</span></td></tr>`).join("")}</tbody></table></div>`));
  }
}

/* --- Loan Analysis (Digitap lender names) --- */
function tabLoans(b){
  const p=PAYLOAD, rows=p.loan_analysis;
  const total=rows.reduce((s,l)=>s+l.total,0);
  b.appendChild(el(`<div class="sec-h">Loan / EMI analysis by lender</div>`));
  if(!rows.length){ b.appendChild(el(`<div class="muted">No loan repayments detected.</div>`)); return; }
  b.appendChild(el(`<div class="kpis" style="margin-bottom:16px">
    <div class="kpi warn"><div class="lbl">Total obligations</div><div class="val">${inr(total)}</div></div>
    <div class="kpi"><div class="lbl">Active lenders</div><div class="val">${rows.length}</div></div>
    <div class="kpi"><div class="lbl">Obligation / inflow</div><div class="val">${p.summary.obligation_to_inflow_pct==null?"—":p.summary.obligation_to_inflow_pct+"%"}</div></div>
  </div>`));
  const body=rows.map(l=>`<tr><td><b>${esc(l.lender)}</b></td><td><span class="railpill">${esc(l.lender_type)}</span></td>
    <td>${esc(l.pattern)}</td><td class="num">${num(l.txn_count)}</td><td class="num"><b>${num(l.total,2)}</b></td>
    <td class="num">${num(l.monthly_avg,2)}</td><td>${fmtDate(l.first_seen)}</td><td>${fmtDate(l.last_seen)}</td></tr>`).join("");
  b.appendChild(el(`<div class="tablescroll"><table class="data"><thead><tr>
    <th>Lender</th><th>Type</th><th>Pattern</th><th class="num">Txns</th><th class="num">Total paid</th>
    <th class="num">Monthly avg</th><th>First</th><th>Last</th></tr></thead><tbody>${body}
    <tr style="background:var(--panel)"><td><b>TOTAL</b></td><td></td><td></td>
    <td class="num"><b>${num(rows.reduce((s,l)=>s+l.txn_count,0))}</b></td><td class="num"><b>${num(total,2)}</b></td><td></td><td></td><td></td></tr>
    </tbody></table></div>`));
  // disbursals
  if(p.loan_disbursed.length){
    b.appendChild(el(`<div class="sec-h">Loan disbursals (excluded from income)</div>`));
    b.appendChild(el(`<div class="tablescroll" style="max-height:26vh"><table class="data"><thead><tr>
      <th>Date</th><th>Description</th><th class="num">Amount</th><th class="num">Balance</th></tr></thead><tbody>${
      p.loan_disbursed.map(t=>`<tr><td>${fmtDate(t.date)}</td><td>${esc(t.description)}</td>
      <td class="num pos">${num(t.amount,2)}</td><td class="num">${num(t.balance,2)}</td></tr>`).join("")}</tbody></table></div>`));
  }
}

/* --- Daily Balance (Open + Close) --- */
function tabDaily(b){
  const rows=PAYLOAD.daily_balance;
  b.appendChild(el(`<div class="sec-h">Daily balance — open &amp; close (${num(rows.length)} days)</div>`));
  b.appendChild(el(`<div class="tablescroll"><table class="data"><thead><tr>
    <th>Date</th><th class="num">Opening</th><th class="num">Closing</th><th class="num">Txns</th><th class="num">Net change</th><th>Below ₹1,000</th></tr></thead>
    <tbody>${rows.map(r=>`<tr><td>${fmtDate(r.date)}</td><td class="num">${num(r.open,2)}</td>
      <td class="num">${num(r.close,2)}</td><td class="num muted">${r.txns||""}</td>
      <td class="num ${r.net<0?"neg":r.net>0?"pos":""}">${r.net?num(r.net,2):""}</td>
      <td>${r.close<1000?`<span class="sev WARN">yes</span>`:""}</td></tr>`).join("")}</tbody></table></div>`));
}

/* --- Validation & QC --- */
function tabQC(b){
  const q=PAYLOAD.qc;
  b.appendChild(el(`<div class="sec-h">Validation &amp; QC</div>`));
  const kv=[
    ["Bank", q.bank], ["Account type", q.account_type||"—"], ["Password protected", q.password_protected||"—"],
    ["Transactions extracted", num(q.txn_count)],
    ["Balance continuity breaks", q.balance_continuity_breaks, q.balance_continuity_breaks?"warn":""],
    ["Duplicate transactions", num(q.duplicate_count)],
    ["Categorisation coverage (count)", q.categorisation_coverage_pct+"%"],
    ["Categorisation coverage (amount)", q.categorisation_coverage_amt_pct+"%"],
    ["Missing date ranges (>15d)", num(q.missing_ranges.length), q.missing_ranges.length?"warn":""],
  ];
  const grid=el(`<div class="kpis"></div>`);
  kv.forEach(([l,v,w])=>grid.appendChild(el(`<div class="kpi ${w==="warn"?"warn":""}"><div class="lbl">${l}</div><div class="val sm">${v}</div></div>`)));
  b.appendChild(grid);
  if(q.missing_ranges.length){
    b.appendChild(el(`<div class="sec-h">Missing transaction ranges</div>`));
    b.appendChild(el(`<div class="tablescroll" style="max-height:26vh"><table class="data"><thead><tr>
      <th>From</th><th>To</th><th class="num">Gap (days)</th></tr></thead><tbody>${
      q.missing_ranges.map(m=>`<tr><td>${fmtDate(m.from)}</td><td>${fmtDate(m.to)}</td><td class="num">${m.days}</td></tr>`).join("")}</tbody></table></div>`));
  } else {
    b.appendChild(el(`<div class="banner" style="background:#e7f6ee;color:var(--green)">✓ No missing date ranges · balance continuity intact · full extraction verified.</div>`));
  }
}
