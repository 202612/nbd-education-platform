import React, { useState, useEffect, useRef } from "react";
import {
  PlayCircle, Award, Users, Plus, Check, X,
  Clock, ChevronRight, ChevronLeft, ShieldCheck, Upload, Loader2, Sparkles, Send,
  Building2, Search,
} from "lucide-react";
import { navy, gold, Badge, StatCard } from "../lib/ui.jsx";

// Demo data for the admin back office. Brand/module/quiz management and approvals
// still run on local state here — this is the part of the build plan's step 3
// ("rebuild the admin screens against the real database") that comes next.
const defaultData = {
  brands: [
    { id: "b1", name: "Eleven Australia", tagline: "Haircare & styling", modules: [] },
    { id: "b2", name: "Kevin.Murphy", tagline: "Haircare", modules: [] },
    { id: "b3", name: "Color Wow", tagline: "Colour care & styling", modules: [] },
    { id: "b4", name: "Aveda", tagline: "Haircare & wellness", modules: [] },
    { id: "b5", name: "Davines", tagline: "Sustainable haircare", modules: [] },
    { id: "b6", name: "K18", tagline: "Bond repair treatment", modules: [] },
    { id: "b7", name: "Living Proof", tagline: "Haircare technology", modules: [] },
  ],
  requests: [
    { id: "r1", company: "The Colour Room, Cork", contact: "Aisling Byrne", email: "aisling@thecolourroom.ie", brands: ["b1", "b3"], date: "22 Aug 2026", status: "pending" },
  ],
  progress: {},
  staff: [{ id: "s1", name: "Ronan Casey", email: "ronan@thecolourroom.ie" }],
  customers: [
    {
      id: "c1", customerNumber: "CU-1001", company: "The Colour Room, Cork",
      mainContact: "Aisling Byrne", mainEmail: "aisling@thecolourroom.ie",
      approvedBrands: ["b1"], staff: [{ name: "Ronan Casey", email: "ronan@thecolourroom.ie" }],
      progress: {},
    },
    {
      id: "c2", customerNumber: "CU-1002", company: "Verve Studio, Galway",
      mainContact: "Marcus O'Neill", mainEmail: "marcus@vervestudio.ie",
      approvedBrands: ["b6"], staff: [],
      progress: {},
    },
    {
      id: "c3", customerNumber: "CU-1003", company: "Bloom Hair & Beauty, Dublin",
      mainContact: "Niamh Kelly", mainEmail: "niamh@bloomhair.ie",
      approvedBrands: ["b1", "b4", "b7"], staff: [{ name: "Sarah Doyle", email: "sarah@bloomhair.ie" }, { name: "Emma Walsh", email: "emma@bloomhair.ie" }],
      progress: {},
    },
  ],
};

