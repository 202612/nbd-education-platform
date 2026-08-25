import React, { useEffect, useRef, useState } from "react";
import {
  PlayCircle, CheckCircle2, Lock, Award, Users, Trash2, Loader2, ChevronLeft, Clock, Mail, Download,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { supabase } from "../lib/supabaseClient.js";
import { navy, gold, Badge, Logo } from "../lib/ui.jsx";

function formatDate(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" });
}

// ================= QUIZ STEP =================
// Questions are fetched without their correct answers, and grading happens
// server-side via the submit_quiz_answers RPC — the client never sees
// correct_index, so the answer key can't be read out of the network tab.

function QuizStep({ step, onComplete, onBack }) {
  const [questions, setQuestions] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc("get_quiz_questions", { p_step_id: step.id }).then(({ data, error: rpcError }) => {
      if (cancelled) return;
      if (rpcError) { setLoadError(rpcError.message); return; }
      setQuestions(data || []);
    });
    return () => { cancelled = true; };
  }, [step.id]);

  async function submit() {
    const unanswered = questions.some((q) => answers[q.id] === undefined);
    if (unanswered) { setError("Answer every question before submitting"); return; }
    setSubmitting(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("submit_quiz_answers", {
      p_step_id: step.id,
      p_answers: answers,
    });
    setSubmitting(false);
    if (rpcError) { setError(rpcError.message); return; }
    setResult(data.passed ? "pass" : "fail");
    if (data.passed) onComplete();
  }

  if (loadError) return <div style={{ color: "#a3372f", fontSize: 14 }}>{loadError}</div>;
  if (!questions) {
    return <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8a8074", fontSize: 14 }}><Loader2 size={16} className="spin" /> Loading quiz…</div>;
  }

  if (result === "pass") {
    return (
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <CheckCircle2 size={36} color="#4a6b3d" style={{ marginBottom: 10 }} />
        <h3 style={{ fontSize: 18, fontWeight: 600, color: navy[900], margin: "0 0 6px" }}>Quiz passed</h3>
        <p style={{ color: "#8a8074", fontSize: 14, marginBottom: 18 }}>The next step is now unlocked.</p>
        <button onClick={onBack} style={{ background: navy[700], color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 14 }}>Back to sequence</button>
      </div>
    );
  }

  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: navy[700], marginBottom: 14, background: "none" }}>
        <ChevronLeft size={15} /> Back
      </button>
      <h3 style={{ fontSize: 17, fontWeight: 600, color: navy[900], margin: "0 0 14px" }}>Quick check: {step.title}</h3>
      {result === "fail" && <div style={{ background: "#fbeceb", color: "#a3372f", fontSize: 13, padding: "10px 14px", borderRadius: 8, marginBottom: 14 }}>Not quite — review the video and try again.</div>}
      {questions.map((q, qi) => (
        <div key={q.id} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: navy[900], marginBottom: 8 }}>{qi + 1}. {q.text}</div>
          {q.options.map((opt, oi) => (
            <label key={oi} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", fontSize: 14, color: "#3d3830", cursor: "pointer" }}>
              <input type="radio" name={q.id} checked={answers[q.id] === oi} onChange={() => setAnswers({ ...answers, [q.id]: oi })} />
              {opt}
            </label>
          ))}
        </div>
      ))}
      {error && <div style={{ color: "#a3372f", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <button onClick={submit} disabled={submitting} style={{ background: navy[700], color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 14, fontWeight: 500, opacity: submitting ? 0.7 : 1 }}>
        {submitting ? "Checking…" : "Submit answers"}
      </button>
    </div>
  );
}

// ================= VIDEO STEP =================

function VideoStep({ step, onComplete, onBack }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function markWatched() {
    setBusy(true);
    setError("");
    const { error: rpcError } = await supabase.rpc("complete_video_step", { p_step_id: step.id });
    setBusy(false);
    if (rpcError) { setError(rpcError.message); return; }
    onComplete();
  }

  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: navy[700], marginBottom: 14, background: "none" }}>
        <ChevronLeft size={15} /> Back
      </button>
      <h3 style={{ fontSize: 17, fontWeight: 600, color: navy[900], margin: "0 0 14px" }}>{step.title}</h3>
      {step.video_url ? (
        <video
          src={step.video_url}
          controls
          onEnded={markWatched}
          style={{ width: "100%", borderRadius: 10, background: "#000", marginBottom: 16 }}
        />
      ) : (
        <div style={{ background: "#fdf6e3", border: "1px solid #eddfad", color: "#8a6d1f", fontSize: 13, padding: "10px 14px", borderRadius: 8, marginBottom: 16 }}>
          No video uploaded for this step yet.
        </div>
      )}
      {error && <div style={{ color: "#a3372f", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <button onClick={markWatched} disabled={busy} style={{ background: navy[700], color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 14, fontWeight: 500, opacity: busy ? 0.7 : 1 }}>
        {busy ? "Saving…" : "Mark as watched & continue"}
      </button>
    </div>
  );
}

// ================= CERTIFICATE STEP =================

function CertificateStep({ step, brand, participantName, onComplete, onBack }) {
  const [claiming, setClaiming] = useState(true);
  const [issuedAt, setIssuedAt] = useState(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const certRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc("claim_certificate_step", { p_step_id: step.id }).then(({ data, error: rpcError }) => {
      if (cancelled) return;
      setClaiming(false);
      if (rpcError) { setError(rpcError.message); return; }
      setIssuedAt(data.issued_at);
      onComplete();
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  async function downloadPdf() {
    if (!certRef.current) return;
    setDownloading(true);
    const canvas = await html2canvas(certRef.current, { scale: 2, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [canvas.width, canvas.height] });
    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
    pdf.save(`${brand.name.replace(/\s+/g, "-")}-certificate-${participantName.replace(/\s+/g, "-")}.pdf`);
    setDownloading(false);
  }

  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: navy[700], marginBottom: 14, background: "none" }}>
        <ChevronLeft size={15} /> Back
      </button>

      {claiming && <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8a8074", fontSize: 14, marginBottom: 14 }}><Loader2 size={16} className="spin" /> Preparing your certificate…</div>}
      {error && <div style={{ color: "#a3372f", fontSize: 13, marginBottom: 14 }}>{error}</div>}

      {!claiming && !error && (
        <>
          <div
            ref={certRef}
            style={{
              width: 900, maxWidth: "100%", aspectRatio: "1.41 / 1", margin: "0 auto 18px", background: "#fff",
              border: `6px solid ${gold}`, borderRadius: 4, padding: "5% 8%",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center",
              boxSizing: "border-box",
            }}
          >
            {brand.logo_url && <img src={brand.logo_url} alt={brand.name} style={{ maxHeight: 64, maxWidth: 220, objectFit: "contain", marginBottom: 24 }} />}
            <div style={{ fontSize: 13, letterSpacing: 3, color: "#8a8074", textTransform: "uppercase", marginBottom: 18 }}>Certificate of Participation</div>
            <div style={{ fontSize: 14, color: "#6b6155", marginBottom: 8 }}>This certifies that</div>
            <div style={{ fontSize: 32, fontWeight: 600, color: navy[900], marginBottom: 18, fontFamily: "Georgia, 'Times New Roman', serif" }}>{participantName}</div>
            <div style={{ fontSize: 14, color: "#6b6155", marginBottom: 28, maxWidth: 480 }}>
              has successfully completed the <strong>{brand.name}</strong> training programme
            </div>
            <div style={{ fontSize: 13, color: "#a39a8d", marginBottom: 16 }}>{formatDate(issuedAt)}</div>
            <Logo size={28} />
          </div>

          <div style={{ textAlign: "center" }}>
            <button
              onClick={downloadPdf}
              disabled={downloading}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, background: navy[700], color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 500, opacity: downloading ? 0.7 : 1 }}
            >
              <Download size={15} /> {downloading ? "Preparing PDF…" : "Download certificate (PDF)"}
            </button>
          </div>
        </>
      )}
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ================= SEQUENCE =================

const STEP_ICON = { video: PlayCircle, quiz: CheckCircle2, certificate: Award };
const STEP_LABEL = { video: "Video", quiz: "Quiz", certificate: "Certificate" };

function StepRow({ step, done, locked, onOpen }) {
  const Icon = STEP_ICON[step.type];
  return (
    <button
      onClick={() => !locked && onOpen(step.id)}
      disabled={locked}
      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: "13px 16px", opacity: locked ? 0.55 : 1, cursor: locked ? "default" : "pointer" }}
    >
      {locked ? <Lock size={16} color="#a39a8d" /> : done ? <CheckCircle2 size={16} color="#4a6b3d" /> : <Icon size={16} color={navy[500]} />}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, color: navy[900], fontSize: 14 }}>{step.title}</div>
        <div style={{ fontSize: 12, color: "#8a8074" }}>{STEP_LABEL[step.type]}{step.type === "video" && step.duration ? ` · ${step.duration}` : ""}</div>
      </div>
      {done && <Badge tone="gold">Done</Badge>}
    </button>
  );
}

