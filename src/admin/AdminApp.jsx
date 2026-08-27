import React, { useEffect, useState } from "react";
import {
  ShieldCheck, Building2, Clock, PlayCircle, CheckCircle2, Award, Plus, Trash2, Check, X,
  ChevronRight, ChevronLeft, ArrowUp, ArrowDown, Search, Loader2, Sparkles, Users, Image as ImageIcon, Pencil, Palette,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { navy, Badge, StatCard } from "../lib/ui.jsx";
import { AdminAssistant } from "./AdminMock.jsx";
import DesignTab from "./DesignTab.jsx";

// ================= BRANDS & STEPS =================

const STEP_TYPES = [
  { type: "video", label: "Video", icon: PlayCircle },
  { type: "quiz", label: "Quiz", icon: CheckCircle2 },
  { type: "certificate", label: "Certificate", icon: Award },
];

// Shared button styling for every admin screen. Injected once at the AdminApp
// root. :hover / :active need real CSS, hence classes rather than inline styles.
const ADMIN_BTN_CSS = `
.nbd-btn {
  display: inline-flex; align-items: center; gap: 6px;
  font: inherit; font-size: 14px; font-weight: 600; line-height: 1;
  border-radius: 8px; padding: 8px 14px; cursor: pointer;
  border: 1px solid transparent; background: none;
  transition: background .12s ease, border-color .12s ease, color .12s ease, box-shadow .12s ease;
}
.nbd-btn:disabled { opacity: .4; cursor: default; }
.nbd-btn--ghost { color: #5e8f1e; padding: 6px 10px; margin-left: -10px; }
.nbd-btn--ghost:hover:not(:disabled) { background: #f2f7e9; }
.nbd-btn--outline { color: #333333; border-color: #ddd5cb; background: #fff; }
.nbd-btn--outline:hover:not(:disabled) { border-color: #a8cb63; background: #f2f7e9; color: #5e8f1e; }
.nbd-btn--primary { color: #fff; background: #5e8f1e; }
.nbd-btn--primary:hover:not(:disabled) { background: #517d1a; box-shadow: 0 1px 4px rgba(94,143,30,.35); }
.nbd-btn--danger { color: #a3372f; border-color: #f0c9c2; background: #fff; }
.nbd-btn--danger:hover:not(:disabled) { background: #fdecea; border-color: #e0a89f; }
.nbd-btn--danger-solid { color: #fff; background: #a3372f; }
.nbd-btn--danger-solid:hover:not(:disabled) { background: #8a2f28; }
.nbd-btn--danger-solid:disabled { opacity: .5; }
.nbd-btn--sm { font-size: 13px; padding: 5px 10px; }

.nbd-linkbtn { background: none; border: none; padding: 0; font: inherit; font-size: 14px; font-weight: 600; color: #5e8f1e; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }
.nbd-linkbtn:hover { color: #517d1a; text-decoration: underline; }

.nbd-iconbtn { background: none; border: none; cursor: pointer; color: #a39a8d; display: inline-flex; padding: 4px; border-radius: 6px; transition: background .12s ease, color .12s ease; }
.nbd-iconbtn:hover { background: #fdecea; color: #c0392b; }

.nbd-rowcard { display: flex; align-items: center; gap: 12px; text-align: left; width: 100%; background: #fff; border: 1px solid #e4dfd6; border-radius: 10px; padding: 13px 16px; cursor: pointer; transition: border-color .12s ease, box-shadow .12s ease, background .12s ease; }
.nbd-rowcard:hover { border-color: #a8cb63; background: #f7faf0; box-shadow: 0 1px 4px rgba(94,143,30,.12); }

.nbd-actions { display: inline-flex; align-items: center; border: 1px solid #e4dfd6; border-radius: 8px; overflow: hidden; background: #fff; }
.nbd-actions button {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 32px; background: none; border: none;
  border-left: 1px solid #efe8dc; color: #6b6155; cursor: pointer;
  transition: background .12s ease, color .12s ease;
}
.nbd-actions button:first-child { border-left: none; }
.nbd-actions button:hover:not(:disabled) { background: #f2f7e9; color: #5e8f1e; }
.nbd-actions button:disabled { opacity: .3; cursor: default; }
.nbd-actions button.nbd-danger:hover:not(:disabled) { background: #fdecea; color: #c0392b; }
`;

function AddQuizForm({ initial, submitLabel, onCancel, onSave }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [questions, setQuestions] = useState(initial?.questions || [{ text: "", options: ["", "", ""], correct: 0 }]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function updateQuestion(qi, patch) {
    setQuestions(questions.map((q, i) => (i === qi ? { ...q, ...patch } : q)));
  }
  function updateOption(qi, oi, value) {
    updateQuestion(qi, { options: questions[qi].options.map((o, i) => (i === oi ? value : o)) });
  }
  function addOption(qi) {
    updateQuestion(qi, { options: [...questions[qi].options, ""] });
  }
  function removeOption(qi, oi) {
    if (questions[qi].options.length <= 2) return;
    const options = questions[qi].options.filter((_, i) => i !== oi);
    const correct = questions[qi].correct >= options.length ? 0 : questions[qi].correct;
    updateQuestion(qi, { options, correct });
  }
  function addQuestion() {
    setQuestions([...questions, { text: "", options: ["", "", ""], correct: 0 }]);
  }
  function removeQuestion(qi) {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== qi));
  }

  async function save() {
    if (!title.trim()) { setError("Give the quiz a title"); return; }
    for (const q of questions) {
      if (!q.text.trim() || q.options.some((o) => !o.trim())) {
        setError("Fill in every question and answer option first");
        return;
      }
    }
    setSaving(true);
    setError("");
    const err = await onSave({ title: title.trim(), questions });
    setSaving(false);
    if (err) setError(err);
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <label style={{ fontSize: 15, color: "#6b6155", display: "block", marginBottom: 4 }}>Quiz title</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Quick check: Foundations" style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 14, fontSize: 16, boxSizing: "border-box" }} />
      {questions.map((q, qi) => (
        <div key={qi} style={{ border: "1px solid #e4dfd6", borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <input value={q.text} onChange={(e) => updateQuestion(qi, { text: e.target.value })} placeholder={`Question ${qi + 1}`} style={{ flex: 1, padding: "7px 9px", border: "1px solid #ddd5cb", borderRadius: 6, fontSize: 15 }} />
            <button className="nbd-iconbtn" onClick={() => removeQuestion(qi)} title="Remove question"><Trash2 size={14} /></button>
          </div>
          {q.options.map((opt, oi) => (
            <div key={oi} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <input type="radio" name={`correct-${qi}`} checked={q.correct === oi} onChange={() => updateQuestion(qi, { correct: oi })} title="Correct answer" />
              <input value={opt} onChange={(e) => updateOption(qi, oi, e.target.value)} placeholder={`Option ${oi + 1}`} style={{ flex: 1, padding: "6px 9px", border: "1px solid #ddd5cb", borderRadius: 6, fontSize: 15 }} />
              {q.options.length > 2 && <button className="nbd-iconbtn" onClick={() => removeOption(qi, oi)} title="Remove option"><X size={13} /></button>}
            </div>
          ))}
          <button className="nbd-linkbtn" onClick={() => addOption(qi)}>+ Add option</button>
        </div>
      ))}
      <button className="nbd-linkbtn" onClick={addQuestion} style={{ marginBottom: 14 }}>+ Add question</button>
      {error && <div style={{ color: "#a3372f", fontSize: 15, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="nbd-btn nbd-btn--primary" onClick={save} disabled={saving}>{saving ? "Saving…" : (submitLabel || "Save quiz step")}</button>
        <button className="nbd-btn nbd-btn--outline" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function AddVideoForm({ brandId, initial, submitLabel, onCancel, onSave }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [duration, setDuration] = useState(initial?.duration || "");
  const [videoUrl, setVideoUrl] = useState(initial?.video_url || "");
  const [storagePath, setStoragePath] = useState(initial?.video_storage_path || null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    const path = `${brandId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("training-videos").upload(path, file);
    setUploading(false);
    if (uploadError) { setError(uploadError.message); return; }
    setStoragePath(path);
    setVideoUrl("");
    setFileName(file.name);
  }

  async function save() {
    if (!title.trim()) { setError("Give the video a title"); return; }
    setSaving(true);
    setError("");
    const err = await onSave({
      title: title.trim(),
      duration: duration.trim(),
      video_url: storagePath ? null : (videoUrl.trim() || null),
      video_storage_path: storagePath,
    });
    setSaving(false);
    if (err) setError(err);
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <label style={{ fontSize: 15, color: "#6b6155", display: "block", marginBottom: 4 }}>Video title</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Foundations of Colour Theory" style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 12, fontSize: 16, boxSizing: "border-box" }} />
      <label style={{ fontSize: 15, color: "#6b6155", display: "block", marginBottom: 4 }}>Duration (optional)</label>
      <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 6 min" style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 12, fontSize: 16, boxSizing: "border-box" }} />
      <label style={{ fontSize: 15, color: "#6b6155", display: "block", marginBottom: 4 }}>Video file (MP4) — private, only approved customers can view it</label>
      <input type="file" accept="video/mp4,video/*" onChange={handleFile} style={{ marginBottom: 8, fontSize: 15 }} />
      {uploading && <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#8a8074", fontSize: 15, marginBottom: 8 }}><Loader2 size={14} className="spin" /> Uploading…</div>}
      {fileName && !uploading && <div style={{ color: "#4d6b2c", fontSize: 15, marginBottom: 8 }}>Uploaded: {fileName}</div>}
      {storagePath && !fileName && <div style={{ color: "#4d6b2c", fontSize: 15, marginBottom: 8 }}>Using previously uploaded file</div>}
      <div style={{ fontSize: 14, color: "#a39a8d", margin: "4px 0 8px" }}>— or paste an external video URL instead (e.g. YouTube) —</div>
      <input
        value={videoUrl}
        onChange={(e) => { setVideoUrl(e.target.value); setStoragePath(null); setFileName(""); }}
        placeholder="https://…"
        style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 14, fontSize: 16, boxSizing: "border-box" }}
      />
      {error && <div style={{ color: "#a3372f", fontSize: 15, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="nbd-btn nbd-btn--primary" onClick={save} disabled={saving || uploading}>{saving ? "Saving…" : (submitLabel || "Save video step")}</button>
        <button className="nbd-btn nbd-btn--outline" onClick={onCancel}>Cancel</button>
      </div>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function AddCertificateForm({ initial, submitLabel, onCancel, onSave }) {
  const [title, setTitle] = useState(initial?.title || "Certificate of Participation");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) { setError("Give the certificate a title"); return; }
    setSaving(true);
    setError("");
    const err = await onSave({ title: title.trim() });
    setSaving(false);
    if (err) setError(err);
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <label style={{ fontSize: 15, color: "#6b6155", display: "block", marginBottom: 4 }}>Certificate title</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 14, fontSize: 16, boxSizing: "border-box" }} />
      <p style={{ fontSize: 14, color: "#a39a8d", margin: "0 0 14px" }}>
        Awarded automatically once every earlier step in this brand is complete. The certificate is generated for
        each learner with their name and the date filled in — set the brand's logo above so it appears on it.
      </p>
      {error && <div style={{ color: "#a3372f", fontSize: 15, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="nbd-btn nbd-btn--primary" onClick={save} disabled={saving}>{saving ? "Saving…" : (submitLabel || "Save certificate step")}</button>
        <button className="nbd-btn nbd-btn--outline" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function StepCard({ step, index, count, onMove, onDelete, onEdit }) {
  const meta = STEP_TYPES.find((t) => t.type === step.type);
  const Icon = meta.icon;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: "12px 14px", flexWrap: "wrap" }}>
      <Icon size={16} color={navy[500]} />
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ fontWeight: 500, color: navy[900], fontSize: 16 }}>{step.title}</div>
        <div style={{ fontSize: 14, color: "#8a8074" }}>
          {meta.label}
          {step.type === "video" && step.duration ? ` · ${step.duration}` : ""}
          {step.type === "video" && !step.video_url && !step.video_storage_path ? " · no file yet" : ""}
          {step.type === "quiz" ? ` · ${step.quiz_questions?.length || 0} question${step.quiz_questions?.length === 1 ? "" : "s"}` : ""}
        </div>
      </div>
      <div className="nbd-actions">
        <button onClick={() => onEdit(step)} title="Edit step"><Pencil size={15} /></button>
        <button onClick={() => onMove(index, -1)} disabled={index === 0} title="Move up"><ArrowUp size={15} /></button>
        <button onClick={() => onMove(index, 1)} disabled={index === count - 1} title="Move down"><ArrowDown size={15} /></button>
        <button onClick={() => onDelete(step.id)} className="nbd-danger" title="Delete step"><Trash2 size={15} /></button>
      </div>
    </div>
  );
}

function BrandLogoUpload({ brand, onChanged }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    const path = `${brand.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("brand-logos").upload(path, file);
    if (uploadError) { setUploading(false); setError(uploadError.message); return; }
    const { data } = supabase.storage.from("brand-logos").getPublicUrl(path);
    await supabase.from("brands").update({ logo_url: data.publicUrl }).eq("id", brand.id);
    setUploading(false);
    onChanged();
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
      {brand.logo_url ? (
        <img src={brand.logo_url} alt={`${brand.name} logo`} style={{ height: 40, width: 40, objectFit: "contain", borderRadius: 6, border: "1px solid #e4dfd6", background: "#fff" }} />
      ) : (
        <div style={{ height: 40, width: 40, borderRadius: 6, border: "1px dashed #ddd5cb", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ImageIcon size={16} color="#a39a8d" />
        </div>
      )}
      <div>
        <label className="nbd-btn nbd-btn--outline nbd-btn--sm">
          {uploading ? "Uploading…" : brand.logo_url ? "Replace logo" : "Upload logo"}
          <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} style={{ display: "none" }} />
        </label>
        {error && <div style={{ color: "#a3372f", fontSize: 14, marginTop: 4 }}>{error}</div>}
        <div style={{ fontSize: 13, color: "#a39a8d", marginTop: 4 }}>Appears on this brand's generated certificate.</div>
      </div>
    </div>
  );
}

function EditBrandDetails({ brand, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(brand.name);
  const [tagline, setTagline] = useState(brand.tagline || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!name.trim()) { setError("Brand name can't be empty"); return; }
    setSaving(true);
    setError("");
    const { error: err } = await supabase.from("brands").update({ name: name.trim(), tagline: tagline.trim() || null }).eq("id", brand.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setEditing(false);
    onChanged();
  }

  if (!editing) {
    return (
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: navy[900], margin: 0 }}>{brand.name}</h2>
        <button className="nbd-btn nbd-btn--outline nbd-btn--sm" onClick={() => { setName(brand.name); setTagline(brand.tagline || ""); setEditing(true); }}>
          <Pencil size={13} /> Edit
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: 14, marginBottom: 12 }}>
      <label style={{ fontSize: 15, color: "#6b6155", display: "block", marginBottom: 4 }}>Brand name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 10, fontSize: 16, boxSizing: "border-box" }} />
      <label style={{ fontSize: 15, color: "#6b6155", display: "block", marginBottom: 4 }}>Tagline</label>
      <input value={tagline} onChange={(e) => setTagline(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 12, fontSize: 16, boxSizing: "border-box" }} />
      {error && <div style={{ color: "#a3372f", fontSize: 15, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="nbd-btn nbd-btn--primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        <button className="nbd-btn nbd-btn--outline" onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </div>
  );
}

function BrandStepsEditor({ brandId, onBack }) {
  const [brand, setBrand] = useState(null);
  const [steps, setSteps] = useState(null);
  const [addingType, setAddingType] = useState(null);
  const [editingStep, setEditingStep] = useState(null);
  const [editingQuizData, setEditingQuizData] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    const { data: b } = await supabase.from("brands").select("id,name,tagline,logo_url").eq("id", brandId).single();
    setBrand(b);
    const { data: s } = await supabase
      .from("brand_steps")
      .select("id,type,title,video_url,video_storage_path,duration,order_index,quiz_questions(id)")
      .eq("brand_id", brandId)
      .order("order_index");
    setSteps(s || []);
  }
  useEffect(() => { load(); }, [brandId]);

  async function nextOrderIndex() {
    return steps.length ? Math.max(...steps.map((s) => s.order_index)) + 1 : 0;
  }

  async function saveVideo({ title, duration, video_url, video_storage_path }) {
    const order_index = await nextOrderIndex();
    const { error: err } = await supabase.from("brand_steps").insert({ brand_id: brandId, type: "video", title, duration, video_url, video_storage_path, order_index });
    if (err) return err.message;
    setAddingType(null);
    await load();
    return null;
  }

  async function saveQuiz({ title, questions }) {
    const order_index = await nextOrderIndex();
    const { data: step, error: stepErr } = await supabase.from("brand_steps").insert({ brand_id: brandId, type: "quiz", title, order_index }).select().single();
    if (stepErr) return stepErr.message;
    const rows = questions.map((q, i) => ({ step_id: step.id, text: q.text, options: q.options, correct_index: q.correct, order_index: i }));
    const { error: qErr } = await supabase.from("quiz_questions").insert(rows);
    if (qErr) return qErr.message;
    setAddingType(null);
    await load();
    return null;
  }

  async function saveCertificate({ title }) {
    const order_index = await nextOrderIndex();
    const { error: err } = await supabase.from("brand_steps").insert({ brand_id: brandId, type: "certificate", title, order_index });
    if (err) return err.message;
    setAddingType(null);
    await load();
    return null;
  }

  async function startEdit(step) {
    setAddingType(null);
    if (step.type === "quiz") {
      const { data: qs } = await supabase
        .from("quiz_questions")
        .select("text,options,correct_index,order_index")
        .eq("step_id", step.id)
        .order("order_index");
      setEditingQuizData({
        title: step.title,
        questions: (qs || []).map((q) => ({ text: q.text, options: q.options, correct: q.correct_index })),
      });
    }
    setEditingStep(step);
  }

  function cancelEdit() {
    setEditingStep(null);
    setEditingQuizData(null);
  }

  async function updateVideo({ title, duration, video_url, video_storage_path }) {
    const { error: err } = await supabase.from("brand_steps").update({ title, duration, video_url, video_storage_path }).eq("id", editingStep.id);
    if (err) return err.message;
    cancelEdit();
    await load();
    return null;
  }

  async function updateQuiz({ title, questions }) {
    const { error: titleErr } = await supabase.from("brand_steps").update({ title }).eq("id", editingStep.id);
    if (titleErr) return titleErr.message;
    const { error: delErr } = await supabase.from("quiz_questions").delete().eq("step_id", editingStep.id);
    if (delErr) return delErr.message;
    const rows = questions.map((q, i) => ({ step_id: editingStep.id, text: q.text, options: q.options, correct_index: q.correct, order_index: i }));
    const { error: insErr } = await supabase.from("quiz_questions").insert(rows);
    if (insErr) return insErr.message;
    cancelEdit();
    await load();
    return null;
  }

  async function updateCertificate({ title }) {
    const { error: err } = await supabase.from("brand_steps").update({ title }).eq("id", editingStep.id);
    if (err) return err.message;
    cancelEdit();
    await load();
    return null;
  }

  async function moveStep(index, direction) {
    const other = index + direction;
    if (other < 0 || other >= steps.length) return;
    const a = steps[index];
    const b = steps[other];
    await supabase.from("brand_steps").update({ order_index: b.order_index }).eq("id", a.id);
    await supabase.from("brand_steps").update({ order_index: a.order_index }).eq("id", b.id);
    await load();
  }

  async function deleteStep(id) {
    await supabase.from("brand_steps").delete().eq("id", id);
    await load();
  }

  if (!brand || !steps) {
    return <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8a8074", fontSize: 16 }}><Loader2 size={16} /> Loading…</div>;
  }

  return (
    <div>
      <button className="nbd-btn nbd-btn--ghost" onClick={onBack} style={{ marginBottom: 14 }}>
        <ChevronLeft size={15} /> All brands
      </button>
      <EditBrandDetails brand={brand} onChanged={load} />
      <p style={{ color: "#8a8074", fontSize: 16, margin: "0 0 18px" }}>Build the sequence customers work through, in order — video, quiz, or certificate steps.</p>

      <BrandLogoUpload brand={brand} onChanged={load} />

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
        {steps.map((s, i) => (
          <StepCard key={s.id} step={s} index={i} count={steps.length} onMove={moveStep} onDelete={deleteStep} onEdit={startEdit} />
        ))}
        {steps.length === 0 && <div style={{ fontSize: 15, color: "#a39a8d" }}>No steps yet — add the first one below.</div>}
      </div>

      {editingStep && editingStep.type === "video" && (
        <AddVideoForm brandId={brandId} initial={editingStep} submitLabel="Save changes" onCancel={cancelEdit} onSave={updateVideo} />
      )}
      {editingStep && editingStep.type === "quiz" && editingQuizData && (
        <AddQuizForm initial={editingQuizData} submitLabel="Save changes" onCancel={cancelEdit} onSave={updateQuiz} />
      )}
      {editingStep && editingStep.type === "certificate" && (
        <AddCertificateForm initial={editingStep} submitLabel="Save changes" onCancel={cancelEdit} onSave={updateCertificate} />
      )}

      {!editingStep && addingType === "video" && <AddVideoForm brandId={brandId} onCancel={() => setAddingType(null)} onSave={saveVideo} />}
      {!editingStep && addingType === "quiz" && <AddQuizForm onCancel={() => setAddingType(null)} onSave={saveQuiz} />}
      {!editingStep && addingType === "certificate" && <AddCertificateForm onCancel={() => setAddingType(null)} onSave={saveCertificate} />}

      {!editingStep && !addingType && (
        <div style={{ display: "flex", gap: 8 }}>
          {STEP_TYPES.map((t) => (
            <button key={t.type} className="nbd-btn nbd-btn--outline" onClick={() => setAddingType(t.type)}>
              <Plus size={14} /> <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>
      )}
      {error && <div style={{ color: "#a3372f", fontSize: 15, marginTop: 10 }}>{error}</div>}
    </div>
  );
}

function AdminBrandsLive() {
  const [brands, setBrands] = useState(null);
  const [activeBrandId, setActiveBrandId] = useState(null);
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandTagline, setNewBrandTagline] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const { data } = await supabase.from("brands").select("id,name,tagline,logo_url,brand_steps(id)").order("name");
    setBrands(data || []);
  }
  useEffect(() => { load(); }, []);

  async function addBrand() {
    if (!newBrandName.trim()) { setError("Enter a brand name first"); return; }
    const { error: err } = await supabase.from("brands").insert({ name: newBrandName.trim(), tagline: newBrandTagline.trim() || null });
    if (err) { setError(err.message); return; }
    setNewBrandName(""); setNewBrandTagline(""); setShowAdd(false); setError("");
    load();
  }

  if (activeBrandId) return <BrandStepsEditor brandId={activeBrandId} onBack={() => { setActiveBrandId(null); load(); }} />;

  if (!brands) return <div style={{ color: "#8a8074", fontSize: 16 }}>Loading brands…</div>;

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 600, color: navy[900], margin: "0 0 4px" }}>Brands & modules</h2>
      <p style={{ color: "#8a8074", fontSize: 16, margin: "0 0 18px" }}>Each brand is a sequence of steps customers work through in order.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {brands.map((b) => (
          <button key={b.id} className="nbd-rowcard" onClick={() => setActiveBrandId(b.id)}>
            {b.logo_url ? (
              <img src={b.logo_url} alt={b.name} style={{ height: 32, width: 32, objectFit: "contain", borderRadius: 6, flexShrink: 0 }} />
            ) : (
              <div style={{ height: 32, width: 32, borderRadius: 6, background: navy[50], flexShrink: 0 }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, color: navy[900], fontSize: 16 }}>{b.name}</div>
              <div style={{ fontSize: 14, color: "#8a8074" }}>{b.tagline} · {b.brand_steps.length} step{b.brand_steps.length === 1 ? "" : "s"}</div>
            </div>
            <ChevronRight size={16} color="#a39a8d" />
          </button>
        ))}
      </div>
      {showAdd ? (
        <div style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: 16 }}>
          <input value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)} placeholder="Brand name" style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 10, fontSize: 16, boxSizing: "border-box" }} />
          <input value={newBrandTagline} onChange={(e) => setNewBrandTagline(e.target.value)} placeholder="Tagline (optional)" style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 12, fontSize: 16, boxSizing: "border-box" }} />
          {error && <div style={{ color: "#a3372f", fontSize: 15, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="nbd-btn nbd-btn--primary" onClick={addBrand}>Add brand</button>
            <button className="nbd-btn nbd-btn--outline" onClick={() => { setShowAdd(false); setError(""); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="nbd-btn nbd-btn--outline" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Add brand
        </button>
      )}
    </div>
  );
}

// ================= APPROVALS =================

function AdminApprovalsLive() {
  const [brands, setBrands] = useState([]);
  const [pending, setPending] = useState(null);
  const [selected, setSelected] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState("");

  async function load() {
    const [{ data: b }, { data: p }] = await Promise.all([
      supabase.from("brands").select("id,name").order("name"),
      supabase.from("accounts").select("*").eq("status", "pending").order("created_at"),
    ]);
    setBrands(b || []);
    setPending(p || []);
  }
  useEffect(() => { load(); }, []);

  function toggleBrand(accountId, brandId) {
    setSelected((prev) => {
      const set = new Set(prev[accountId] || []);
      set.has(brandId) ? set.delete(brandId) : set.add(brandId);
      return { ...prev, [accountId]: set };
    });
  }

  async function approve(account) {
    const chosen = Array.from(selected[account.id] || []);
    setBusyId(account.id);
    await supabase.from("accounts").update({ status: "approved", approved_brand_ids: chosen }).eq("id", account.id);
    setBusyId(null);
    setToast(`${account.company_name} approved for ${chosen.length} brand${chosen.length === 1 ? "" : "s"}`);
    setTimeout(() => setToast(""), 3500);
    load();
  }
  async function decline(account) {
    setBusyId(account.id);
    await supabase.from("accounts").update({ status: "declined" }).eq("id", account.id);
    setBusyId(null);
    setToast(`${account.company_name} declined`);
    setTimeout(() => setToast(""), 3500);
    load();
  }

  if (!pending) return <div style={{ color: "#8a8074", fontSize: 16 }}>Loading…</div>;

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 600, color: navy[900], margin: "0 0 4px" }}>Account approvals</h2>
      <p style={{ color: "#8a8074", fontSize: 16, margin: "0 0 20px" }}>Pick which brands to grant, then approve or decline.</p>
      {toast && <div style={{ background: "#eef5e6", color: "#4d6b2c", fontSize: 15, padding: "8px 14px", borderRadius: 8, marginBottom: 14 }}>{toast}</div>}
      {pending.length === 0 && <div style={{ color: "#8a8074", fontSize: 16 }}>No pending requests.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {pending.map((a) => (
          <div key={a.id} style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: 16 }}>
            <div style={{ fontWeight: 600, color: navy[900] }}>{a.company_name}</div>
            <div style={{ fontSize: 15, color: "#8a8074", marginBottom: 10 }}>{a.main_contact_name} · {a.main_contact_email}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {brands.map((b) => (
                <label key={b.id} style={{ display: "flex", alignItems: "center", gap: 6, background: navy[50], border: "1px solid #e4dfd6", borderRadius: 999, padding: "4px 10px", fontSize: 14, cursor: "pointer" }}>
                  <input type="checkbox" checked={(selected[a.id] || new Set(a.requested_brand_ids)).has(b.id)} onChange={() => toggleBrand(a.id, b.id)} />
                  {b.name}
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="nbd-btn nbd-btn--primary" onClick={() => approve(a)} disabled={busyId === a.id}>
                <Check size={14} /> Approve
              </button>
              <button className="nbd-btn nbd-btn--outline" onClick={() => decline(a)} disabled={busyId === a.id}>
                <X size={14} /> Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ================= CUSTOMERS =================

function EditAccountDetails({ account, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [customerNumber, setCustomerNumber] = useState(account.customer_number || "");
  const [companyName, setCompanyName] = useState(account.company_name);
  const [contactName, setContactName] = useState(account.main_contact_name);
  const [contactEmail, setContactEmail] = useState(account.main_contact_email);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!companyName.trim() || !contactName.trim() || !contactEmail.trim()) {
      setError("Fill in every field first.");
      return;
    }
    setSaving(true);
    setError("");
    const { error: err } = await supabase.from("accounts").update({
      customer_number: customerNumber.trim() || null,
      company_name: companyName.trim(),
      main_contact_name: contactName.trim(),
      main_contact_email: contactEmail.trim(),
    }).eq("id", account.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setEditing(false);
    onSaved();
  }

  if (!editing) {
    return (
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: navy[900], margin: 0 }}>{account.company_name}</h2>
        <button className="nbd-btn nbd-btn--outline nbd-btn--sm" onClick={() => setEditing(true)}>
          <Pencil size={13} /> Edit
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: 16, marginBottom: 12 }}>
      <label style={{ fontSize: 15, color: "#6b6155", display: "block", marginBottom: 4 }}>Customer number</label>
      <input value={customerNumber} onChange={(e) => setCustomerNumber(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 10, fontSize: 16, boxSizing: "border-box" }} />
      <label style={{ fontSize: 15, color: "#6b6155", display: "block", marginBottom: 4 }}>Company name</label>
      <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 10, fontSize: 16, boxSizing: "border-box" }} />
      <label style={{ fontSize: 15, color: "#6b6155", display: "block", marginBottom: 4 }}>Main contact name</label>
      <input value={contactName} onChange={(e) => setContactName(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 10, fontSize: 16, boxSizing: "border-box" }} />
      <label style={{ fontSize: 15, color: "#6b6155", display: "block", marginBottom: 4 }}>Main contact email</label>
      <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 12, fontSize: 16, boxSizing: "border-box" }} />
      <p style={{ fontSize: 14, color: "#a39a8d", margin: "0 0 12px" }}>Changing the email here doesn't change how they sign in — that's still tied to their original login.</p>
      {error && <div style={{ color: "#a3372f", fontSize: 15, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="nbd-btn nbd-btn--primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        <button className="nbd-btn nbd-btn--outline" onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </div>
  );
}

function EditBrandAccess({ account, brands, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(new Set(account.approved_brand_ids));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError("");
    const { error: err } = await supabase.from("accounts").update({ approved_brand_ids: Array.from(selected) }).eq("id", account.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setEditing(false);
    onSaved();
  }

  if (!editing) {
    return (
      <button className="nbd-btn nbd-btn--outline nbd-btn--sm" onClick={() => { setSelected(new Set(account.approved_brand_ids)); setEditing(true); }} style={{ marginBottom: 10 }}>
        <Pencil size={13} /> Edit brand access
      </button>
    );
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: 16, marginBottom: 24 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {brands.map((b) => (
          <label key={b.id} style={{ display: "flex", alignItems: "center", gap: 6, background: navy[50], border: "1px solid #e4dfd6", borderRadius: 999, padding: "4px 10px", fontSize: 14, cursor: "pointer" }}>
            <input type="checkbox" checked={selected.has(b.id)} onChange={() => toggle(b.id)} />
            {b.name}
          </label>
        ))}
      </div>
      {error && <div style={{ color: "#a3372f", fontSize: 15, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="nbd-btn nbd-btn--primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        <button className="nbd-btn nbd-btn--outline" onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </div>
  );
}

function DeleteAccount({ account, onDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function del() {
    setBusy(true);
    setError("");
    const { error: err } = await supabase.from("accounts").delete().eq("id", account.id);
    setBusy(false);
    if (err) { setError(err.message); return; }
    onDeleted();
  }

  if (!confirming) {
    return (
      <button className="nbd-btn nbd-btn--danger" onClick={() => setConfirming(true)}>
        <Trash2 size={14} /> Delete account
      </button>
    );
  }

  return (
    <div style={{ background: "#fbeceb", border: "1px solid #f0c9c2", borderRadius: 10, padding: 16, maxWidth: 420 }}>
      <div style={{ fontWeight: 600, color: "#a3372f", marginBottom: 6, fontSize: 16 }}>Delete {account.company_name}?</div>
      <p style={{ fontSize: 15, color: "#6b6155", margin: "0 0 12px" }}>
        This permanently removes the account, its staff logins, and all their progress and certificates. This can't be undone.
        Type the company name to confirm.
      </p>
      <input
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={account.company_name}
        style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 12, fontSize: 16, boxSizing: "border-box" }}
      />
      {error && <div style={{ color: "#a3372f", fontSize: 15, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="nbd-btn nbd-btn--danger-solid"
          onClick={del}
          disabled={busy || typed.trim() !== account.company_name}
        >
          {busy ? "Deleting…" : "Permanently delete"}
        </button>
        <button className="nbd-btn nbd-btn--outline" onClick={() => { setConfirming(false); setTyped(""); setError(""); }}>Cancel</button>
      </div>
    </div>
  );
}

function CustomerProfileLive({ account: initialAccount, brands, onBack, onDeleted }) {
  const [account, setAccount] = useState(initialAccount);
  const [team, setTeam] = useState(null);
  const [progressByBrand, setProgressByBrand] = useState({});

  async function refreshAccount() {
    const { data } = await supabase.from("accounts").select("*").eq("id", account.id).single();
    if (data) setAccount(data);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: users } = await supabase.from("app_users").select("id,name,email,role").eq("account_id", account.id);
      if (cancelled) return;
      setTeam(users || []);
      const holder = (users || []).find((u) => u.role === "holder");
      if (!holder) return;
      const { data: done } = await supabase.from("step_progress").select("step_id").eq("user_id", holder.id);
      const completed = new Set((done || []).map((r) => r.step_id));
      const map = {};
      for (const bid of account.approved_brand_ids) {
        const brand = brands.find((b) => b.id === bid);
        if (!brand) continue;
        const total = brand.brand_steps.length;
        const doneCount = brand.brand_steps.filter((s) => completed.has(s.id)).length;
        map[bid] = { done: doneCount, total };
      }
      setProgressByBrand(map);
    }
    load();
    return () => { cancelled = true; };
  }, [account.id]);

  return (
    <div>
      <button className="nbd-btn nbd-btn--ghost" onClick={onBack} style={{ marginBottom: 16 }}>
        <ChevronLeft size={15} /> All customers
      </button>
      <div style={{ fontSize: 14, color: navy[700], fontWeight: 600, letterSpacing: 0.5, marginBottom: 4 }}>{account.customer_number}</div>
      <EditAccountDetails account={account} onSaved={refreshAccount} />
      <div style={{ fontSize: 15, color: "#8a8074", marginTop: 4, marginBottom: 20 }}>{account.main_contact_name} · {account.main_contact_email}</div>

      <div style={{ fontSize: 15, fontWeight: 600, color: "#6b6155", marginBottom: 10 }}>Brand access & progress</div>
      <EditBrandAccess account={account} brands={brands} onSaved={refreshAccount} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {account.approved_brand_ids.map((bid) => {
          const brand = brands.find((b) => b.id === bid);
          if (!brand) return null;
          const p = progressByBrand[bid] || { done: 0, total: brand.brand_steps.length };
          const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
          return (
            <div key={bid} style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontWeight: 500, color: navy[900], fontSize: 16 }}>{brand.name}</div>
                <Badge tone={pct === 100 ? "gold" : "navy"}>{p.done} / {p.total} complete</Badge>
              </div>
              <div style={{ height: 6, background: "#e4dfd6", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "#4a6b3d" : navy[500] }} />
              </div>
            </div>
          );
        })}
        {account.approved_brand_ids.length === 0 && <div style={{ fontSize: 15, color: "#a39a8d" }}>No brand access approved yet.</div>}
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, color: "#6b6155", marginBottom: 10 }}>Team</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(team || []).map((u) => (
          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, background: u.role === "holder" ? navy[50] : "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: "12px 14px" }}>
            <Users size={16} color={navy[700]} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 16, color: navy[900] }}>{u.name}{u.role === "holder" ? " (main account holder)" : ""}</div>
              <div style={{ fontSize: 14, color: "#8a8074" }}>{u.email}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid #e4dfd6" }}>
        <DeleteAccount account={account} onDeleted={onDeleted} />
      </div>
    </div>
  );
}

function AdminCustomersLive() {
  const [accounts, setAccounts] = useState(null);
  const [brands, setBrands] = useState([]);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);

  async function load() {
    const [{ data: a }, { data: b }] = await Promise.all([
      supabase.from("accounts").select("*").order("company_name"),
      supabase.from("brands").select("id,name,brand_steps(id)"),
    ]);
    setAccounts(a || []);
    setBrands(b || []);
  }
  useEffect(() => { load(); }, []);

  if (!accounts) return <div style={{ color: "#8a8074", fontSize: 16 }}>Loading…</div>;

  const active = accounts.find((a) => a.id === openId);
  if (active) {
    return (
      <CustomerProfileLive
        account={active}
        brands={brands}
        onBack={() => setOpenId(null)}
        onDeleted={() => { setOpenId(null); load(); }}
      />
    );
  }

  const filtered = accounts.filter((a) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return a.company_name.toLowerCase().includes(q) || (a.customer_number || "").toLowerCase().includes(q);
  });

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 600, color: navy[900], margin: "0 0 4px" }}>Customers</h2>
      <p style={{ color: "#8a8074", fontSize: 16, margin: "0 0 16px" }}>Every account, organised by salon name and customer number.</p>
      <div style={{ position: "relative", marginBottom: 16 }}>
        <Search size={15} color="#a39a8d" style={{ position: "absolute", left: 12, top: 11 }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by salon name or customer number…" style={{ width: "100%", padding: "9px 12px 9px 34px", border: "1px solid #ddd5cb", borderRadius: 8, fontSize: 16, boxSizing: "border-box" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((a) => (
          <button key={a.id} className="nbd-rowcard" onClick={() => setOpenId(a.id)}>
            <Building2 size={18} color={navy[500]} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, color: navy[900], fontSize: 16 }}>{a.company_name}</div>
              <div style={{ fontSize: 14, color: "#8a8074" }}>{a.customer_number} · {a.approved_brand_ids.length} brand{a.approved_brand_ids.length !== 1 ? "s" : ""}</div>
            </div>
            <Badge tone={a.status === "approved" ? "gold" : a.status === "declined" ? "muted" : "navy"}>{a.status}</Badge>
            <ChevronRight size={16} color="#a39a8d" />
          </button>
        ))}
        {filtered.length === 0 && <div style={{ fontSize: 15, color: "#a39a8d" }}>No customers match that search.</div>}
      </div>
    </div>
  );
}