function AdminBrands({ brands, patch }) {
  const [activeBrand, setActiveBrand] = useState(null);
  const [showAddBrand, setShowAddBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [showAddModule, setShowAddModule] = useState(false);
  const [videoTitle, setVideoTitle] = useState("");
  const [duration, setDuration] = useState("");
  const [questions, setQuestions] = useState([{ text: "", options: ["", ""], correct: 0 }]);
  const [error, setError] = useState("");
  const [uploadName, setUploadName] = useState("");

  const brand = brands.find((b) => b.id === activeBrand);

  function addBrand() {
    if (!newBrandName.trim()) { setError("Enter a brand name first"); return; }
    patch({ brands: [...brands, { id: "b" + Date.now(), name: newBrandName, tagline: "New brand", modules: [] }] });
    setNewBrandName(""); setShowAddBrand(false); setError("");
  }

  function saveModule() {
    if (!videoTitle.trim()) { setError("Enter a video title first"); return; }
    for (const q of questions) {
      if (!q.text.trim() || q.options.some((o) => !o.trim())) { setError("Fill in every question and answer option before saving"); return; }
    }
    const newModule = { id: "m" + Date.now(), title: videoTitle, duration: duration || "—", questions: questions.map((q, i) => ({ id: "q" + Date.now() + i, ...q })) };
    patch({ brands: brands.map((b) => (b.id === brand.id ? { ...b, modules: [...b.modules, newModule] } : b)) });
    setVideoTitle(""); setDuration(""); setQuestions([{ text: "", options: ["", ""], correct: 0 }]); setUploadName(""); setShowAddModule(false); setError("");
  }

  if (brand) {
    return (
      <div>
        <button onClick={() => setActiveBrand(null)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: navy[700], marginBottom: 16, background: "none" }}>
          <ChevronLeft size={15} /> All brands
        </button>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: navy[900], margin: "0 0 4px" }}>{brand.name}</h2>
        <p style={{ color: "#8a8074", fontSize: 14, margin: "0 0 20px" }}>{brand.modules.length} module{brand.modules.length !== 1 ? "s" : ""} in this category</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {brand.modules.map((m, i) => (
            <div key={m.id} style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, color: "#8a8074", marginBottom: 2 }}>Video {i + 1}</div>
                <div style={{ fontWeight: 500, color: navy[900] }}>{m.title}</div>
                <div style={{ fontSize: 13, color: "#8a8074", marginTop: 4 }}>{m.duration} · {m.questions.length} quiz question{m.questions.length !== 1 ? "s" : ""}</div>
              </div>
              <Badge tone="gold">Live</Badge>
            </div>
          ))}
          {brand.modules.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#4d6b2c", padding: "10px 16px", background: "#eef5e6", borderRadius: 10 }}>
              <Award size={15} /> Certificate issued automatically once all modules are passed
            </div>
          )}
        </div>

        {!showAddModule ? (
          <button onClick={() => setShowAddModule(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: navy[700], color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 500 }}>
            <Plus size={16} /> Add video + quiz
          </button>
        ) : (
          <div style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 14px", color: navy[900] }}>New module</h3>
            <label style={{ fontSize: 13, color: "#6b6155", display: "block", marginBottom: 4 }}>Video title</label>
            <input value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} placeholder="e.g. Applying the bond-repair additive" style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 12, fontSize: 14 }} />

            <label style={{ fontSize: 13, color: "#6b6155", display: "block", marginBottom: 4 }}>Video file</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, border: "1px dashed #ccc2b3", borderRadius: 6, padding: "10px 12px", marginBottom: 4, fontSize: 13, color: "#8a8074", cursor: "pointer" }}>
              <Upload size={15} />
              {uploadName || "Choose a video file to upload"}
              <input type="file" accept="video/*" style={{ display: "none" }} onChange={(e) => setUploadName(e.target.files[0]?.name || "")} />
            </label>
            <div style={{ fontSize: 12, color: "#a39a8d", marginBottom: 12 }}>Shell only — real video storage connects here once the platform is built out.</div>

            <label style={{ fontSize: 13, color: "#6b6155", display: "block", marginBottom: 4 }}>Duration</label>
            <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 6 min" style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 16, fontSize: 14 }} />

            <div style={{ borderTop: "1px solid #e4dfd6", paddingTop: 14 }}>
              <div style={{ fontSize: 13, color: "#6b6155", marginBottom: 8 }}>Quiz questions (must pass to unlock the next video)</div>
              {questions.map((q, qi) => (
                <div key={qi} style={{ background: cream, borderRadius: 8, padding: 12, marginBottom: 10 }}>
                  <input value={q.text} onChange={(e) => { const qs = [...questions]; qs[qi].text = e.target.value; setQuestions(qs); }} placeholder={`Question ${qi + 1}`} style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 8, fontSize: 14 }} />
                  {q.options.map((opt, oi) => (
                    <div key={oi} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <input type="radio" checked={q.correct === oi} onChange={() => { const qs = [...questions]; qs[qi].correct = oi; setQuestions(qs); }} />
                      <input value={opt} onChange={(e) => { const qs = [...questions]; qs[qi].options[oi] = e.target.value; setQuestions(qs); }} placeholder={`Answer option ${oi + 1}`} style={{ flex: 1, padding: "6px 10px", border: "1px solid #ddd5cb", borderRadius: 6, fontSize: 13 }} />
                    </div>
                  ))}
                  <button onClick={() => { const qs = [...questions]; qs[qi].options.push(""); setQuestions(qs); }} style={{ fontSize: 12, color: navy[700], background: "none" }}>+ Add option</button>
                </div>
              ))}
              <button onClick={() => setQuestions([...questions, { text: "", options: ["", ""], correct: 0 }])} style={{ fontSize: 13, color: navy[700], background: "none", marginBottom: 14 }}>+ Add another question</button>
            </div>

            {error && <div style={{ color: "#a3372f", fontSize: 13, marginBottom: 10 }}>{error}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={saveModule} style={{ background: navy[700], color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 14, fontWeight: 500 }}>Save module</button>
              <button onClick={() => { setShowAddModule(false); setError(""); }} style={{ background: "none", border: "1px solid #ddd5cb", borderRadius: 8, padding: "9px 16px", fontSize: 14 }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: navy[900], margin: 0 }}>Brands</h2>
        <button onClick={() => setShowAddBrand(!showAddBrand)} style={{ display: "flex", alignItems: "center", gap: 6, background: navy[700], color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 500 }}>
          <Plus size={15} /> Add brand
        </button>
      </div>
      {showAddBrand && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)} placeholder="Brand name" style={{ flex: 1, padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, fontSize: 14 }} />
          <button onClick={addBrand} style={{ background: navy[700], color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 13 }}>Save</button>
        </div>
      )}
      {error && <div style={{ color: "#a3372f", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {brands.map((b) => (
          <button key={b.id} onClick={() => setActiveBrand(b.id)} style={{ textAlign: "left", background: "#fff", border: "1px solid #e4dfd6", borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 600, color: navy[900], marginBottom: 4 }}>{b.name}</div>
            <div style={{ fontSize: 13, color: "#8a8074", marginBottom: 10 }}>{b.tagline}</div>
            <Badge>{b.modules.length} module{b.modules.length !== 1 ? "s" : ""}</Badge>
          </button>
        ))}
      </div>
    </div>
  );
}

function AdminApprovals({ requests, patch, brands }) {
  const [toast, setToast] = useState("");
  function decide(id, decision) {
    const req = requests.find((r) => r.id === id);
    patch({ requests: requests.map((r) => (r.id === id ? { ...r, status: decision } : r)) });
    setToast(decision === "approved" ? `Marked approved — this is where the real system would email ${req.email}` : `${req.company} marked as declined`);
    setTimeout(() => setToast(""), 3500);
  }
  const pending = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending");
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: navy[900], margin: "0 0 4px" }}>Account approvals</h2>
      <p style={{ color: "#8a8074", fontSize: 14, margin: "0 0 20px" }}>New customer signups wait here until you approve brand access manually.</p>
      {toast && <div style={{ background: "#eef5e6", color: "#4d6b2c", fontSize: 13, padding: "8px 14px", borderRadius: 8, marginBottom: 14 }}>{toast}</div>}
      {pending.length === 0 && <div style={{ color: "#8a8074", fontSize: 14 }}>No pending requests.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {pending.map((r) => (
          <div key={r.id} style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 600, color: navy[900] }}>{r.company}</div>
              <div style={{ fontSize: 13, color: "#8a8074" }}>{r.contact} · {r.email}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {r.brands.map((bid) => <Badge key={bid}>{brands.find((b) => b.id === bid)?.name}</Badge>)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => decide(r.id, "approved")} style={{ display: "flex", alignItems: "center", gap: 5, background: "#4a6b3d", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 500 }}>
                <Check size={14} /> Approve
              </button>
              <button onClick={() => decide(r.id, "declined")} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "1px solid #ddd5cb", borderRadius: 8, padding: "8px 14px", fontSize: 13 }}>
                <X size={14} /> Decline
              </button>
            </div>
          </div>
        ))}
      </div>
      {decided.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#6b6155", margin: "0 0 10px" }}>Recently decided</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {decided.map((r) => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#8a8074", padding: "8px 4px", borderBottom: "1px solid #e4dfd6" }}>
                <span>{r.company}</span>
                <Badge tone={r.status === "approved" ? "gold" : "muted"}>{r.status}</Badge>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AdminDashboard({ brands, requests, customers }) {
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const totalModules = brands.reduce((s, b) => s + b.modules.length, 0);
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: navy[900], margin: "0 0 16px" }}>Overview</h2>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Brands" value={brands.length} icon={ShieldCheck} />
        <StatCard label="Total modules" value={totalModules} icon={PlayCircle} />
        <StatCard label="Customers" value={customers.length} icon={Building2} />
        <StatCard label="Pending approvals" value={pendingCount} icon={Clock} />
      </div>
      <div style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 12, padding: 18 }}>
        <div style={{ fontWeight: 600, color: navy[900], marginBottom: 10 }}>What's real vs. simulated in this shell</div>
        <div style={{ fontSize: 14, color: "#6b6155", lineHeight: 1.7 }}>
          Brands, modules, quizzes, approvals, and learner progress all save for real — reload this page and it's
          still here. Video upload and approval emails are placeholders for now; those need real file storage and
          an email service, which come with the full build.
        </div>
      </div>
    </div>
  );
}