function CustomerBrandDetail({ brand, completedStepIds, onStepCompleted, participantName, onBack }) {
  const [openStepId, setOpenStepId] = useState(null);
  const steps = [...brand.steps].sort((a, b) => a.order_index - b.order_index);
  const active = steps.find((s) => s.id === openStepId);
  const doneCount = steps.filter((s) => completedStepIds.has(s.id)).length;

  if (active) {
    const onBackToList = () => setOpenStepId(null);
    // Quiz/certificate stay on screen to show their result — only video
    // auto-returns to the list, since there's nothing else to show there.
    const refreshOnly = () => onStepCompleted(active.id);
    const refreshAndReturn = () => { onStepCompleted(active.id); setOpenStepId(null); };
    if (active.type === "quiz") return <QuizStep step={active} onComplete={refreshOnly} onBack={onBackToList} />;
    if (active.type === "video") return <VideoStep step={active} onComplete={refreshAndReturn} onBack={onBackToList} />;
    return <CertificateStep step={active} brand={brand} participantName={participantName} onComplete={refreshOnly} onBack={onBackToList} />;
  }

  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: navy[700], marginBottom: 14, background: "none" }}>
        <ChevronLeft size={15} /> All brands
      </button>
      <h3 style={{ fontSize: 18, fontWeight: 600, color: navy[900], margin: "0 0 4px" }}>{brand.name}</h3>
      <p style={{ color: "#8a8074", fontSize: 14, margin: "0 0 18px" }}>{doneCount} of {steps.length} steps complete</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.map((s, i) => {
          const done = completedStepIds.has(s.id);
          const locked = i > 0 && !completedStepIds.has(steps[i - 1].id);
          return <StepRow key={s.id} step={s} done={done} locked={locked} onOpen={setOpenStepId} />;
        })}
        {steps.length === 0 && <div style={{ color: "#8a8074", fontSize: 14 }}>No steps added to this brand yet — check back soon.</div>}
      </div>
    </div>
  );
}

