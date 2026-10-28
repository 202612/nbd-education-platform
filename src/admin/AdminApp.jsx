import React, { useEffect, useState } from "react";
import {
  ShieldCheck, Building2, Clock, PlayCircle, CheckCircle2, Award, Plus, Trash2, Check, X,
  ChevronRight, ChevronLeft, ArrowUp, ArrowDown, Search, Loader2, Sparkles, Users, Image as ImageIcon, Pencil, Palette, Eye,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { navy, Badge, StatCard } from "../lib/ui.jsx";
import { AdminAssistant } from "./AdminMock.jsx";
import DesignTab from "./DesignTab.jsx";
import CertificatesTab from "./CertificatesTab.jsx";
import PreviewAsCustomer from "./PreviewAsCustomer.jsx";
import AdminSecurity from "./AdminSecurity.jsx";

// ================= BRANDS & STEPS =================

const STEP_TYPES = [
  { type: "video", label: "Video", icon: PlayCircle, color: "#5e8f1e" },
  { type: "quiz", label: "Quiz", icon: CheckCircle2, color: "#8a6d1f" },
  { type: "certificate", label: "Certificate", icon: Award, color: "#2b6f6f" },
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

.nbd-actions { display: inline-flex; align-items: center; border: 1px solid #ddd5cb; border-radius: 999px; overflow: hidden; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
.nbd-actions button {
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 34px; background: #fff; border: none;
  border-left: 1px solid #ddd5cb; color: #3d3627; cursor: pointer;
  transition: background .12s ease, color .12s ease;
}
.nbd-actions button:first-child { border-left: none; }
.nbd-actions button:hover:not(:disabled) { background: #eef5e2; color: #517d1a; }
.nbd-actions button:disabled { opacity: .3; cursor: default; }
.nbd-actions button.nbd-danger { color: #a3372f; }
.nbd-actions button.nbd-danger:hover:not(:disabled) { background: #fdecea; color: #8a2f28; }

.spin { animation: nbd-spin 1s linear infinite; }
@keyframes nbd-spin { to { transform: rotate(360deg); } }
`;

// ================= QUIZ QUESTION TYPES =================
// Each question picks its own interactive format. The working shape held in
// AddQuizForm's local state is flat and type-specific (easiest to edit);
// questionToRow()/rowToQuestion() convert to/from the DB row shape (which
// funnels everything non-multiple-choice through a single `config` jsonb
// column) right at the save/load boundary.

const QUESTION_TYPES = [
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "drag_choice", label: "Drag to the correct answer" },
  { value: "true_false", label: "True / False" },
  { value: "sequence", label: "Put steps in order" },
  { value: "match_pairs", label: "Match the pairs (drag a line)" },
  { value: "categorize", label: "Sort into categories" },
  { value: "numeric", label: "Numeric guess" },
];

function blankQuestion(type) {
  switch (type) {
    case "drag_choice":
      return { type, text: "", options: ["", "", ""], correct: 0 };
    case "true_false":
      return { type, text: "", options: ["True", "False"], correct: 0 };
    case "numeric":
      return { type, text: "", correctValue: "", tolerance: "0", unit: "" };
    case "sequence":
      return { type, text: "", items: ["", ""] };
    case "match_pairs":
      return { type, text: "", pairs: [{ left: "", right: "" }, { left: "", right: "" }] };
    case "categorize":
      return { type, text: "", buckets: ["Category 1", "Category 2"], items: [{ text: "", bucket: 0 }] };
    default:
      return { type: "multiple_choice", text: "", options: ["", "", ""], correct: 0 };
  }
}

function questionToRow(q, step_id, order_index) {
  const base = { step_id, type: q.type, text: q.text.trim(), order_index, options: null, correct_index: null, config: {} };
  if (q.type === "multiple_choice" || q.type === "drag_choice" || q.type === "true_false") {
    return { ...base, options: q.options, correct_index: q.correct };
  }
  if (q.type === "numeric") {
    return { ...base, config: { correct_value: Number(q.correctValue), tolerance: Number(q.tolerance) || 0, unit: q.unit.trim() } };
  }
  if (q.type === "sequence") {
    return { ...base, config: { items: q.items.map((text, i) => ({ id: `S${i}`, text })) } };
  }
  if (q.type === "match_pairs") {
    return {
      ...base,
      config: {
        left: q.pairs.map((p, i) => ({ id: `L${i}`, text: p.left })),
        right: q.pairs.map((p, i) => ({ id: `R${i}`, text: p.right })),
        correct_pairs: Object.fromEntries(q.pairs.map((_, i) => [`L${i}`, `R${i}`])),
      },
    };
  }
  if (q.type === "categorize") {
    return {
      ...base,
      config: {
        buckets: q.buckets,
        items: q.items.map((it, i) => ({ id: `I${i}`, text: it.text })),
        correct_buckets: Object.fromEntries(q.items.map((it, i) => [`I${i}`, it.bucket])),
      },
    };
  }
  return base;
}

// Multiple choice and drag-to-the-answer share the exact same shape
// (options + which one is correct) — switching between them should keep
// whatever was already typed rather than wiping it back to blank.
const OPTIONS_BASED_TYPES = new Set(["multiple_choice", "drag_choice"]);
function convertQuestionType(q, newType) {
  if (OPTIONS_BASED_TYPES.has(q.type) && OPTIONS_BASED_TYPES.has(newType)) {
    return { ...blankQuestion(newType), text: q.text, options: q.options, correct: q.correct };
  }
  return { ...blankQuestion(newType), text: q.text };
}

function rowToQuestion(row) {
  const type = row.type || "multiple_choice";
  const cfg = row.config || {};
  if (type === "sequence") {
    const items = (cfg.items || []).map((it) => it.text);
    return { type, text: row.text, items: items.length ? items : ["", ""] };
  }
  if (type === "match_pairs") {
    const left = cfg.left || [];
    const right = cfg.right || [];
    const pairs = left.map((l, i) => ({ left: l.text, right: right[i]?.text || "" }));
    return { type, text: row.text, pairs: pairs.length ? pairs : [{ left: "", right: "" }] };
  }
  if (type === "categorize") {
    const correctBuckets = cfg.correct_buckets || {};
    const items = (cfg.items || []).map((it) => ({ text: it.text, bucket: correctBuckets[it.id] ?? 0 }));
    return { type, text: row.text, buckets: cfg.buckets || ["Category 1", "Category 2"], items: items.length ? items : [{ text: "", bucket: 0 }] };
  }
  if (type === "numeric") {
    return { type, text: row.text, correctValue: String(cfg.correct_value ?? ""), tolerance: String(cfg.tolerance ?? "0"), unit: cfg.unit || "" };
  }
  return { type, text: row.text, options: row.options || ["", "", ""], correct: row.correct_index ?? 0 };
}

function QuestionTypeFields({ q, onChange }) {
  const fieldStyle = { flex: 1, padding: "6px 9px", border: "1px solid #ddd5cb", borderRadius: 6, fontSize: 15 };

  if (q.type === "multiple_choice" || q.type === "drag_choice") {
    return (
      <>
        {q.type === "drag_choice" && (
          <p style={{ fontSize: 13, color: "#a39a8d", margin: "0 0 8px" }}>Learners see this as a speech bubble and drag a line to the correct answer on the right.</p>
        )}
        {q.options.map((opt, oi) => (
          <div key={oi} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <input type="radio" checked={q.correct === oi} onChange={() => onChange({ correct: oi })} title="Correct answer" />
            <input
              spellCheck
              lang="en-GB"
              value={opt}
              onChange={(e) => onChange({ options: q.options.map((o, i) => (i === oi ? e.target.value : o)) })}
              placeholder={`Option ${oi + 1}`}
              style={fieldStyle}
            />
            {q.options.length > 2 && (
              <button className="nbd-iconbtn" onClick={() => {
                const options = q.options.filter((_, i) => i !== oi);
                onChange({ options, correct: q.correct >= options.length ? 0 : q.correct });
              }} title="Remove option"><X size={13} /></button>
            )}
          </div>
        ))}
        <button className="nbd-linkbtn" onClick={() => onChange({ options: [...q.options, ""] })}>+ Add option</button>
      </>
    );
  }

  if (q.type === "true_false") {
    return (
      <div style={{ display: "flex", gap: 16 }}>
        {["True", "False"].map((label, oi) => (
          <label key={oi} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 15, color: "#3d3830" }}>
            <input type="radio" checked={q.correct === oi} onChange={() => onChange({ correct: oi })} /> {label}
          </label>
        ))}
      </div>
    );
  }

  if (q.type === "numeric") {
    return (
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div>
          <label style={{ fontSize: 13, color: "#8a8074", display: "block", marginBottom: 2 }}>Correct value</label>
          <input type="number" value={q.correctValue} onChange={(e) => onChange({ correctValue: e.target.value })} style={{ ...fieldStyle, width: 110 }} />
        </div>
        <div>
          <label style={{ fontSize: 13, color: "#8a8074", display: "block", marginBottom: 2 }}>± tolerance</label>
          <input type="number" value={q.tolerance} onChange={(e) => onChange({ tolerance: e.target.value })} style={{ ...fieldStyle, width: 110 }} />
        </div>
        <div>
          <label style={{ fontSize: 13, color: "#8a8074", display: "block", marginBottom: 2 }}>Unit (optional)</label>
          <input value={q.unit} onChange={(e) => onChange({ unit: e.target.value })} placeholder="e.g. %, ml" style={{ ...fieldStyle, width: 110 }} />
        </div>
      </div>
    );
  }

  if (q.type === "sequence") {
    return (
      <>
        <p style={{ fontSize: 13, color: "#a39a8d", margin: "0 0 8px" }}>Enter the steps in the correct order — learners will see them shuffled and drag them back into place.</p>
        {q.items.map((item, oi) => (
          <div key={oi} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: "#a39a8d", width: 16 }}>{oi + 1}.</span>
            <input spellCheck lang="en-GB" value={item} onChange={(e) => onChange({ items: q.items.map((v, i) => (i === oi ? e.target.value : v)) })} placeholder={`Step ${oi + 1}`} style={fieldStyle} />
            <button className="nbd-iconbtn" onClick={() => onChange({ items: q.items.filter((_, i) => i !== oi) })} disabled={q.items.length <= 2} title="Remove step"><X size={13} /></button>
          </div>
        ))}
        <button className="nbd-linkbtn" onClick={() => onChange({ items: [...q.items, ""] })}>+ Add step</button>
      </>
    );
  }

  if (q.type === "match_pairs") {
    return (
      <>
        <p style={{ fontSize: 13, color: "#a39a8d", margin: "0 0 8px" }}>Each row is a matching pair — learners click one from each side to link them.</p>
        {q.pairs.map((pair, oi) => (
          <div key={oi} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <input spellCheck lang="en-GB" value={pair.left} onChange={(e) => onChange({ pairs: q.pairs.map((p, i) => (i === oi ? { ...p, left: e.target.value } : p)) })} placeholder="Term" style={fieldStyle} />
            <span style={{ color: "#a39a8d" }}>↔</span>
            <input spellCheck lang="en-GB" value={pair.right} onChange={(e) => onChange({ pairs: q.pairs.map((p, i) => (i === oi ? { ...p, right: e.target.value } : p)) })} placeholder="Match" style={fieldStyle} />
            <button className="nbd-iconbtn" onClick={() => onChange({ pairs: q.pairs.filter((_, i) => i !== oi) })} disabled={q.pairs.length <= 2} title="Remove pair"><X size={13} /></button>
          </div>
        ))}
        <button className="nbd-linkbtn" onClick={() => onChange({ pairs: [...q.pairs, { left: "", right: "" }] })}>+ Add pair</button>
      </>
    );
  }

  if (q.type === "categorize") {
    return (
      <>
        <p style={{ fontSize: 13, color: "#a39a8d", margin: "0 0 8px" }}>Define the categories, then assign each item to the one it belongs in.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {q.buckets.map((b, bi) => (
            <div key={bi} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input spellCheck lang="en-GB"
                value={b}
                onChange={(e) => onChange({ buckets: q.buckets.map((v, i) => (i === bi ? e.target.value : v)) })}
                placeholder={`Category ${bi + 1}`}
                style={{ ...fieldStyle, width: 130 }}
              />
              {q.buckets.length > 2 && (
                <button className="nbd-iconbtn" onClick={() => {
                  const buckets = q.buckets.filter((_, i) => i !== bi);
                  onChange({ buckets, items: q.items.map((it) => ({ ...it, bucket: it.bucket >= buckets.length ? 0 : it.bucket })) });
                }} title="Remove category"><X size={13} /></button>
              )}
            </div>
          ))}
          <button className="nbd-linkbtn" onClick={() => onChange({ buckets: [...q.buckets, `Category ${q.buckets.length + 1}`] })}>+ Category</button>
        </div>
        {q.items.map((item, oi) => (
          <div key={oi} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <input spellCheck lang="en-GB" value={item.text} onChange={(e) => onChange({ items: q.items.map((it, i) => (i === oi ? { ...it, text: e.target.value } : it)) })} placeholder={`Item ${oi + 1}`} style={fieldStyle} />
            <select value={item.bucket} onChange={(e) => onChange({ items: q.items.map((it, i) => (i === oi ? { ...it, bucket: Number(e.target.value) } : it)) })} style={{ padding: "6px 9px", border: "1px solid #ddd5cb", borderRadius: 6, fontSize: 14 }}>
              {q.buckets.map((b, bi) => <option key={bi} value={bi}>{b}</option>)}
            </select>
            <button className="nbd-iconbtn" onClick={() => onChange({ items: q.items.filter((_, i) => i !== oi) })} disabled={q.items.length <= 1} title="Remove item"><X size={13} /></button>
          </div>
        ))}
        <button className="nbd-linkbtn" onClick={() => onChange({ items: [...q.items, { text: "", bucket: 0 }] })}>+ Add item</button>
      </>
    );
  }

  return null;
}

function questionIsIncomplete(q) {
  if (!q.text.trim()) return true;
  if (q.type === "multiple_choice" || q.type === "drag_choice" || q.type === "true_false") return q.options.some((o) => !o.trim());
  if (q.type === "numeric") return q.correctValue === "" || isNaN(Number(q.correctValue));
  if (q.type === "sequence") return q.items.some((i) => !i.trim());
  if (q.type === "match_pairs") return q.pairs.some((p) => !p.left.trim() || !p.right.trim());
  if (q.type === "categorize") return q.items.some((i) => !i.text.trim()) || q.buckets.some((b) => !b.trim());
  return false;
}

function AddQuizForm({ initial, submitLabel, onCancel, onSave }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [questions, setQuestions] = useState(initial?.questions || [blankQuestion("multiple_choice")]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function updateQuestion(qi, patch) {
    setQuestions(questions.map((q, i) => (i === qi ? { ...q, ...patch } : q)));
  }
  function setQuestionType(qi, type) {
    setQuestions(questions.map((q, i) => (i === qi ? convertQuestionType(q, type) : q)));
  }
  function addQuestion() {
    setQuestions([...questions, blankQuestion("multiple_choice")]);
  }
  function removeQuestion(qi) {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== qi));
  }

  async function save() {
    if (!title.trim()) { setError("Give the quiz a title"); return; }
    if (questions.some(questionIsIncomplete)) {
      setError("Fill in every question completely first");
      return;
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
      <input spellCheck lang="en-GB" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Quick check: Foundations" style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 14, fontSize: 16, boxSizing: "border-box" }} />
      {questions.map((q, qi) => (
        <div key={qi} style={{ border: "1px solid #e4dfd6", borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
            <input spellCheck lang="en-GB" value={q.text} onChange={(e) => updateQuestion(qi, { text: e.target.value })} placeholder={`Question ${qi + 1}`} style={{ flex: "1 1 220px", padding: "7px 9px", border: "1px solid #ddd5cb", borderRadius: 6, fontSize: 15 }} />
            <select value={q.type} onChange={(e) => setQuestionType(qi, e.target.value)} style={{ padding: "7px 9px", border: "1px solid #ddd5cb", borderRadius: 6, fontSize: 14 }}>
              {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <button className="nbd-iconbtn" onClick={() => removeQuestion(qi)} title="Remove question"><Trash2 size={14} /></button>
          </div>
          <QuestionTypeFields q={q} onChange={(patch) => updateQuestion(qi, patch)} />
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
      <input spellCheck lang="en-GB" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Foundations of Colour Theory" style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 12, fontSize: 16, boxSizing: "border-box" }} />
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

const CERT_PREVIEW_WIDTH = 900; // matches the certificate width used on the learner's screen, so font size/position line up 1:1

function AddCertificateForm({ brandId, initial, submitLabel, onCancel, onSave }) {
  const [title, setTitle] = useState(initial?.title || "Certificate of Participation");
  const [templateUrl, setTemplateUrl] = useState(initial?.cert_template_url || null);
  const [nameX, setNameX] = useState(initial?.cert_name_x ?? 50);
  const [nameY, setNameY] = useState(initial?.cert_name_y ?? 55);
  const [fontSize, setFontSize] = useState(initial?.cert_name_font_size ?? 34);
  const [color, setColor] = useState(initial?.cert_name_color || "#1a2b3d");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function uploadTemplate(file) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Please use a PNG, JPG, or WebP image.");
      return;
    }
    setUploading(true);
    setError("");
    const path = `${brandId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("certificate-templates").upload(path, file);
    if (upErr) { setUploading(false); setError(upErr.message); return; }
    const { data } = supabase.storage.from("certificate-templates").getPublicUrl(path);
    setTemplateUrl(data.publicUrl);
    setUploading(false);
  }

  const [dragOver, setDragOver] = useState(false);

  async function save() {
    if (!title.trim()) { setError("Give the certificate a title"); return; }
    setSaving(true);
    setError("");
    const err = await onSave({
      title: title.trim(),
      cert_template_url: templateUrl,
      cert_name_x: nameX,
      cert_name_y: nameY,
      cert_name_font_size: fontSize,
      cert_name_color: color,
    });
    setSaving(false);
    if (err) setError(err);
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <label style={{ fontSize: 15, color: "#6b6155", display: "block", marginBottom: 4 }}>Certificate title</label>
      <input spellCheck lang="en-GB" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 14, fontSize: 16, boxSizing: "border-box" }} />
      <p style={{ fontSize: 14, color: "#a39a8d", margin: "0 0 14px" }}>
        Awarded automatically once every earlier step in this brand is complete, with the learner's name and the
        date filled in. By default it uses the built-in design below — upload your own artwork instead if you'd
        rather use a design you made yourself.
      </p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); uploadTemplate(e.dataTransfer.files?.[0]); }}
        style={{
          border: dragOver ? "1px dashed #a8cb63" : "1px solid #e4dfd6",
          background: dragOver ? "#f2f7e9" : "transparent",
          borderRadius: 8, padding: 14, marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 700, color: navy[900], fontSize: 14 }}>Certificate artwork</div>
          <label className="nbd-btn nbd-btn--outline nbd-btn--sm">
            {uploading ? <Loader2 size={13} className="spin" /> : <ImageIcon size={13} />}
            {uploading ? "Uploading…" : templateUrl ? "Replace image" : "Upload image"}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => uploadTemplate(e.target.files?.[0])} disabled={uploading} style={{ display: "none" }} />
          </label>
        </div>

        {!templateUrl && (
          <p style={{ fontSize: 13, color: "#a39a8d", margin: "0 0 4px" }}>
            {dragOver ? "Drop to upload" : "Drag an image here, or use Upload image above."}
          </p>
        )}

        {templateUrl ? (
          <>
            <p style={{ fontSize: 13, color: "#a39a8d", margin: "0 0 12px" }}>
              Drag the marker onto the blank line where the learner's name should print. Everything else on your
              design stays exactly as uploaded.
            </p>
            <div
              style={{
                position: "relative", width: "100%", maxWidth: CERT_PREVIEW_WIDTH, margin: "0 auto 14px",
                border: "1px solid #e4dfd6", borderRadius: 4, overflow: "hidden", cursor: "crosshair", userSelect: "none",
              }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setNameX(Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10);
                setNameY(Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10);
              }}
            >
              <img src={templateUrl} alt="Certificate template" style={{ display: "block", width: "100%" }} />
              <div
                style={{
                  position: "absolute", left: `${nameX}%`, top: `${nameY}%`, transform: "translate(-50%, -50%)",
                  fontSize, color, fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 600,
                  whiteSpace: "nowrap", pointerEvents: "none", textShadow: "0 0 1px rgba(255,255,255,0.6)",
                }}
              >
                Jane Doe
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <label style={{ fontSize: 13, color: "#6b6155" }}>
                Name size
                <input type="range" min={16} max={64} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} style={{ display: "block", width: 140 }} />
              </label>
              <label style={{ fontSize: 13, color: "#6b6155" }}>
                Name colour
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ display: "block", marginTop: 4 }} />
              </label>
              <button className="nbd-btn nbd-btn--outline nbd-btn--sm" style={{ alignSelf: "flex-end" }} onClick={() => setTemplateUrl(null)}>
                Remove artwork — use built-in design
              </button>
            </div>
          </>
        ) : (
          <p style={{ fontSize: 13, color: "#a39a8d", margin: 0 }}>No custom artwork uploaded — this brand uses the built-in certificate design.</p>
        )}
      </div>

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
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid #e4dfd6", borderLeft: `4px solid ${meta.color}`, borderRadius: 10, padding: "12px 14px 12px 12px", flexWrap: "wrap" }}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: `${meta.color}1a`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={15} color={meta.color} />
      </div>
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
      <input spellCheck lang="en-GB" value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 10, fontSize: 16, boxSizing: "border-box" }} />
      <label style={{ fontSize: 15, color: "#6b6155", display: "block", marginBottom: 4 }}>Tagline</label>
      <input spellCheck lang="en-GB" value={tagline} onChange={(e) => setTagline(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 12, fontSize: 16, boxSizing: "border-box" }} />
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
  const [previewing, setPreviewing] = useState(false);

  async function load() {
    const { data: b } = await supabase.from("brands").select("id,name,tagline,logo_url").eq("id", brandId).single();
    setBrand(b);
    const { data: s } = await supabase
      .from("brand_steps")
      .select("id,type,title,video_url,video_storage_path,duration,order_index,cert_template_url,cert_name_x,cert_name_y,cert_name_font_size,cert_name_color,quiz_questions(id)")
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
    const rows = questions.map((q, i) => questionToRow(q, step.id, i));
    const { error: qErr } = await supabase.from("quiz_questions").insert(rows);
    if (qErr) return qErr.message;
    setAddingType(null);
    await load();
    return null;
  }

  async function saveCertificate({ title, cert_template_url, cert_name_x, cert_name_y, cert_name_font_size, cert_name_color }) {
    const order_index = await nextOrderIndex();
    const { error: err } = await supabase.from("brand_steps").insert({
      brand_id: brandId, type: "certificate", title, order_index,
      cert_template_url, cert_name_x, cert_name_y, cert_name_font_size, cert_name_color,
    });
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
        .select("text,options,correct_index,type,config,order_index")
        .eq("step_id", step.id)
        .order("order_index");
      setEditingQuizData({
        title: step.title,
        questions: (qs || []).map(rowToQuestion),
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
    const rows = questions.map((q, i) => questionToRow(q, editingStep.id, i));
    const { error: insErr } = await supabase.from("quiz_questions").insert(rows);
    if (insErr) return insErr.message;
    cancelEdit();
    await load();
    return null;
  }

  async function updateCertificate({ title, cert_template_url, cert_name_x, cert_name_y, cert_name_font_size, cert_name_color }) {
    const { error: err } = await supabase.from("brand_steps").update({
      title, cert_template_url, cert_name_x, cert_name_y, cert_name_font_size, cert_name_color,
    }).eq("id", editingStep.id);
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

  if (previewing) {
    return <PreviewAsCustomer brand={brand} onBack={() => setPreviewing(false)} />;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <button className="nbd-btn nbd-btn--ghost" onClick={onBack} style={{ marginBottom: 14 }}>
          <ChevronLeft size={15} /> All brands
        </button>
        <button className="nbd-btn nbd-btn--outline" onClick={() => setPreviewing(true)}>
          <Eye size={14} /> Preview as customer
        </button>
      </div>
      <EditBrandDetails brand={brand} onChanged={load} />
      <p style={{ color: "#8a8074", fontSize: 16, margin: "0 0 18px" }}>Build the sequence customers work through, in order — video, quiz, or certificate steps.</p>

      <BrandLogoUpload brand={brand} onChanged={load} />

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
        {steps.map((s, i) => {
          if (editingStep?.id === s.id) {
            if (s.type === "video") {
              return <AddVideoForm key={s.id} brandId={brandId} initial={editingStep} submitLabel="Save changes" onCancel={cancelEdit} onSave={updateVideo} />;
            }
            if (s.type === "quiz" && editingQuizData) {
              return <AddQuizForm key={s.id} initial={editingQuizData} submitLabel="Save changes" onCancel={cancelEdit} onSave={updateQuiz} />;
            }
            if (s.type === "certificate") {
              return <AddCertificateForm key={s.id} brandId={brandId} initial={editingStep} submitLabel="Save changes" onCancel={cancelEdit} onSave={updateCertificate} />;
            }
          }
          return <StepCard key={s.id} step={s} index={i} count={steps.length} onMove={moveStep} onDelete={deleteStep} onEdit={startEdit} />;
        })}
        {steps.length === 0 && <div style={{ fontSize: 15, color: "#a39a8d" }}>No steps yet — add the first one below.</div>}
      </div>

      {!editingStep && addingType === "video" && <AddVideoForm brandId={brandId} onCancel={() => setAddingType(null)} onSave={saveVideo} />}
      {!editingStep && addingType === "quiz" && <AddQuizForm onCancel={() => setAddingType(null)} onSave={saveQuiz} />}
      {!editingStep && addingType === "certificate" && <AddCertificateForm brandId={brandId} onCancel={() => setAddingType(null)} onSave={saveCertificate} />}

      {!editingStep && !addingType && (
        <div style={{ display: "flex", gap: 8 }}>
          {STEP_TYPES.map((t) => (
            <button key={t.type} className="nbd-btn nbd-btn--outline" onClick={() => setAddingType(t.type)} style={{ color: t.color, borderColor: `${t.color}55` }}>
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
          <input spellCheck lang="en-GB" value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)} placeholder="Brand name" style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 10, fontSize: 16, boxSizing: "border-box" }} />
          <input spellCheck lang="en-GB" value={newBrandTagline} onChange={(e) => setNewBrandTagline(e.target.value)} placeholder="Tagline (optional)" style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 12, fontSize: 16, boxSizing: "border-box" }} />
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
  const [pendingStaff, setPendingStaff] = useState(null);
  const [accountHistory, setAccountHistory] = useState(null);
  const [staffHistory, setStaffHistory] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [selected, setSelected] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState("");

  async function load() {
    const [{ data: b }, { data: p }, { data: s }, { data: ah }, { data: sh }] = await Promise.all([
      supabase.from("brands").select("id,name").order("name"),
      supabase.from("accounts").select("*").eq("status", "pending").order("created_at"),
      supabase.from("app_users").select("id,name,email,created_at,accounts(company_name,customer_number)").eq("status", "pending").order("created_at"),
      supabase.from("accounts").select("id,company_name,customer_number,status,approved_brand_ids,created_at").neq("status", "pending").order("created_at", { ascending: false }).limit(100),
      supabase.from("app_users").select("id,name,email,status,created_at,accounts(company_name,customer_number)").in("status", ["active", "declined"]).eq("role", "staff").order("created_at", { ascending: false }).limit(100),
    ]);
    setBrands(b || []);
    setPending(p || []);
    setPendingStaff(s || []);
    setAccountHistory(ah || []);
    setStaffHistory(sh || []);
  }
  useEffect(() => { load(); }, []);

  async function approveStaff(staffMember) {
    setBusyId(staffMember.id);
    await supabase.from("app_users").update({ status: "active" }).eq("id", staffMember.id);
    setBusyId(null);
    setToast(`${staffMember.name} approved`);
    setTimeout(() => setToast(""), 3500);
    load();
  }
  async function declineStaff(staffMember) {
    setBusyId(staffMember.id);
    await supabase.from("app_users").update({ status: "declined" }).eq("id", staffMember.id);
    setBusyId(null);
    setToast(`${staffMember.name} declined`);
    setTimeout(() => setToast(""), 3500);
    load();
  }

  function toggleBrand(accountId, brandId) {
    setSelected((prev) => {
      const set = new Set(prev[accountId] || []);
      set.has(brandId) ? set.delete(brandId) : set.add(brandId);
      return { ...prev, [accountId]: set };
    });
  }

  async function approve(account) {
    // Checkboxes default to showing requested_brand_ids as pre-checked until
    // the admin explicitly toggles one — this has to match that same default,
    // or an approval where nothing was manually clicked saves an empty list.
    const chosen = Array.from(selected[account.id] || new Set(account.requested_brand_ids));
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

      <h2 style={{ fontSize: 22, fontWeight: 600, color: navy[900], margin: "32px 0 4px" }}>Staff approvals</h2>
      <p style={{ color: "#8a8074", fontSize: 16, margin: "0 0 20px" }}>Staff a manager has added to their own account — they get the same brand access as their account, once approved.</p>
      {pendingStaff && pendingStaff.length === 0 && <div style={{ color: "#8a8074", fontSize: 16 }}>No staff waiting on approval.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(pendingStaff || []).map((s) => (
          <div key={s.id} style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: 16, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 600, color: navy[900] }}>{s.name}</div>
              <div style={{ fontSize: 15, color: "#8a8074" }}>
                {s.email} · {s.accounts?.company_name}{s.accounts?.customer_number ? ` (${s.accounts.customer_number})` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="nbd-btn nbd-btn--primary" onClick={() => approveStaff(s)} disabled={busyId === s.id}>
                <Check size={14} /> Approve
              </button>
              <button className="nbd-btn nbd-btn--outline" onClick={() => declineStaff(s)} disabled={busyId === s.id}>
                <X size={14} /> Decline
              </button>
            </div>
          </div>
        ))}
      </div>

      <button className="nbd-btn nbd-btn--ghost" onClick={() => setShowHistory((v) => !v)} style={{ marginTop: 32, marginBottom: showHistory ? 16 : 0 }}>
        {showHistory ? "Hide" : "View"} request history
      </button>

      {showHistory && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#6b6155", margin: "20px 0 10px" }}>Account requests</div>
          {accountHistory && accountHistory.length === 0 && <div style={{ color: "#a39a8d", fontSize: 14 }}>Nothing yet.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 28 }}>
            {(accountHistory || []).map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, padding: "8px 12px", background: "#fff", border: "1px solid #e4dfd6", borderRadius: 8 }}>
                <Badge tone={a.status === "approved" ? "gold" : "muted"}>{a.status}</Badge>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, color: navy[900] }}>{a.company_name}</span>
                  {a.customer_number ? ` · ${a.customer_number}` : ""}
                  {a.status === "approved" && ` · ${a.approved_brand_ids.length} brand${a.approved_brand_ids.length === 1 ? "" : "s"}`}
                </div>
                <span style={{ color: "#a39a8d" }}>{new Date(a.created_at).toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" })}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 15, fontWeight: 600, color: "#6b6155", margin: "0 0 10px" }}>Staff</div>
          {staffHistory && staffHistory.length === 0 && <div style={{ color: "#a39a8d", fontSize: 14 }}>Nothing yet.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(staffHistory || []).map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, padding: "8px 12px", background: "#fff", border: "1px solid #e4dfd6", borderRadius: 8 }}>
                <Badge tone={s.status === "active" ? "gold" : "muted"}>{s.status}</Badge>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, color: navy[900] }}>{s.name}</span> · {s.email} · {s.accounts?.company_name}
                </div>
                <span style={{ color: "#a39a8d" }}>{new Date(s.created_at).toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
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
      <input spellCheck lang="en-GB" value={companyName} onChange={(e) => setCompanyName(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 10, fontSize: 16, boxSizing: "border-box" }} />
      <label style={{ fontSize: 15, color: "#6b6155", display: "block", marginBottom: 4 }}>Main contact name</label>
      <input spellCheck lang="en-GB" value={contactName} onChange={(e) => setContactName(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 10, fontSize: 16, boxSizing: "border-box" }} />
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
  // completedByUser: { [userId]: Set(stepId) } — every team member's own
  // real progress, not just the main holder's, so admin can see the whole
  // team's stats exactly like a customer would see their own dashboard.
  const [completedByUser, setCompletedByUser] = useState({});

  const approvedBrands = account.approved_brand_ids.map((bid) => brands.find((b) => b.id === bid)).filter(Boolean);

  async function refreshAccount() {
    const { data } = await supabase.from("accounts").select("*").eq("id", account.id).single();
    if (data) setAccount(data);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: users } = await supabase.from("app_users").select("id,name,email,role").eq("account_id", account.id).order("role", { ascending: false });
      if (cancelled || !users) return;
      setTeam(users);
      if (users.length === 0) return;
      const { data: rows } = await supabase.from("step_progress").select("user_id,step_id").in("user_id", users.map((u) => u.id));
      if (cancelled) return;
      const byUser = {};
      for (const u of users) byUser[u.id] = new Set();
      for (const row of rows || []) {
        if (!byUser[row.user_id]) byUser[row.user_id] = new Set();
        byUser[row.user_id].add(row.step_id);
      }
      setCompletedByUser(byUser);
    }
    load();
    return () => { cancelled = true; };
  }, [account.id]);

  function progressFor(userId, brand) {
    const completed = completedByUser[userId] || new Set();
    const total = brand.brand_steps.length;
    const done = brand.brand_steps.filter((s) => completed.has(s.id)).length;
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  const holder = (team || []).find((u) => u.role === "holder");

  return (
    <div>
      <button className="nbd-btn nbd-btn--ghost" onClick={onBack} style={{ marginBottom: 16 }}>
        <ChevronLeft size={15} /> All customers
      </button>
      <div style={{ fontSize: 14, color: navy[700], fontWeight: 600, letterSpacing: 0.5, marginBottom: 4 }}>{account.customer_number}</div>
      <EditAccountDetails account={account} onSaved={refreshAccount} />
      <div style={{ fontSize: 15, color: "#8a8074", marginTop: 4, marginBottom: 20 }}>{account.main_contact_name} · {account.main_contact_email}</div>

      <div style={{ fontSize: 15, fontWeight: 600, color: "#6b6155", marginBottom: 10 }}>Brand access & main holder's progress</div>
      <EditBrandAccess account={account} brands={brands} onSaved={refreshAccount} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
        {approvedBrands.map((brand) => {
          const p = holder ? progressFor(holder.id, brand) : { done: 0, total: brand.brand_steps.length, pct: 0 };
          return (
            <div key={brand.id} style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {brand.logo_url && <img src={brand.logo_url} alt={brand.name} style={{ height: 24, width: 24, objectFit: "contain" }} />}
                  <div style={{ fontWeight: 500, color: navy[900], fontSize: 16 }}>{brand.name}</div>
                </div>
                <Badge tone={p.pct === 100 ? "gold" : "navy"}>{p.done} / {p.total} complete</Badge>
              </div>
              <div style={{ height: 6, background: "#e4dfd6", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${p.pct}%`, background: p.pct === 100 ? "#4a6b3d" : navy[500] }} />
              </div>
            </div>
          );
        })}
        {approvedBrands.length === 0 && <div style={{ fontSize: 15, color: "#a39a8d" }}>No brand access approved yet.</div>}
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, color: "#6b6155", marginBottom: 10 }}>Team performance</div>
      <p style={{ fontSize: 14, color: "#8a8074", margin: "0 0 12px" }}>Every team member's own real progress, same as they'd see on their own dashboard.</p>
      {approvedBrands.length === 0 || !team ? (
        <div style={{ fontSize: 15, color: "#a39a8d", marginBottom: 24 }}>{!team ? "Loading…" : "No brand access approved yet."}</div>
      ) : (
        <div className="nbd-table-wrap" style={{ overflowX: "auto", marginBottom: 28 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "#8a8074", fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #e4dfd6" }}>Team member</th>
                {approvedBrands.map((brand) => (
                  <th key={brand.id} style={{ textAlign: "left", padding: "8px 12px", color: "#8a8074", fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #e4dfd6", whiteSpace: "nowrap" }}>{brand.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {team.map((u) => (
                <tr key={u.id}>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #f0ece3" }}>
                    <div style={{ fontWeight: 600, color: navy[900] }}>{u.name}{u.role === "holder" ? " (holder)" : ""}</div>
                    <div style={{ fontSize: 13, color: "#a39a8d" }}>{u.email}</div>
                  </td>
                  {approvedBrands.map((brand) => {
                    const p = progressFor(u.id, brand);
                    return (
                      <td key={brand.id} style={{ padding: "10px 12px", borderBottom: "1px solid #f0ece3", whiteSpace: "nowrap" }}>
                        <Badge tone={p.pct === 100 ? "gold" : p.done > 0 ? "navy" : "muted"}>{p.done} / {p.total}</Badge>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ fontSize: 15, fontWeight: 600, color: "#6b6155", marginBottom: 10 }}>Team</div>
      <p style={{ fontSize: 13, color: "#a39a8d", margin: "0 0 12px" }}>
        "View as" logs you in as that real person — watching a video, passing a quiz, or claiming a certificate there actually happens on their record. Use "Exit test mode" on the banner to come back.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(team || []).map((u) => (
          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, background: u.role === "holder" ? navy[50] : "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: "12px 14px" }}>
            <Users size={16} color={navy[700]} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 16, color: navy[900] }}>{u.name}{u.role === "holder" ? " (main account holder)" : ""}</div>
              <div style={{ fontSize: 14, color: "#8a8074" }}>{u.email}</div>
            </div>
            <button
              className="nbd-btn nbd-btn--outline nbd-btn--sm"
              onClick={async () => {
                const { error } = await supabase.rpc("admin_set_view_as", { p_app_user_id: u.id });
                if (!error) window.location.reload();
              }}
            >
              <Eye size={13} /> View as this customer
            </button>
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

// Monday-based start of the week containing the given date.
function weekStart(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

function WeeklyBarChart({ weeks }) {
  const max = Math.max(1, ...weeks.map((w) => w.count));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 140 }}>
      {weeks.map((w) => (
        <div key={w.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: navy[900] }}>{w.count}</div>
          <div style={{ width: "100%", maxWidth: 34, height: 90, display: "flex", alignItems: "flex-end", background: "#f0ece3", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ width: "100%", height: `${(w.count / max) * 100}%`, background: navy[500], borderRadius: "6px 6px 0 0" }} />
          </div>
          <div style={{ fontSize: 11, color: "#a39a8d", whiteSpace: "nowrap" }}>{w.label}</div>
        </div>
      ))}
    </div>
  );
}

function BrandBarList({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (rows.length === 0) return <div style={{ color: "#a39a8d", fontSize: 14 }}>No certificates issued yet.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((r) => (
        <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 130, fontSize: 14, color: navy[900], fontWeight: 600, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
          <div style={{ flex: 1, height: 10, background: "#f0ece3", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(r.count / max) * 100}%`, background: navy[500] }} />
          </div>
          <div style={{ width: 28, textAlign: "right", fontSize: 14, fontWeight: 700, color: navy[900] }}>{r.count}</div>
        </div>
      ))}
    </div>
  );
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IE", { day: "2-digit", month: "short" });
}

function RecentActivityFeed({ rows }) {
  if (rows.length === 0) return <div style={{ color: "#a39a8d", fontSize: 14 }}>No activity yet.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {rows.map((r, i) => {
        const meta = STEP_TYPES.find((t) => t.type === r.type) || STEP_TYPES[0];
        const Icon = meta.icon;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: i < rows.length - 1 ? "1px solid #f0ece3" : "none" }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: `${meta.color}1a`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={13} color={meta.color} />
            </div>
            <div style={{ flex: 1, fontSize: 14, color: navy[900] }}>
              <strong>{r.userName}</strong> {r.type === "certificate" ? "earned the certificate" : r.type === "quiz" ? "passed the quiz" : "watched"} <strong>"{r.stepTitle}"</strong> ({r.brandName})
            </div>
            <div style={{ fontSize: 13, color: "#a39a8d", whiteSpace: "nowrap" }}>{timeAgo(r.at)}</div>
          </div>
        );
      })}
    </div>
  );
}