async function callAdminAssistant(instruction, data) {
  const brandsSummary = data.brands.map((b) => ({ id: b.id, name: b.name, modules: b.modules.map((m) => m.title) }));
  const pendingSummary = data.requests.filter((r) => r.status === "pending").map((r) => ({ id: r.id, company: r.company }));

  const prompt = `You are an admin assistant inside an education platform's back office. The admin will give you a plain-language instruction. Match it to exactly ONE of the JSON action shapes below and respond with ONLY that JSON object — no markdown fences, no explanation, no extra text.

Current brands (id, name, existing module titles):
${JSON.stringify(brandsSummary)}

Current pending access requests (id, company):
${JSON.stringify(pendingSummary)}

Action shapes:
{"action":"add_brand","name":"...","tagline":"a few words"}
{"action":"add_module","brandId":"<pick the closest matching id from the brands list above>","title":"...","duration":"e.g. 6 min","questions":[{"text":"...","options":["...","...","...","..."],"correct":0}]}
{"action":"approve_request","requestId":"<pick the closest matching id from the pending list above>"}
{"action":"decline_request","requestId":"<pick the closest matching id from the pending list above>"}
{"action":"unknown","message":"one short sentence explaining what you need clarified"}

Rules: if the instruction asks to add a module/video and doesn't specify quiz questions, invent 1-2 sensible, on-topic multiple-choice questions yourself (4 options each, correct is the 0-based index). If the instruction doesn't clearly match a brand or request in the lists, or is ambiguous, use "unknown". Never invent a brandId or requestId that isn't in the lists above.

Admin instruction: "${instruction}"`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const json = await response.json();
  const textBlock = (json.content || []).find((c) => c.type === "text");
  if (!textBlock) throw new Error("No response from assistant");
  const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

export function AdminAssistant({ data, patch }) {
  const [instruction, setInstruction] = useState("");
  const [log, setLog] = useState([
    { role: "system", text: "Tell me what to change — e.g. \"Add a brand called Solene Colour Studio\" or \"Add a module to Verde Skin Science about SPF basics with 2 quiz questions\" or \"Approve The Colour Room\"." },
  ]);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [log]);

  async function send() {
    const text = instruction.trim();
    if (!text || busy) return;
    setLog((l) => [...l, { role: "user", text }]);
    setInstruction("");
    setBusy(true);
    try {
      const result = await callAdminAssistant(text, data);
      applyAction(result);
    } catch (e) {
      setLog((l) => [...l, { role: "system", text: "Couldn't complete that — try rephrasing, or check the request." }]);
    } finally {
      setBusy(false);
    }
  }

  function applyAction(result) {
    if (result.action === "add_brand") {
      patch({ brands: [...data.brands, { id: "b" + Date.now(), name: result.name, tagline: result.tagline || "New brand", modules: [] }] });
      setLog((l) => [...l, { role: "system", text: `Added brand "${result.name}".` }]);
    } else if (result.action === "add_module") {
      const brand = data.brands.find((b) => b.id === result.brandId);
      if (!brand) { setLog((l) => [...l, { role: "system", text: "Couldn't find that brand — try naming it exactly." }]); return; }
      const newModule = { id: "m" + Date.now(), title: result.title, duration: result.duration || "—", questions: (result.questions || []).map((q, i) => ({ id: "q" + Date.now() + i, text: q.text, options: q.options, correct: q.correct })) };
      patch({ brands: data.brands.map((b) => (b.id === brand.id ? { ...b, modules: [...b.modules, newModule] } : b)) });
      setLog((l) => [...l, { role: "system", text: `Added "${result.title}" to ${brand.name} with ${newModule.questions.length} quiz question${newModule.questions.length !== 1 ? "s" : ""}.` }]);
    } else if (result.action === "approve_request" || result.action === "decline_request") {
      const req = data.requests.find((r) => r.id === result.requestId);
      if (!req) { setLog((l) => [...l, { role: "system", text: "Couldn't find that request — try naming the company exactly." }]); return; }
      const decision = result.action === "approve_request" ? "approved" : "declined";
      patch({ requests: data.requests.map((r) => (r.id === req.id ? { ...r, status: decision } : r)) });
      setLog((l) => [...l, { role: "system", text: `${req.company} marked as ${decision}.` }]);
    } else {
      setLog((l) => [...l, { role: "system", text: result.message || "I wasn't sure what you meant — could you rephrase that?" }]);
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: navy[900], margin: "0 0 4px" }}>AI assistant</h2>
      <p style={{ color: "#8a8074", fontSize: 14, margin: "0 0 16px" }}>Make changes by describing them — it edits brands, modules, quizzes, and approvals for you.</p>

      <div ref={scrollRef} style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 12, padding: 16, height: 320, overflowY: "auto", marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {log.map((entry, i) => (
          <div key={i} style={{
            alignSelf: entry.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "80%", fontSize: 13.5, lineHeight: 1.5, padding: "9px 13px", borderRadius: 10,
            background: entry.role === "user" ? navy[700] : navy[50],
            color: entry.role === "user" ? "#fff" : navy[900],
          }}>
            {entry.text}
          </div>
        ))}
        {busy && <div style={{ alignSelf: "flex-start", fontSize: 13, color: "#a39a8d", display: "flex", alignItems: "center", gap: 6 }}><Loader2 size={13} className="spin" /> Working on it…</div>}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="Describe the change you want…"
          style={{ flex: 1, padding: "10px 12px", border: "1px solid #ddd5cb", borderRadius: 8, fontSize: 14 }}
        />
        <button onClick={send} disabled={busy} style={{ display: "flex", alignItems: "center", gap: 6, background: navy[700], color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 500, opacity: busy ? 0.6 : 1 }}>
          <Send size={15} /> Send
        </button>
      </div>
      <div style={{ fontSize: 11, color: "#a39a8d", marginTop: 8 }}>Preview-only feature — this needs a real backend to run on the live site.</div>
    </div>
  );
}

