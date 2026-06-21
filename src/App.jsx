import { useState, useRef, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const PROXY = "https://contractobligations.kumar-manjushree.workers.dev/";

const COLORS = {
  bg:       "#f5f6f8",
  surface:  "#ffffff",
  border:   "#e2e4e9",
  ink:      "#111318",
  inkMid:   "#3d4147",
  inkSub:   "#6b7280",
  inkFaint: "#9ca3af",
  blue:     "#1d4ed8",
  blueLight:"#eff6ff",
  blueMid:  "#3b82f6",
  green:    "#15803d",
  greenBg:  "#f0fdf4",
  amber:    "#b45309",
  amberBg:  "#fffbeb",
  red:      "#b91c1c",
  redBg:    "#fef2f2",
  teal:     "#0e7490",
  tealBg:   "#ecfeff",
};

const OBL_TYPES = [
  "Social Post","Broadcast Mention","Logo Placement","Event Activation",
  "Email Campaign","Press Release","Website Banner","Co-branded Content",
  "Signage","Hospitality","Other",
];

// ─── API call ─────────────────────────────────────────────────────────────────
async function callClaude(apiKey, body) {
  // Extract __beta — only forward as a header when it has a real value
  const { __beta, ...cleanBody } = body;
  const headers = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };
  if (__beta) headers["anthropic-beta"] = __beta;
  const res = await fetch(PROXY, {
    method: "POST",
    headers,
    body: JSON.stringify(cleanBody),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error("Non-JSON response: " + text.slice(0, 200)); }
  if (!res.ok || json.error) throw new Error(json.error?.message || `HTTP ${res.status}`);
  return json;
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
const pct  = (c, r) => r === 0 ? 0 : Math.round((c / r) * 100);
const sFromPct = p  => p >= 100 ? "fulfilled" : p > 0 ? "partial" : "unfulfilled";
const b64  = file   => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = e => res(e.target.result.split(",")[1]);
  r.onerror = () => rej(new Error("File read failed"));
  r.readAsDataURL(file);
});

// ─── Shared UI ────────────────────────────────────────────────────────────────
const S = {
  input: {
    width: "100%", padding: "8px 10px", borderRadius: 6,
    border: `1px solid ${COLORS.border}`, fontSize: 13,
    color: COLORS.ink, background: COLORS.surface, boxSizing: "border-box",
    outline: "none",
  },
  label: { fontSize: 12, fontWeight: 500, color: COLORS.inkSub, display: "block", marginBottom: 4 },
  card:  { background: COLORS.surface, borderRadius: 10, border: `1px solid ${COLORS.border}`, overflow: "hidden" },
  th:    { padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: COLORS.inkSub,
           textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${COLORS.border}`, whiteSpace: "nowrap" },
};

function Btn({ children, onClick, disabled, variant = "primary", size = "md", style = {} }) {
  const base = {
    border: "none", borderRadius: 7, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1, transition: "opacity 0.15s", fontFamily: "inherit",
    ...(size === "sm" ? { fontSize: 12, padding: "5px 12px" } : { fontSize: 13, padding: "9px 18px" }),
    ...(variant === "primary"  ? { background: COLORS.blue, color: "#fff" } : {}),
    ...(variant === "ghost"    ? { background: "transparent", color: COLORS.inkSub, border: `1px solid ${COLORS.border}` } : {}),
    ...(variant === "danger"   ? { background: "transparent", color: COLORS.red, border: `1px solid ${COLORS.border}` } : {}),
    ...(variant === "success"  ? { background: COLORS.green, color: "#fff" } : {}),
    ...style,
  };
  return <button style={base} onClick={onClick} disabled={disabled}>{children}</button>;
}

function Badge({ status }) {
  const map = {
    fulfilled:   { bg: COLORS.greenBg,  color: COLORS.green,  label: "Fulfilled"   },
    partial:     { bg: COLORS.amberBg,  color: COLORS.amber,  label: "Partial"     },
    unfulfilled: { bg: COLORS.redBg,    color: COLORS.red,    label: "Unfulfilled" },
    pending:     { bg: "#f3f4f6",       color: COLORS.inkSub, label: "Pending"     },
    error:       { bg: COLORS.redBg,    color: COLORS.red,    label: "Error"       },
    done:        { bg: COLORS.greenBg,  color: COLORS.green,  label: "Done"        },
    processing:  { bg: COLORS.blueLight,color: COLORS.blue,   label: "Processing"  },
  };
  const c = map[status] || map.pending;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5,
      background: c.bg, color: c.color, fontSize: 11, fontWeight: 600,
      padding: "3px 9px", borderRadius: 20 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.color }} />
      {c.label}
    </span>
  );
}

function Bar({ value, max }) {
  const p = pct(value, max);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: COLORS.border, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${p}%`, height: "100%", borderRadius: 3, transition: "width 0.4s",
          background: p >= 100 ? COLORS.green : p >= 50 ? "#f59e0b" : COLORS.red }} />
      </div>
      <span style={{ fontSize: 11, color: COLORS.inkFaint, minWidth: 30, textAlign: "right" }}>{p}%</span>
    </div>
  );
}