// ================= DASHBOARD =================

function CustomerDashboard({ brands, completedStepIds, onStepCompleted, participantName }) {
  const [openBrandId, setOpenBrandId] = useState(null);
  const brand = brands.find((b) => b.id === openBrandId);
  if (brand) return <CustomerBrandDetail brand={brand} completedStepIds={completedStepIds} onStepCompleted={onStepCompleted} participantName={participantName} onBack={() => setOpenBrandId(null)} />;
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: navy[900], margin: "0 0 4px" }}>Your training</h2>
      <p style={{ color: "#8a8074", fontSize: 14, margin: "0 0 20px" }}>Only the brands you stock are shown here.</p>
      {brands.length === 0 && <div style={{ color: "#8a8074", fontSize: 14 }}>No brands approved on this account yet.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {brands.map((b) => {
          const done = b.steps.filter((s) => completedStepIds.has(s.id)).length;
          const pct = b.steps.length ? Math.round((done / b.steps.length) * 100) : 0;
          return (
            <button key={b.id} onClick={() => setOpenBrandId(b.id)} style={{ textAlign: "left", background: "#fff", border: "1px solid #e4dfd6", borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 600, color: navy[900], marginBottom: 4 }}>{b.name}</div>
              <div style={{ fontSize: 13, color: "#8a8074", marginBottom: 10 }}>{done} of {b.steps.length} steps complete</div>
              <div style={{ height: 6, background: "#e4dfd6", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "#4a6b3d" : navy[500] }} />
              </div>
              {pct === 100 && b.steps.length > 0 && <div style={{ marginTop: 10 }}><Badge tone="gold">Certified</Badge></div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ================= TEAM =================

function CustomerTeam({ team, currentUserId, onAdd, onRemove }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim() || !email.trim()) { setError("Enter a name and email first"); return; }
    setBusy(true);
    setError("");
    const err = await onAdd({ name: name.trim(), email: email.trim() });
    setBusy(false);
    if (err) { setError(err); return; }
    setName(""); setEmail("");
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: navy[900], margin: "0 0 4px" }}>Team</h2>
      <p style={{ color: "#8a8074", fontSize: 14, margin: "0 0 20px" }}>Add staff to your account. They sign in with the exact email you enter here, choosing their own password the first time.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Staff name" style={{ flex: 1, minWidth: 140, padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, fontSize: 14 }} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={{ flex: 1, minWidth: 140, padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, fontSize: 14 }} />
        <button onClick={add} disabled={busy} style={{ background: navy[700], color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, opacity: busy ? 0.7 : 1 }}>Add</button>
      </div>
      {error && <div style={{ color: "#a3372f", fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {team.map((u) => (
          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, background: u.role === "holder" ? navy[50] : "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: "12px 14px" }}>
            <Users size={16} color={navy[700]} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 14, color: navy[900] }}>
                {u.name}{u.id === currentUserId ? " (you)" : ""}{u.role === "holder" ? " · main account holder" : ""}
              </div>
              <div style={{ fontSize: 12, color: "#8a8074" }}>{u.email}</div>
            </div>
            {u.role === "staff" && (
              <button onClick={() => onRemove(u.id)} style={{ background: "none" }}>
                <Trash2 size={15} color="#a39a8d" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ================= ACCOUNT STATUS (pending / declined) =================

function AccountStatusScreen({ account }) {
  const declined = account.status === "declined";
  return (
    <div style={{ maxWidth: 420, margin: "60px auto", textAlign: "center" }}>
      <Clock size={32} color={navy[500]} style={{ marginBottom: 12 }} />
      <h2 style={{ fontSize: 20, fontWeight: 600, color: navy[900], margin: "0 0 8px" }}>
        {declined ? "Access not approved" : "Access pending approval"}
      </h2>
      <p style={{ color: "#8a8074", fontSize: 14, lineHeight: 1.6 }}>
        {declined
          ? `Training access for ${account.company_name} wasn't approved. Contact your NBD rep if you think this is a mistake.`
          : `${account.company_name} is still waiting on admin approval. You'll get access as soon as it's approved.`}
      </p>
    </div>
  );
}

// ================= ROOT =================

export default function CustomerApp({ user, account }) {
  const [tab, setTab] = useState("training");
  const [brands, setBrands] = useState(null);
  const [completedStepIds, setCompletedStepIds] = useState(new Set());
  const [team, setTeam] = useState([]);
  const [loadError, setLoadError] = useState("");

  async function loadProgress() {
    const { data } = await supabase.from("step_progress").select("step_id").eq("user_id", user.id);
    setCompletedStepIds(new Set((data || []).map((row) => row.step_id)));
  }

  async function loadTeam() {
    const { data } = await supabase.from("app_users").select("id,name,email,role").eq("account_id", account.id).order("role", { ascending: false });
    setTeam(data || []);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (account.status !== "approved") return;
      const { data, error } = await supabase
        .from("brands")
        .select("id,name,tagline,logo_url,steps:brand_steps(id,type,title,video_url,duration,order_index)");
      if (cancelled) return;
      if (error) { setLoadError(error.message); return; }
      setBrands(data || []);
      await loadProgress();
      await loadTeam();
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id]);

  if (account.status !== "approved") {
    return <AccountStatusScreen account={account} />;
  }

  if (loadError) return <div style={{ color: "#a3372f", fontSize: 14 }}>{loadError}</div>;
  if (!brands) {
    return <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8a8074", fontSize: 14 }}><Loader2 size={16} className="spin" /> Loading your training…</div>;
  }

  async function handleStepCompleted() {
    await loadProgress();
  }

  async function handleAddStaff({ name, email }) {
    const { error } = await supabase.from("app_users").insert({ account_id: account.id, name, email, role: "staff" });
    if (error) return error.message.includes("duplicate") ? "That email is already on the team." : error.message;
    await loadTeam();
    return null;
  }

  async function handleRemoveStaff(id) {
    await supabase.from("app_users").delete().eq("id", id);
    await loadTeam();
  }

  return (
    <div style={{ display: "flex", gap: 24 }}>
      <div style={{ width: 170, flexShrink: 0 }}>
        {[
          { id: "training", label: "Training", icon: PlayCircle },
          { id: "team", label: "Team", icon: Users },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "9px 12px", borderRadius: 8, fontSize: 14, marginBottom: 4, background: tab === t.id ? navy[100] : "transparent", color: tab === t.id ? navy[900] : "#6b6155", fontWeight: tab === t.id ? 500 : 400, border: "none" }}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "9px 12px", borderRadius: 8, fontSize: 13, color: "#a39a8d", marginTop: 12 }}>
          <Mail size={14} /> Contact NBD to request another brand
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {tab === "training" && <CustomerDashboard brands={brands} completedStepIds={completedStepIds} onStepCompleted={handleStepCompleted} participantName={user.name} />}
        {tab === "team" && <CustomerTeam team={team} currentUserId={user.id} onAdd={handleAddStaff} onRemove={handleRemoveStaff} />}
      </div>
    </div>
  );
}