function CustomerProfile({ customer, brands, onBack }) {
  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: navy[700], marginBottom: 16, background: "none" }}>
        <ChevronLeft size={15} /> All customers
      </button>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 12, color: navy[700], fontWeight: 600, letterSpacing: 0.5, marginBottom: 4 }}>{customer.customerNumber}</div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: navy[900], margin: 0 }}>{customer.company}</h2>
          <div style={{ fontSize: 13, color: "#8a8074", marginTop: 4 }}>{customer.mainContact} · {customer.mainEmail}</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#6b6155" }}>Brand access & progress</div>
        {customer.approvedBrands.map((bid) => {
          const b = brands.find((x) => x.id === bid);
          if (!b) return null;
          const done = (customer.progress[bid] || []).length;
          const pct = b.modules.length ? Math.round((done / b.modules.length) * 100) : 0;
          return (
            <div key={bid} style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontWeight: 500, color: navy[900], fontSize: 14 }}>{b.name}</div>
                <Badge tone={pct === 100 ? "gold" : "navy"}>{done} / {b.modules.length} complete</Badge>
              </div>
              <div style={{ height: 6, background: "#e4dfd6", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "#4a6b3d" : navy[500] }} />
              </div>
            </div>
          );
        })}
        {customer.approvedBrands.length === 0 && <div style={{ fontSize: 13, color: "#a39a8d" }}>No brand access approved yet.</div>}
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#6b6155", marginBottom: 10 }}>Staff on this account</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: navy[50], border: "1px solid #e4dfd6", borderRadius: 10, padding: "12px 14px" }}>
            <Users size={16} color={navy[700]} />
            <div style={{ flex: 1, fontWeight: 500, fontSize: 14, color: navy[900] }}>{customer.mainContact} <span style={{ fontWeight: 400, color: "#8a8074" }}>(main account holder)</span></div>
          </div>
          {customer.staff.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 14, color: navy[900] }}>{s.name}</div>
                <div style={{ fontSize: 12, color: "#8a8074" }}>{s.email}</div>
              </div>
            </div>
          ))}
          {customer.staff.length === 0 && <div style={{ fontSize: 13, color: "#a39a8d" }}>No additional staff added yet.</div>}
        </div>
      </div>
    </div>
  );
}