function AdminReporting() {
  const [report, setReport] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const since = new Date();
      since.setDate(since.getDate() - 7 * 8);

      const [progressRes, certsRes, demoAccountRes] = await Promise.all([
        supabase.from("step_progress").select("completed_at").gte("completed_at", since.toISOString()),
        supabase.from("certificates").select("issued_at,brands(name)"),
        supabase.from("accounts").select("id").eq("is_demo", true).maybeSingle(),
      ]);
      if (cancelled) return;

      const demoAccountId = demoAccountRes.data?.id;
      const { data: activeUsers } = await supabase.from("app_users").select("id,account_id").eq("status", "active");
      const realUsers = (activeUsers || []).filter((u) => u.account_id !== demoAccountId);
      const realUserIds = new Set(realUsers.map((u) => u.id));

      const { data: certUserRows } = await supabase.from("certificates").select("user_id");
      const distinctCertUsers = new Set((certUserRows || []).filter((c) => realUserIds.has(c.user_id)).map((c) => c.user_id));
      const completionRate = realUsers.length ? Math.round((distinctCertUsers.size / realUsers.length) * 100) : 0;

      const { data: activityRows } = await supabase
        .from("step_progress")
        .select("completed_at,user_id,app_users(name,account_id),brand_steps(title,type,brands(name))")
        .order("completed_at", { ascending: false })
        .limit(30);
      const activity = (activityRows || [])
        .filter((r) => r.app_users && r.app_users.account_id !== demoAccountId)
        .slice(0, 8)
        .map((r) => ({ at: r.completed_at, userName: r.app_users.name, type: r.brand_steps?.type, brandName: r.brand_steps?.brands?.name || "—", stepTitle: r.brand_steps?.title || "" }));
      if (cancelled) return;

      // Build the last 8 Monday-starting weeks, oldest first.
      const now = new Date();
      const buckets = [];
      for (let i = 7; i >= 0; i--) {
        const start = weekStart(now);
        start.setDate(start.getDate() - i * 7);
        buckets.push({ start, label: start.toLocaleDateString("en-IE", { day: "numeric", month: "short" }), count: 0 });
      }
      for (const row of progressRes.data || []) {
        const rowWeek = weekStart(row.completed_at).getTime();
        const bucket = buckets.find((b) => b.start.getTime() === rowWeek);
        if (bucket) bucket.count += 1;
      }

      const certs = certsRes.data || [];
      const byBrand = {};
      for (const c of certs) {
        const name = c.brands?.name || "Unknown";
        byBrand[name] = (byBrand[name] || 0) + 1;
      }
      const brandRows = Object.entries(byBrand).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

      const thisWeekStart = weekStart(now).getTime();
      const certsThisWeek = certs.filter((c) => weekStart(c.issued_at).getTime() === thisWeekStart).length;

      setReport({
        weeks: buckets.map((b) => ({ label: b.label, count: b.count })),
        brandRows,
        totalCerts: certs.length,
        certsThisWeek,
        completionsThisWeek: buckets[buckets.length - 1].count,
        completionRate,
        enrolledCount: realUsers.length,
        completedCount: distinctCertUsers.size,
        activity,
      });
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (!report) return <div style={{ color: "#8a8074", fontSize: 15 }}>Loading report…</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Steps completed this week" value={report.completionsThisWeek} icon={PlayCircle} />
        <StatCard label="Certificates this week" value={report.certsThisWeek} icon={Award} />
        <StatCard label="Total number of certificates completed" value={report.totalCerts} icon={CheckCircle2} />
        <StatCard label="Completion rate" value={`${report.completionRate}%`} icon={Award} />
      </div>
      <p style={{ fontSize: 13, color: "#a39a8d", margin: "-14px 0 20px" }}>
        {report.completedCount} of {report.enrolledCount} enrolled staff have earned at least one certificate.
      </p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 360px", background: "#fff", border: "1px solid #e4dfd6", borderRadius: 12, padding: 18 }}>
          <div style={{ fontWeight: 600, color: navy[900], marginBottom: 14 }}>Weekly usage — steps completed</div>
          <WeeklyBarChart weeks={report.weeks} />
        </div>
        <div style={{ flex: "1 1 320px", background: "#fff", border: "1px solid #e4dfd6", borderRadius: 12, padding: 18 }}>
          <div style={{ fontWeight: 600, color: navy[900], marginBottom: 14 }}>Certificates completed by brand</div>
          <BrandBarList rows={report.brandRows} />
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 12, padding: 18, marginTop: 16 }}>
        <div style={{ fontWeight: 600, color: navy[900], marginBottom: 4 }}>Recent activity</div>
        <p style={{ fontSize: 13, color: "#a39a8d", margin: "0 0 10px" }}>The latest videos watched, quizzes passed, and certificates earned.</p>
        <RecentActivityFeed rows={report.activity} />
      </div>
    </div>
  );
}

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

      <h3 style={{ fontSize: 18, fontWeight: 600, color: navy[900], margin: "0 0 14px" }}>Reporting</h3>
      <AdminReporting />
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
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadPendingCount() {
      const [{ count: accountCount }, { count: staffCount }] = await Promise.all([
        supabase.from("accounts").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("app_users").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      if (!cancelled) setPendingCount((accountCount || 0) + (staffCount || 0));
    }
    loadPendingCount();
    const interval = setInterval(loadPendingCount, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [tab]);

  const tabs = [
    { id: "dashboard", label: "Overview", icon: ShieldCheck },
    { id: "customers", label: "Customers", icon: Building2 },
    { id: "assistant", label: "AI assistant", icon: Sparkles },
    { id: "brands", label: "Brands & modules", icon: PlayCircle },
    { id: "approvals", label: "Approvals", icon: Clock, badge: pendingCount },
    { id: "certificates", label: "Certificates", icon: Award },
    { id: "design", label: "Design", icon: Palette },
    { id: "security", label: "Security", icon: ShieldCheck },
  ];
  return (
    <div style={{ display: "flex", gap: 24 }}>
      <style>{ADMIN_BTN_CSS}</style>
      <div style={{ width: 190, flexShrink: 0 }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "9px 12px", borderRadius: 8, fontSize: 16, marginBottom: 4, background: tab === t.id ? navy[100] : "transparent", color: tab === t.id ? navy[900] : "#6b6155", fontWeight: tab === t.id ? 500 : 400, border: "none" }}>
            <t.icon size={16} /> {t.label}
            {!!t.badge && (
              <span style={{ marginLeft: "auto", background: "#a3372f", color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 999, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {tab === "dashboard" && <AdminOverview />}
        {tab === "customers" && <AdminCustomersLive />}
        {tab === "assistant" && <AdminAssistantPreview />}
        {tab === "brands" && <AdminBrandsLive />}
        {tab === "approvals" && <AdminApprovalsLive />}
        {tab === "certificates" && <CertificatesTab />}
        {tab === "design" && <DesignTab />}
        {tab === "security" && <AdminSecurity />}
      </div>
    </div>
  );
}