// ================= OVERVIEW =================

function AdminOverview() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    async function load() {
      const [brands, steps, customers, pending] = await Promise.all([
        supabase.from("brands").select("id", { count: "exact", head: true }),
        supabase.from("brand_steps").select("id", { count: "exact", head: true }),
        supabase.from("accounts").select("id", { count: "exact", head: true }),
        supabase.from("accounts").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      setStats({
        brands: brands.count || 0,
        steps: steps.count || 0,
        customers: customers.count || 0,
        pending: pending.count || 0,
      });
    }
    load();
  }, []);

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 600, color: navy[900], margin: "0 0 16px" }}>Overview</h2>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Brands" value={stats?.brands ?? "…"} icon={ShieldCheck} />
        <StatCard label="Total steps" value={stats?.steps ?? "…"} icon={PlayCircle} />
        <StatCard label="Customers" value={stats?.customers ?? "…"} icon={Building2} />
        <StatCard label="Pending approvals" value={stats?.pending ?? "…"} icon={Clock} />
      </div>
      <div style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 12, padding: 18 }}>
        <div style={{ fontWeight: 600, color: navy[900], marginBottom: 10 }}>Live on the real database</div>
        <div style={{ fontSize: 16, color: "#6b6155", lineHeight: 1.7 }}>
          Brands, steps, quizzes, approvals and customers here all save for real. Certificate PDFs and Gmail-sent
          approval emails are still placeholders — those come with the Google Drive and email steps of the build.
        </div>
      </div>
    </div>
  );
}