function AdminCustomers({ customers, brands }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);

  const active = customers.find((c) => c.id === openId);
  if (active) return <CustomerProfile customer={active} brands={brands} onBack={() => setOpenId(null)} />;

  const filtered = customers
    .filter((c) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return c.company.toLowerCase().includes(q) || c.customerNumber.toLowerCase().includes(q);
    })
    .sort((a, b) => a.company.localeCompare(b.company));

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: navy[900], margin: "0 0 4px" }}>Customers</h2>
      <p style={{ color: "#8a8074", fontSize: 14, margin: "0 0 16px" }}>Every approved account, organised by salon name and customer number.</p>

      <div style={{ position: "relative", marginBottom: 16 }}>
        <Search size={15} color="#a39a8d" style={{ position: "absolute", left: 12, top: 11 }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by salon name or customer number…"
          style={{ width: "100%", padding: "9px 12px 9px 34px", border: "1px solid #ddd5cb", borderRadius: 8, fontSize: 14 }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((c) => (
          <button key={c.id} onClick={() => setOpenId(c.id)} style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: "13px 16px" }}>
            <Building2 size={18} color={navy[500]} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, color: navy[900], fontSize: 14 }}>{c.company}</div>
              <div style={{ fontSize: 12, color: "#8a8074" }}>{c.customerNumber} · {c.approvedBrands.length} brand{c.approvedBrands.length !== 1 ? "s" : ""} · {c.staff.length + 1} user{c.staff.length !== 0 ? "s" : ""}</div>
            </div>
            <ChevronRight size={16} color="#a39a8d" />
          </button>
        ))}
        {filtered.length === 0 && <div style={{ fontSize: 13, color: "#a39a8d" }}>No customers match that search.</div>}
      </div>
    </div>
  );
}