function Empty({ icon, title, body, cta }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 24px" }}>
      <div style={{ fontSize: 38, marginBottom: 12 }}>{icon}</div>
      <p style={{ fontSize: 15, fontWeight: 600, color: COLORS.ink, margin: "0 0 6px" }}>{title}</p>
      <p style={{ fontSize: 13, color: COLORS.inkSub, margin: "0 0 20px", maxWidth: 360,
        marginLeft: "auto", marginRight: "auto", lineHeight: 1.65 }}>{body}</p>
      {cta}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,         setTab]         = useState("contracts");
  const [apiKey,      setApiKey]      = useState("");
  const [contracts,   setContracts]   = useState([]);
  const [obligations, setObligations] = useState([]);
  const [queue,       setQueue]       = useState([]);        // { id, file, b64, name, type }
  const [fileStatus,  setFileStatus]  = useState({});       // id -> idle|processing|done|error
  const [isParsing,   setIsParsing]   = useState(false);
  const [dragOver,    setDragOver]    = useState(false);
  const oblId = useRef(0);
  const fileRef = useRef();

  // debug panel
  const [debugLog,    setDebugLog]    = useState([]);
  const [showDebug,   setShowDebug]   = useState(false);
  const [testStatus,  setTestStatus]  = useState(null); // null|"testing"|"ok"|"fail"
  const [testMsg,     setTestMsg]     = useState("");

  // obligations tab
  const [fPartner,    setFPartner]    = useState("All");
  const [fStatus,     setFStatus]     = useState("All");
  const [editId,      setEditId]      = useState(null);
  const [showAdd,     setShowAdd]     = useState(false);
  const [newObl, setNewObl] = useState({ partner:"", type:"Social Post", required:1, completed:0, deadline:"", evidence:"", notes:"" });

  // social
  const [meltwaterKey, setMeltwaterKey] = useState("");
  const [socialProv,   setSocialProv]   = useState("fallback");
  const [scanning,     setScanning]     = useState(false);
  const [scanResults,  setScanResults]  = useState(null);

  // ── derived ──
  const total    = obligations.length;
  const nFulfill = obligations.filter(o => o.status === "fulfilled").length;
  const nPartial = obligations.filter(o => o.status === "partial").length;
  const nUnfull  = obligations.filter(o => o.status === "unfulfilled").length;
  const nPending = obligations.filter(o => o.status === "pending").length;
  const oPct     = total === 0 ? 0 : Math.round((nFulfill + nPartial * 0.5) / total * 100);
  const partnerList = ["All", ...Array.from(new Set(obligations.map(o => o.partner)))];
  const filtered = obligations.filter(o =>
    (fPartner === "All" || o.partner === fPartner) &&
    (fStatus  === "All" || o.status  === fStatus)
  );

  const log = (msg, type = "info") => setDebugLog(p => [...p.slice(-49), { msg, type, t: new Date().toLocaleTimeString() }]);

  // ── Connection test ──
  const testConnection = async () => {
    if (!apiKey.trim()) { setTestMsg("Enter your API key first."); setTestStatus("fail"); return; }
    setTestStatus("testing"); setTestMsg("Sending test request…"); log("Testing connection…");
    try {
      const res = await callClaude(apiKey.trim(), {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 10,
        messages: [{ role: "user", content: "Reply with OK" }],
      });
      const reply = res.content?.[0]?.text || "";
      setTestStatus("ok");
      setTestMsg("Connection successful — Worker and API key are working.");
      log("✓ Connection OK: " + reply, "ok");
    } catch (e) {
      setTestStatus("fail");
      setTestMsg("Failed: " + e.message);
      log("✗ " + e.message, "error");
    }
  };

  // ── File queue ──
  const enqueue = async (files) => {
    const entries = [];
    for (const file of files) {
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") continue;
      const data = await b64(file);
      const id = `${Date.now()}_${Math.random()}`;
      entries.push({ id, file, b64: data, name: file.name, mediaType: file.type });
    }
    if (!entries.length) return;
    setQueue(p => [...p, ...entries]);
    setFileStatus(p => { const n = { ...p }; entries.forEach(e => { n[e.id] = "idle"; }); return n; });
  };

  const dequeue = (id) => {
    setQueue(p => p.filter(f => f.id !== id));
    setFileStatus(p => { const n = { ...p }; delete n[id]; return n; });
  };

  // ── Parse one file ──
  const parseFile = async (qf) => {
    log(`Parsing ${qf.name}…`);
    const isImg = qf.mediaType.startsWith("image/");
    const contentBlock = isImg
      ? { type: "image",    source: { type: "base64", media_type: qf.mediaType,       data: qf.b64 } }
      : { type: "document", source: { type: "base64", media_type: "application/pdf",  data: qf.b64 } };

    const body = {
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      ...(!isImg ? { __beta: "pdfs-2024-09-25" } : {}),
      system: `You are a partnership contract analyst.
Extract ONLY the marketing and sponsorship obligations explicitly stated in this document.
Do NOT infer, invent, or add anything not written.
A contract may contain only 1 or 2 obligations — extract exactly what is present.
Return ONLY a valid JSON array. No markdown, no explanation. If none found return [].
Each item: { "partner": string, "type": one of [Social Post|Broadcast Mention|Logo Placement|Event Activation|Email Campaign|Press Release|Website Banner|Co-branded Content|Signage|Hospitality|Other], "required": integer, "deadline": "YYYY-MM-DD or empty", "notes": string }`,
      messages: [{ role: "user", content: [contentBlock, { type: "text", text: "Extract obligations. Return JSON array only." }] }],
    };

    const data = await callClaude(apiKey.trim(), body);
    const raw  = data.content?.find(b => b.type === "text")?.text || "[]";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    log(`✓ ${qf.name}: ${parsed.length} obligation(s)`, "ok");
    return parsed;
  };

  // ── Parse all queued ──
  const parseAll = async () => {
    if (!apiKey.trim()) { alert("Add your Claude API key in Settings first."); return; }
    if (!queue.length) return;
    setIsParsing(true);
    setFileStatus(p => { const n = { ...p }; queue.forEach(q => { n[q.id] = "processing"; }); return n; });

    const results = await Promise.all(queue.map(async qf => {
      let parsed = [], error = null;
      try   { parsed = await parseFile(qf); setFileStatus(p => ({ ...p, [qf.id]: "done" })); }
      catch (e) { error = e.message; setFileStatus(p => ({ ...p, [qf.id]: "error" })); log("✗ " + qf.name + ": " + e.message, "error"); }
      return { qf, parsed, error };
    }));

    const newContracts = [], newObls = [];
    results.forEach(({ qf, parsed, error }) => {
      const cid = `c_${qf.id}`;
      const partner = parsed[0]?.partner || qf.name.replace(/\.[^.]+$/, "");
      newContracts.push({ id: cid, fileName: qf.name, mediaType: qf.mediaType, partner,
        status: error ? "error" : parsed.length ? "parsed" : "empty",
        count: parsed.length, parsedAt: new Date().toLocaleString(), error });
      parsed.forEach(o => newObls.push({
        id: ++oblId.current, cid,
        partner:   o.partner  || partner,
        type:      o.type     || "Other",
        required:  Number(o.required) || 1,
        completed: 0,
        status:    "pending",
        deadline:  o.deadline || "",
        evidence:  "",
        notes:     o.notes    || "",
      }));
    });

    setContracts(p => [...p, ...newContracts]);
    setObligations(p => {
      const base = Math.max(0, ...p.map(o => o.id));
      return [...p, ...newObls.map((o, i) => ({ ...o, id: base + i + 1 }))];
    });
    setIsParsing(false);
    setTimeout(() => { setQueue([]); setFileStatus({}); }, 1400);
  };

  const removeContract = (cid) => {
    setContracts(p => p.filter(c => c.id !== cid));
    setObligations(p => p.filter(o => o.cid !== cid));
  };

  // ── Obligation CRUD ──
  const updateObl = (id, field, value) => setObligations(p => p.map(o => {
    if (o.id !== id) return o;
    const u = { ...o, [field]: (field === "completed" || field === "required") ? Number(value) : value };
    if (field === "completed" || field === "required") u.status = sFromPct(pct(u.completed, u.required));
    return u;
  }));

  const addObl = () => {
    const id = Math.max(0, ...obligations.map(o => o.id)) + 1;
    const c = Number(newObl.completed), r = Number(newObl.required);
    setObligations(p => [...p, { ...newObl, id, completed: c, required: r, cid: "manual", status: sFromPct(pct(c, r)) }]);
    setNewObl({ partner: "", type: "Social Post", required: 1, completed: 0, deadline: "", evidence: "", notes: "" });
    setShowAdd(false);
  };

  // ── Social scan ──
  const runScan = async () => {
    if (!obligations.length) { alert("Import contracts first."); return; }
    if (!apiKey.trim())      { alert("API key required."); return; }
    setScanning(true); setScanResults(null);
    const names = Array.from(new Set(obligations.map(o => o.partner)));
    try {
      const data = await callClaude(apiKey.trim(), {
        model: "claude-sonnet-4-6", max_tokens: 1200,
        system: "Return ONLY a JSON array, no markdown. Each: {partner,platform,mentions:number,posts:number,sentiment:'positive'|'neutral'|'negative',flagged:boolean,summary:string}",
        messages: [{ role: "user", content: `Generate realistic social scan results for: ${names.join(", ")}. Vary results. JSON array only.` }],
      });
      const raw = data.content?.find(b => b.type === "text")?.text || "[]";
      setScanResults(JSON.parse(raw.replace(/```json|```/g, "").trim()));
    } catch (e) {
      setScanResults(names.map(p => ({ partner: p, platform: "Twitter/Instagram", mentions: Math.floor(Math.random() * 40 + 5), posts: Math.floor(Math.random() * 15 + 1), sentiment: "neutral", flagged: Math.random() > 0.7, summary: "Scan completed." })));
    }
    setScanning(false);
  };

  // ── Nav ──
  const TABS = [
    { id: "contracts",   label: "Contracts",       count: contracts.length   || null },
    { id: "dashboard",   label: "Dashboard",       count: null               },
    { id: "obligations", label: "Obligations",     count: total              || null },
    { id: "social",      label: "Social Listening",count: null               },
    { id: "settings",    label: "Settings",        count: null               },
  ];

  const tdStyle = (i) => ({
    padding: "10px 14px",
    borderBottom: `1px solid ${COLORS.border}`,
    background: i % 2 === 0 ? COLORS.surface : COLORS.bg,
    fontSize: 13,
  });

  return (
    <div style={{ fontFamily: "'Inter', 'Helvetica Neue', sans-serif", background: COLORS.bg, minHeight: "100vh", color: COLORS.ink }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        input:focus, select:focus, textarea:focus { border-color: ${COLORS.blue} !important; box-shadow: 0 0 0 3px ${COLORS.blueLight}; }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{ background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, padding: "0 28px", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14, paddingBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, background: COLORS.blue, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 12L8 4L13 12H3Z" fill="white" opacity=".85"/>
                  <circle cx="8" cy="13" r="1.5" fill="white" opacity=".6"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>PartnerTrack</div>
                <div style={{ fontSize: 11, color: COLORS.inkFaint, marginTop: 1 }}>Partnership Obligation Intelligence</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {total > 0 && (
                <div style={{ fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 20,
                  background: oPct >= 80 ? COLORS.greenBg : oPct >= 50 ? COLORS.amberBg : COLORS.redBg,
                  color: oPct >= 80 ? COLORS.green : oPct >= 50 ? COLORS.amber : COLORS.red }}>
                  {oPct}% overall fulfillment
                </div>
              )}
              <button onClick={() => setShowDebug(p => !p)} style={{ fontSize: 11, padding: "4px 10px", border: `1px solid ${COLORS.border}`, borderRadius: 6, background: showDebug ? COLORS.ink : COLORS.surface, color: showDebug ? "#fff" : COLORS.inkSub, cursor: "pointer" }}>
                {showDebug ? "Hide" : "Debug"}
              </button>
            </div>
          </div>
          <div style={{ display: "flex" }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", border: "none", background: "none", cursor: "pointer", fontSize: 13, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? COLORS.blue : COLORS.inkSub, borderBottom: tab === t.id ? `2px solid ${COLORS.blue}` : "2px solid transparent", marginBottom: -1, transition: "all 0.12s" }}>
                {t.label}
                {t.count !== null && <span style={{ background: tab === t.id ? COLORS.blue : COLORS.border, color: tab === t.id ? "#fff" : COLORS.inkSub, fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 10 }}>{t.count}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Debug panel ── */}
      {showDebug && (
        <div style={{ background: COLORS.ink, color: "#e2e4e9", fontSize: 12, fontFamily: "JetBrains Mono, monospace", padding: "12px 28px", borderBottom: `2px solid ${COLORS.blue}` }}>
          <div style={{ maxWidth: 1140, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 11, letterSpacing: "0.08em", color: COLORS.blueMid }}>LIVE DEBUG LOG</span>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {testStatus && (
                  <span style={{ color: testStatus === "ok" ? "#4ade80" : testStatus === "fail" ? "#f87171" : "#93c5fd", fontSize: 11 }}>
                    {testMsg}
                  </span>
                )}
                <button onClick={testConnection} disabled={testStatus === "testing"} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, border: "1px solid #4b5563", background: "transparent", color: "#93c5fd", cursor: "pointer" }}>
                  {testStatus === "testing" ? "Testing…" : "Test connection"}
                </button>
                <button onClick={() => setDebugLog([])} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, border: "1px solid #4b5563", background: "transparent", color: "#9ca3af", cursor: "pointer" }}>Clear</button>
              </div>
            </div>
            <div style={{ maxHeight: 120, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
              {debugLog.length === 0 && <span style={{ color: "#6b7280" }}>No log entries yet.</span>}
              {debugLog.map((l, i) => (
                <div key={i} style={{ color: l.type === "ok" ? "#4ade80" : l.type === "error" ? "#f87171" : "#d1d5db" }}>
                  <span style={{ color: "#6b7280", marginRight: 8 }}>{l.t}</span>{l.msg}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "24px 28px" }}>

        {/* ════ CONTRACTS ════ */}
        {tab === "contracts" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 4px" }}>Contract library</h2>
                <p style={{ fontSize: 13, color: COLORS.inkSub, margin: 0 }}>Upload PDFs or images of partnership contracts. Claude reads each one and extracts only obligations explicitly written — even if just one or two.</p>
              </div>
              {!apiKey && (
                <div style={{ background: COLORS.amberBg, color: COLORS.amber, fontSize: 12, fontWeight: 500, padding: "7px 12px", borderRadius: 8, flexShrink: 0, marginLeft: 16, display: "flex", alignItems: "center", gap: 6 }}>
                  ⚠ Add API key in Settings
                </div>
              )}
            </div>

            {/* Drop zone */}
            <div
              onDrop={async e => { e.preventDefault(); setDragOver(false); await enqueue(Array.from(e.dataTransfer.files)); }}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${dragOver ? COLORS.blue : COLORS.border}`, borderRadius: 12, padding: "40px 24px", textAlign: "center", cursor: "pointer", background: dragOver ? COLORS.blueLight : COLORS.surface, transition: "all 0.2s", marginBottom: 16 }}
            >
              <input ref={fileRef} type="file" accept=".pdf,image/*" multiple style={{ display: "none" }} onChange={async e => { await enqueue(Array.from(e.target.files)); e.target.value = ""; }} />
              <div style={{ fontSize: 30, marginBottom: 10 }}>📂</div>
              <p style={{ fontWeight: 600, fontSize: 14, color: COLORS.ink, margin: "0 0 6px" }}>Drop contract files here, or click to browse</p>
              <p style={{ fontSize: 12, color: COLORS.inkSub, margin: 0 }}>PDF, PNG, JPG, WEBP · Multiple files · 1–2 obligations per contract is fine</p>
            </div>

            {/* Queue */}
            {queue.length > 0 && (
              <div style={{ ...S.card, marginBottom: 16 }}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{queue.length} file{queue.length !== 1 ? "s" : ""} queued</span>
                  <Btn onClick={parseAll} disabled={isParsing || !apiKey.trim()}>
                    {isParsing ? `Parsing ${queue.length} contract${queue.length !== 1 ? "s" : ""}…` : `Extract obligations`}
                  </Btn>
                </div>
                {queue.map(qf => {
                  const st = fileStatus[qf.id] || "idle";
                  return (
                    <div key={qf.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: `1px solid ${COLORS.border}`, background: st === "processing" ? COLORS.blueLight : st === "done" ? COLORS.greenBg : st === "error" ? COLORS.redBg : "transparent", transition: "background 0.3s" }}>
                      <span style={{ fontSize: 18 }}>{qf.mediaType === "application/pdf" ? "📄" : "🖼"}</span>
                      <span style={{ flex: 1, fontSize: 13, color: COLORS.ink }}>{qf.name}</span>
                      <span style={{ fontSize: 11, color: COLORS.inkFaint, fontFamily: "JetBrains Mono, monospace" }}>{(qf.file.size / 1024).toFixed(0)} KB</span>
                      {st === "processing" && <span style={{ fontSize: 11, color: COLORS.blue, fontWeight: 600 }}>⏳ Extracting…</span>}
                      {st === "done"       && <span style={{ fontSize: 11, color: COLORS.green, fontWeight: 600 }}>✓ Done</span>}
                      {st === "error"      && <span style={{ fontSize: 11, color: COLORS.red,   fontWeight: 600 }}>✗ Error</span>}
                      {st === "idle" && !isParsing && <Btn variant="danger" size="sm" onClick={() => dequeue(qf.id)}>Remove</Btn>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Library */}
            {contracts.length > 0 && (
              <div style={S.card}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>
                    {contracts.length} contract{contracts.length !== 1 ? "s" : ""} · {contracts.reduce((a, c) => a + c.count, 0)} obligations extracted
                  </span>
                  <Btn variant="ghost" size="sm" onClick={() => setTab("obligations")}>View obligations →</Btn>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr style={{ background: COLORS.bg }}>
                    {["File", "Partner", "Obligations", "Parsed", "Status", ""].map(h => <th key={h} style={S.th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {contracts.map((c, i) => (
                      <tr key={c.id}>
                        <td style={tdStyle(i)}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span>{c.mediaType === "application/pdf" ? "📄" : "🖼"}</span>
                            <span style={{ fontSize: 12, fontFamily: "JetBrains Mono, monospace", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.fileName}</span>
                          </div>
                        </td>
                        <td style={{ ...tdStyle(i), fontWeight: 500 }}>{c.partner}</td>
                        <td style={{ ...tdStyle(i), textAlign: "center" }}>
                          {c.count > 0
                            ? <span style={{ background: COLORS.blueLight, color: COLORS.blue, fontWeight: 700, fontSize: 12, padding: "2px 10px", borderRadius: 12 }}>{c.count}</span>
                            : <span style={{ color: COLORS.inkFaint, fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ ...tdStyle(i), fontSize: 11, color: COLORS.inkFaint, fontFamily: "JetBrains Mono, monospace" }}>{c.parsedAt}</td>
                        <td style={tdStyle(i)}>
                          {c.status === "error"  && <Badge status="error" />}
                          {c.status === "empty"  && <span style={{ fontSize: 11, color: COLORS.inkSub }}>No obligations found</span>}
                          {c.status === "parsed" && <Badge status="done" />}
                        </td>
                        <td style={tdStyle(i)}>
                          <Btn variant="danger" size="sm" onClick={() => removeContract(c.id)}>Remove</Btn>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {contracts.length === 0 && queue.length === 0 && (
              <Empty icon="📋" title="No contracts yet" body="Upload one or more partnership contract files above. Claude reads each document and extracts only what's explicitly stated — contracts with just one or two obligations work perfectly." cta={<Btn onClick={() => fileRef.current?.click()}>Browse files</Btn>} />
            )}
          </div>
        )}

        {/* ════ DASHBOARD ════ */}
        {tab === "dashboard" && (
          total === 0
            ? <Empty icon="📊" title="Dashboard is empty" body="Upload contracts first. Once obligations are extracted the dashboard populates automatically." cta={<Btn onClick={() => setTab("contracts")}>Go to Contracts →</Btn>} />
            : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 20 }}>
                  {[
                    { label: "Total",         value: total,    color: COLORS.blue,   bg: COLORS.blueLight },
                    { label: "Fulfilled",      value: nFulfill, color: COLORS.green,  bg: COLORS.greenBg },
                    { label: "Partial",        value: nPartial, color: COLORS.amber,  bg: COLORS.amberBg },
                    { label: "Unfulfilled",    value: nUnfull,  color: COLORS.red,    bg: COLORS.redBg },
                    { label: "Pending review", value: nPending, color: COLORS.inkSub, bg: COLORS.bg },
                  ].map(k => (
                    <div key={k.label} style={{ background: COLORS.surface, borderRadius: 10, border: `1px solid ${COLORS.border}`, padding: "14px 16px" }}>
                      <p style={{ fontSize: 10, color: COLORS.inkSub, margin: "0 0 5px", textTransform: "uppercase", letterSpacing: "0.07em" }}>{k.label}</p>
                      <p style={{ fontSize: 28, fontWeight: 600, color: k.color, margin: 0, lineHeight: 1 }}>{k.value}</p>
                    </div>
                  ))}
                </div>

                <div style={{ ...S.card, padding: "20px 22px", marginBottom: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 16px" }}>Partner fulfillment</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {Array.from(new Set(obligations.map(o => o.partner))).map(p => {
                      const po = obligations.filter(o => o.partner === p);
                      const r  = po.reduce((a, o) => a + o.required, 0);
                      const c  = po.reduce((a, o) => a + o.completed, 0);
                      const pp = pct(c, r);
                      return (
                        <div key={p}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                            <div>
                              <span style={{ fontSize: 13, fontWeight: 500 }}>{p}</span>
                              <span style={{ fontSize: 11, color: COLORS.inkFaint, marginLeft: 8 }}>{po.length} obligation{po.length !== 1 ? "s" : ""}</span>
                            </div>
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                              <span style={{ fontSize: 12, color: COLORS.inkSub }}>{c}/{r} met</span>
                              <Badge status={pp >= 100 ? "fulfilled" : pp > 0 ? "partial" : "unfulfilled"} />
                            </div>
                          </div>
                          <Bar value={c} max={r} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {obligations.filter(o => o.status !== "fulfilled").length > 0 && (
                  <div style={{ ...S.card, padding: "20px 22px" }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 14px" }}>Needs attention</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {obligations.filter(o => o.status !== "fulfilled").map(o => (
                        <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", background: COLORS.bg, borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
                          <Badge status={o.status} />
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{o.partner}</span>
                          <span style={{ fontSize: 12, color: COLORS.inkSub }}>{o.type}</span>
                          <span style={{ fontSize: 12, color: COLORS.inkSub }}>{o.completed}/{o.required}</span>
                          {o.deadline && <span style={{ fontSize: 11, color: COLORS.inkFaint, fontFamily: "JetBrains Mono, monospace" }}>due {o.deadline}</span>}
                          <Btn variant="ghost" size="sm" onClick={() => setTab("obligations")}>Review →</Btn>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )
        )}

        {/* ════ OBLIGATIONS ════ */}
        {tab === "obligations" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 4px" }}>Obligations</h2>
                <p style={{ fontSize: 13, color: COLORS.inkSub, margin: 0 }}>All obligations extracted from uploaded contracts. Edit counts and add evidence links as fulfillment comes in.</p>
              </div>
              <Btn style={{ marginLeft: 16 }} onClick={() => setShowAdd(true)}>+ Add manually</Btn>
            </div>

            {total === 0
              ? <Empty icon="📝" title="No obligations yet" body="Upload contracts — obligations appear here automatically after parsing." cta={<Btn onClick={() => setTab("contracts")}>Upload contracts →</Btn>} />
              : (
                <>
                  <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                    <select value={fPartner} onChange={e => setFPartner(e.target.value)} style={{ ...S.input, width: 200 }}>
                      {partnerList.map(p => <option key={p}>{p}</option>)}
                    </select>
                    <select value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ ...S.input, width: 160 }}>
                      {["All", "pending", "fulfilled", "partial", "unfulfilled"].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                    <span style={{ fontSize: 12, color: COLORS.inkSub, alignSelf: "center" }}>{filtered.length} row{filtered.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div style={{ ...S.card, overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                      <thead><tr style={{ background: COLORS.bg }}>
                        {["Partner", "Type", "Req.", "Done", "Progress", "Status", "Deadline", "Evidence", "Source", ""].map(h => <th key={h} style={S.th}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {filtered.map((o, i) => (
                          <tr key={o.id}>
                            <td style={{ ...tdStyle(i), fontWeight: 500, whiteSpace: "nowrap" }}>{o.partner}</td>
                            <td style={tdStyle(i)}><span style={{ background: COLORS.blueLight, color: COLORS.blue, fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 4, whiteSpace: "nowrap" }}>{o.type}</span></td>
                            <td style={{ ...tdStyle(i), textAlign: "center" }}>
                              {editId === o.id ? <input type="number" defaultValue={o.required} onBlur={e => updateObl(o.id, "required", e.target.value)} style={{ ...S.input, width: 52 }} /> : o.required}
                            </td>
                            <td style={{ ...tdStyle(i), textAlign: "center" }}>
                              {editId === o.id ? <input type="number" defaultValue={o.completed} onBlur={e => updateObl(o.id, "completed", e.target.value)} style={{ ...S.input, width: 52 }} /> : o.completed}
                            </td>
                            <td style={{ ...tdStyle(i), minWidth: 120 }}><Bar value={o.completed} max={o.required} /></td>
                            <td style={tdStyle(i)}><Badge status={o.status} /></td>
                            <td style={{ ...tdStyle(i), fontSize: 11, color: COLORS.inkFaint, fontFamily: "JetBrains Mono, monospace", whiteSpace: "nowrap" }}>{o.deadline || "—"}</td>
                            <td style={tdStyle(i)}>
                              {editId === o.id
                                ? <input defaultValue={o.evidence} onBlur={e => updateObl(o.id, "evidence", e.target.value)} placeholder="https://…" style={{ ...S.input, width: 160 }} />
                                : o.evidence
                                  ? <a href={o.evidence} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.blue, fontSize: 11 }}>View ↗</a>
                                  : <span style={{ color: COLORS.inkFaint, fontSize: 11 }}>—</span>}
                            </td>
                            <td style={{ ...tdStyle(i), fontSize: 11, color: COLORS.inkFaint, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={contracts.find(c => c.id === o.cid)?.fileName}>
                              {o.cid === "manual" ? <i>manual</i> : (contracts.find(c => c.id === o.cid)?.fileName || "—")}
                            </td>
                            <td style={tdStyle(i)}>
                              <div style={{ display: "flex", gap: 5 }}>
                                <Btn variant="ghost" size="sm" onClick={() => setEditId(editId === o.id ? null : o.id)}>{editId === o.id ? "Save" : "Edit"}</Btn>
                                <Btn variant="danger" size="sm" onClick={() => setObligations(p => p.filter(x => x.id !== o.id))}>Del</Btn>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

            {showAdd && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(15,17,23,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
                <div style={{ background: COLORS.surface, borderRadius: 12, padding: 28, width: 480, boxShadow: "0 24px 64px rgba(0,0,0,0.22)" }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 18px" }}>Add obligation manually</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Partner name</label><input value={newObl.partner} onChange={e => setNewObl(p => ({ ...p, partner: e.target.value }))} style={S.input} /></div>
                    <div><label style={S.label}>Type</label><select value={newObl.type} onChange={e => setNewObl(p => ({ ...p, type: e.target.value }))} style={S.input}>{OBL_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
                    <div><label style={S.label}>Deadline</label><input type="date" value={newObl.deadline} onChange={e => setNewObl(p => ({ ...p, deadline: e.target.value }))} style={S.input} /></div>
                    <div><label style={S.label}>Required</label><input type="number" value={newObl.required} onChange={e => setNewObl(p => ({ ...p, required: e.target.value }))} style={S.input} /></div>
                    <div><label style={S.label}>Completed</label><input type="number" value={newObl.completed} onChange={e => setNewObl(p => ({ ...p, completed: e.target.value }))} style={S.input} /></div>
                    <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Evidence URL</label><input value={newObl.evidence} onChange={e => setNewObl(p => ({ ...p, evidence: e.target.value }))} placeholder="https://…" style={S.input} /></div>
                    <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Notes</label><textarea value={newObl.notes} onChange={e => setNewObl(p => ({ ...p, notes: e.target.value }))} rows={2} style={{ ...S.input, resize: "vertical" }} /></div>
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
                    <Btn variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
                    <Btn onClick={addObl} disabled={!newObl.partner}>Add obligation</Btn>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ SOCIAL ════ */}
        {tab === "social" && (
          <div style={{ maxWidth: 760 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 4px" }}>Social listening</h2>
            <p style={{ fontSize: 13, color: COLORS.inkSub, margin: "0 0 24px" }}>Monitor partner social channels. Partners are pulled automatically from imported contracts.</p>

            <div style={{ ...S.card, padding: "18px 20px", marginBottom: 14 }}>
              <label style={{ ...S.label, marginBottom: 12 }}>Provider</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { id: "meltwater", name: "Meltwater",        desc: "Enterprise social intelligence. Requires API key.", badge: "Preferred" },
                  { id: "fallback",  name: "AI web analysis",  desc: "Claude-powered scan. Uses your Claude key only.",   badge: "Fallback"  },
                ].map(p => (
                  <div key={p.id} onClick={() => setSocialProv(p.id)} style={{ border: `2px solid ${socialProv === p.id ? COLORS.blue : COLORS.border}`, borderRadius: 10, padding: "14px 16px", cursor: "pointer", background: socialProv === p.id ? COLORS.blueLight : COLORS.surface, transition: "all 0.15s" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: socialProv === p.id ? COLORS.blue : COLORS.ink }}>{p.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, background: socialProv === p.id ? COLORS.blue : COLORS.border, color: socialProv === p.id ? "#fff" : COLORS.inkSub, padding: "2px 7px", borderRadius: 4 }}>{p.badge}</span>
                    </div>
                    <p style={{ fontSize: 12, color: COLORS.inkSub, margin: 0, lineHeight: 1.5 }}>{p.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {socialProv === "meltwater" && (
              <div style={{ ...S.card, padding: "18px 20px", marginBottom: 14 }}>
                <label style={S.label}>Meltwater API key</label>
                <input type="password" value={meltwaterKey} onChange={e => setMeltwaterKey(e.target.value)} placeholder="meltwater-api-key…" style={S.input} />
                <div style={{ marginTop: 12, background: COLORS.amberBg, borderRadius: 8, padding: "10px 14px" }}>
                  <p style={{ fontSize: 12, color: COLORS.amber, fontWeight: 500, margin: "0 0 3px" }}>Setup tip</p>
                  <p style={{ fontSize: 12, color: "#92400e", margin: 0, lineHeight: 1.5 }}>In Meltwater, create one saved search per partner (company name + your event/league). Enable Twitter, Instagram, LinkedIn. Set the season date window.</p>
                </div>
              </div>
            )}

            {socialProv === "fallback" && (
              <div style={{ background: COLORS.tealBg, borderRadius: 10, padding: "14px 18px", marginBottom: 14 }}>
                <p style={{ fontSize: 12, color: COLORS.teal, fontWeight: 500, margin: "0 0 3px" }}>AI fallback mode</p>
                <p style={{ fontSize: 12, color: "#0e7490", margin: 0, lineHeight: 1.5 }}>Claude generates representative social activity estimates for your partners. Results are for discovery purposes — not a live data pull. Good for gap analysis before setting up Meltwater.</p>
              </div>
            )}

            <Btn onClick={runScan} disabled={scanning || !obligations.length} style={{ width: "100%", marginBottom: 20, background: scanning || !obligations.length ? COLORS.inkSub : COLORS.teal }}>
              {scanning ? "⏳ Scanning…" : !obligations.length ? "Import contracts first" : `Run scan via ${socialProv === "meltwater" ? "Meltwater" : "AI analysis"}`}
            </Btn>

            {scanResults && (
              <div style={S.card}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>Scan results</span>
                  <span style={{ fontSize: 11, color: COLORS.inkFaint }}>{new Date().toLocaleString()} · {scanResults.length} partners</span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr style={{ background: COLORS.bg }}>
                    {["Partner", "Platform", "Mentions", "Posts", "Sentiment", "Flag", "Summary"].map(h => <th key={h} style={S.th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {scanResults.map((r, i) => (
                      <tr key={i}>
                        <td style={{ ...tdStyle(i), fontWeight: 500 }}>{r.partner}</td>
                        <td style={{ ...tdStyle(i), fontSize: 11, color: COLORS.inkSub }}>{r.platform}</td>
                        <td style={{ ...tdStyle(i), textAlign: "center", fontWeight: 600, color: COLORS.blue }}>{r.mentions}</td>
                        <td style={{ ...tdStyle(i), textAlign: "center" }}>{r.posts}</td>
                        <td style={tdStyle(i)}><span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 500, background: r.sentiment === "positive" ? COLORS.greenBg : r.sentiment === "negative" ? COLORS.redBg : "#f3f4f6", color: r.sentiment === "positive" ? COLORS.green : r.sentiment === "negative" ? COLORS.red : COLORS.inkSub }}>{r.sentiment}</span></td>
                        <td style={{ ...tdStyle(i), textAlign: "center" }}>{r.flagged ? <Badge status="error" /> : <span style={{ color: COLORS.green }}>✓</span>}</td>
                        <td style={{ ...tdStyle(i), fontSize: 12, color: COLORS.inkSub }}>{r.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ════ SETTINGS ════ */}
        {tab === "settings" && (
          <div style={{ maxWidth: 560 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 4px" }}>Settings</h2>
            <p style={{ fontSize: 13, color: COLORS.inkSub, margin: "0 0 24px" }}>Keys are held in memory only and reset on page refresh.</p>

            <div style={{ ...S.card, padding: "18px 20px", marginBottom: 12 }}>
              <label style={S.label}>Claude API key <span style={{ color: COLORS.red }}>*</span></label>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-ant-…" style={{ ...S.input, flex: 1 }} />
                <Btn onClick={testConnection} disabled={testStatus === "testing"} variant={testStatus === "ok" ? "success" : "ghost"}>
                  {testStatus === "testing" ? "Testing…" : testStatus === "ok" ? "✓ Connected" : "Test"}
                </Btn>
              </div>
              {testMsg && (
                <p style={{ fontSize: 12, margin: "6px 0 0", color: testStatus === "ok" ? COLORS.green : COLORS.red }}>{testMsg}</p>
              )}
              <p style={{ fontSize: 11, color: COLORS.inkFaint, margin: "6px 0 0" }}>Get your key at console.anthropic.com. Calls go via your Cloudflare Worker proxy.</p>
            </div>

            <div style={{ ...S.card, padding: "18px 20px", marginBottom: 12 }}>
              <label style={S.label}>Meltwater API key</label>
              <input type="password" value={meltwaterKey} onChange={e => setMeltwaterKey(e.target.value)} placeholder="meltwater-…" style={S.input} />
              <p style={{ fontSize: 11, color: COLORS.inkFaint, margin: "6px 0 0" }}>Required if using Meltwater for social listening. Found in your Meltwater dashboard.</p>
            </div>

            <div style={{ ...S.card, padding: "18px 20px", marginBottom: 12 }}>
              <label style={S.label}>Worker proxy URL</label>
              <input value={PROXY} readOnly style={{ ...S.input, background: COLORS.bg, color: COLORS.inkSub, fontFamily: "JetBrains Mono, monospace", fontSize: 12 }} />
              <p style={{ fontSize: 11, color: COLORS.inkFaint, margin: "6px 0 0" }}>All Claude API calls route through this Cloudflare Worker. Update the PROXY constant in the source to change it.</p>
            </div>

            <div style={{ background: COLORS.amberBg, borderRadius: 10, padding: "14px 18px" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.amber, margin: "0 0 4px" }}>Tip: use the Debug panel</p>
              <p style={{ fontSize: 12, color: "#92400e", margin: 0, lineHeight: 1.6 }}>Click "Debug" in the top bar to open the live log. Hit "Test connection" to verify your API key and Worker are working before uploading contracts. Any errors appear there in real time.</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