// ================= AI ASSISTANT (preview) =================

const assistantSandboxData = {
  brands: [
    { id: "b1", name: "Eleven Australia", tagline: "Haircare & styling", modules: [] },
    { id: "b2", name: "Kevin.Murphy", tagline: "Haircare", modules: [] },
    { id: "b3", name: "Color Wow", tagline: "Colour care & styling", modules: [] },
    { id: "b4", name: "Aveda", tagline: "Haircare & wellness", modules: [] },
    { id: "b5", name: "Davines", tagline: "Sustainable haircare", modules: [] },
    { id: "b6", name: "K18", tagline: "Bond repair treatment", modules: [] },
    { id: "b7", name: "Living Proof", tagline: "Haircare technology", modules: [] },
  ],
  requests: [],
};

function AdminAssistantPreview() {
  const [data, setData] = useState(assistantSandboxData);
  function patch(partial) {
    setData((prev) => ({ ...prev, ...partial }));
  }
  return (
    <div>
      <div style={{ background: "#fdf6e3", border: "1px solid #eddfad", color: "#8a6d1f", fontSize: 15, padding: "9px 14px", borderRadius: 8, marginBottom: 18 }}>
        Preview only — try instructions here, but nothing gets saved to your live brand list yet. Use "Brands & modules" to actually build a sequence.
      </div>
      <AdminAssistant data={data} patch={patch} />
    </div>
  );
}