function AdminView({ data, patch }) {
  const [tab, setTab] = useState("dashboard");
  const pendingCount = data.requests.filter((r) => r.status === "pending").length;
  const tabs = [
    { id: "dashboard", label: "Overview", icon: ShieldCheck },
    { id: "customers", label: "Customers", icon: Building2 },
    { id: "assistant", label: "AI assistant", icon: Sparkles },
    { id: "brands", label: "Brands & modules", icon: PlayCircle },
    { id: "approvals", label: "Approvals", icon: Clock, count: pendingCount },
  ];
  return (
    <div style={{ display: "flex", gap: 24 }}>
      <div style={{ width: 190, flexShrink: 0 }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "9px 12px", borderRadius: 8, fontSize: 14, marginBottom: 4, background: tab === t.id ? navy[100] : "transparent", color: tab === t.id ? navy[900] : "#6b6155", fontWeight: tab === t.id ? 500 : 400, border: "none" }}>
            <t.icon size={16} /> {t.label}
            {t.count > 0 && <span style={{ marginLeft: "auto", background: navy[700], color: "#fff", fontSize: 11, borderRadius: 999, padding: "1px 7px" }}>{t.count}</span>}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {tab === "dashboard" && <AdminDashboard brands={data.brands} requests={data.requests} customers={data.customers} />}
        {tab === "customers" && <AdminCustomers customers={data.customers} brands={data.brands} />}
        {tab === "assistant" && <AdminAssistant data={data} patch={patch} />}
        {tab === "brands" && <AdminBrands brands={data.brands} patch={patch} />}
        {tab === "approvals" && <AdminApprovals requests={data.requests} patch={patch} brands={data.brands} />}
      </div>
    </div>
  );
}

export default function AdminMock() {
  const [data, setData] = useState(defaultData);
  function patch(partial) {
    setData((prev) => ({ ...prev, ...partial }));
  }
  return (
    <div>
      <div style={{ background: "#fdf6e3", border: "1px solid #eddfad", color: "#8a6d1f", fontSize: 13, padding: "9px 14px", borderRadius: 8, marginBottom: 18 }}>
        Demo data only for now — brands, modules and approvals reset on reload. Login is real; this screen is wired to the live database in the next build step.
      </div>
      <AdminView data={data} patch={patch} />
    </div>
  );
}