// ================= ROOT =================

export default function AdminApp() {
  const [tab, setTab] = useState("dashboard");
  const tabs = [
    { id: "dashboard", label: "Overview", icon: ShieldCheck },
    { id: "customers", label: "Customers", icon: Building2 },
    { id: "assistant", label: "AI assistant", icon: Sparkles },
    { id: "brands", label: "Brands & modules", icon: PlayCircle },
    { id: "approvals", label: "Approvals", icon: Clock },
    { id: "design", label: "Design", icon: Palette },
  ];
  return (
    <div style={{ display: "flex", gap: 24 }}>
      <style>{ADMIN_BTN_CSS}</style>
      <div style={{ width: 190, flexShrink: 0 }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "9px 12px", borderRadius: 8, fontSize: 16, marginBottom: 4, background: tab === t.id ? navy[100] : "transparent", color: tab === t.id ? navy[900] : "#6b6155", fontWeight: tab === t.id ? 500 : 400, border: "none" }}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {tab === "dashboard" && <AdminOverview />}
        {tab === "customers" && <AdminCustomersLive />}
        {tab === "assistant" && <AdminAssistantPreview />}
        {tab === "brands" && <AdminBrandsLive />}
        {tab === "approvals" && <AdminApprovalsLive />}
        {tab === "design" && <DesignTab />}
      </div>
    </div>
  );
}
