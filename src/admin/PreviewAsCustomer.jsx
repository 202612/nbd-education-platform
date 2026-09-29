import React, { useEffect, useRef, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { ChevronLeft, Eye, Download, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { navy, gold, WORDMARK_SRC } from "../lib/ui.jsx";

// Lets an admin click through a brand's training exactly as a learner would
// — real video/quiz content, real certificate artwork and name position —
// under a name they type in. Nothing here writes to the database: no
// step_progress, no certificates row, no PDF upload. Quiz answers aren't
// graded (get_quiz_questions never returns the answer key to begin with),
// and video "completion" just advances the preview locally.

function extractYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

async function waitForImages(el) {
  const imgs = Array.from(el.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise((res) => { img.onload = res; img.onerror = res; })
    )
  );
}

async function buildCertificatePdf(el) {
  await waitForImages(el);
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [canvas.width, canvas.height] });
  pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
  return pdf;
}

const noticeStyle = { background: "#fdf6e3", border: "1px solid #eddfad", color: "#8a6d1f", fontSize: 14, padding: "9px 14px", borderRadius: 8, marginBottom: 16 };

function PreviewVideoStep({ step, onContinue }) {
  const [playbackUrl, setPlaybackUrl] = useState(step.video_storage_path ? null : step.video_url);

  useEffect(() => {
    if (!step.video_storage_path) { setPlaybackUrl(step.video_url); return; }
    let cancelled = false;
    supabase.storage.from("training-videos").createSignedUrl(step.video_storage_path, 3600).then(({ data }) => {
      if (!cancelled) setPlaybackUrl(data?.signedUrl || null);
    });
    return () => { cancelled = true; };
  }, [step.id, step.video_storage_path, step.video_url]);

  const youtubeId = !step.video_storage_path ? extractYouTubeId(step.video_url) : null;

  return (
    <div>
      <h3 style={{ fontSize: 18, fontWeight: 600, color: navy[900], margin: "0 0 12px" }}>{step.title}</h3>
      <div style={{ background: "#111", borderRadius: 10, overflow: "hidden", marginBottom: 16, aspectRatio: "16 / 9" }}>
        {youtubeId ? (
          <iframe title={step.title} src={`https://www.youtube.com/embed/${youtubeId}`} style={{ width: "100%", height: "100%", border: "none" }} allow="autoplay; encrypted-media" allowFullScreen />
        ) : playbackUrl ? (
          <video src={playbackUrl} controls style={{ width: "100%", height: "100%" }} />
        ) : (
          <div style={{ color: "#a39a8d", display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 14 }}>No video file yet</div>
        )}
      </div>
      <button className="nbd-btn nbd-btn--primary" onClick={onContinue}>Continue (preview) →</button>
    </div>
  );
}

function PreviewQuizStep({ step, onContinue }) {
  const [questions, setQuestions] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setQuestions(null);
    supabase.rpc("get_quiz_questions", { p_step_id: step.id }).then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) { setError(err.message); return; }
      setQuestions(data || []);
    });
    return () => { cancelled = true; };
  }, [step.id]);

  return (
    <div>
      <h3 style={{ fontSize: 18, fontWeight: 600, color: navy[900], margin: "0 0 12px" }}>{step.title}</h3>
      <div style={noticeStyle}>Preview only — shown so you can review the wording, answers aren't graded here.</div>
      {error && <div style={{ color: "#a3372f", fontSize: 14, marginBottom: 12 }}>{error}</div>}
      {!questions && !error && <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8a8074", fontSize: 14, marginBottom: 12 }}><Loader2 size={15} className="spin" /> Loading…</div>}
      {questions?.map((q, i) => (
        <div key={q.id} style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: 14, marginBottom: 10 }}>
          <div style={{ fontWeight: 600, color: navy[900], marginBottom: 8, fontSize: 15 }}>{i + 1}. {q.text}</div>
          {q.options.map((opt, oi) => (
            <div key={oi} style={{ fontSize: 14, color: "#6b6155", padding: "3px 0" }}>○ {opt}</div>
          ))}
        </div>
      ))}
      <button className="nbd-btn nbd-btn--primary" onClick={onContinue} style={{ marginTop: 6 }}>Continue (preview) →</button>
    </div>
  );
}

function PreviewCertificateStep({ step, brand, participantName }) {
  const certRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  async function downloadPdf() {
    if (!certRef.current) return;
    setDownloading(true);
    const pdf = await buildCertificatePdf(certRef.current);
    pdf.save(`${brand.name.replace(/\s+/g, "-")}-certificate-preview.pdf`);
    setDownloading(false);
  }

  return (
    <div>
      <div style={noticeStyle}>Preview only — nothing is saved. No certificate record is created and no PDF is stored.</div>

      {step.cert_template_url ? (
        <div ref={certRef} style={{ position: "relative", width: 900, maxWidth: "100%", margin: "0 auto 18px" }}>
          <img src={step.cert_template_url} alt={`${brand.name} certificate`} style={{ display: "block", width: "100%" }} />
          <div
            style={{
              position: "absolute", left: `${step.cert_name_x ?? 50}%`, top: `${step.cert_name_y ?? 55}%`,
              transform: "translate(-50%, -50%)", whiteSpace: "nowrap",
              fontSize: step.cert_name_font_size ?? 34, color: step.cert_name_color || "#1a2b3d",
              fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 600,
            }}
          >
            {participantName}
          </div>
        </div>
      ) : (
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
          <div style={{ fontSize: 15, letterSpacing: 3, color: "#8a8074", textTransform: "uppercase", marginBottom: 18 }}>Certificate of Participation</div>
          <div style={{ fontSize: 16, color: "#6b6155", marginBottom: 8 }}>This certifies that</div>
          <div style={{ fontSize: 34, fontWeight: 600, color: navy[900], marginBottom: 18, fontFamily: "Georgia, 'Times New Roman', serif" }}>{participantName}</div>
          <div style={{ fontSize: 16, color: "#6b6155", marginBottom: 28, maxWidth: 480 }}>
            has successfully completed the <strong>{brand.name}</strong> training programme
          </div>
          <div style={{ fontSize: 15, color: "#a39a8d", marginBottom: 16 }}>
            {new Date().toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" })}
          </div>
          <img src={WORDMARK_SRC} alt="National Beauty Distribution" style={{ height: 22 }} />
        </div>
      )}

      <div style={{ textAlign: "center" }}>
        <button className="nbd-btn nbd-btn--primary" onClick={downloadPdf} disabled={downloading}>
          <Download size={15} /> {downloading ? "Preparing PDF…" : "Download preview PDF"}
        </button>
      </div>
    </div>
  );
}

export default function PreviewAsCustomer({ brand, onBack }) {
  const [steps, setSteps] = useState(null);
  const [name, setName] = useState("Jane Doe");
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("brand_steps")
      .select("id,type,title,video_url,video_storage_path,duration,order_index,cert_template_url,cert_name_x,cert_name_y,cert_name_font_size,cert_name_color")
      .eq("brand_id", brand.id)
      .order("order_index")
      .then(({ data }) => { if (!cancelled) setSteps(data || []); });
    return () => { cancelled = true; };
  }, [brand.id]);

  const active = steps?.[idx];
  const goNext = () => setIdx((i) => Math.min(i + 1, (steps?.length || 1) - 1));

  return (
    <div>
      <button className="nbd-btn nbd-btn--ghost" onClick={onBack} style={{ marginBottom: 14 }}>
        <ChevronLeft size={15} /> Back to brand
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Eye size={18} color={navy[700]} />
        <h2 style={{ fontSize: 20, fontWeight: 600, color: navy[900], margin: 0 }}>Preview as customer — {brand.name}</h2>
      </div>
      <p style={{ color: "#8a8074", fontSize: 14, margin: "0 0 16px" }}>
        See exactly what a learner sees, under any name you choose. Nothing here is saved — no progress, no certificate record.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <label style={{ fontSize: 13, color: "#6b6155", fontWeight: 700 }}>Preview name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Doe"
          style={{ padding: "6px 10px", border: "1px solid #ddd5cb", borderRadius: 6, fontSize: 14, minWidth: 180 }}
        />
      </div>

      {!steps && <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8a8074", fontSize: 15 }}><Loader2 size={16} className="spin" /> Loading…</div>}
      {steps && steps.length === 0 && <div style={{ color: "#a39a8d", fontSize: 14 }}>This brand has no steps yet — add some in the editor first.</div>}

      {steps && steps.length > 0 && active && (
        <>
          <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
            {steps.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setIdx(i)}
                className={i === idx ? "nbd-btn nbd-btn--primary nbd-btn--sm" : "nbd-btn nbd-btn--outline nbd-btn--sm"}
              >
                {i + 1}. {s.title}
              </button>
            ))}
          </div>

          {active.type === "video" && <PreviewVideoStep step={active} onContinue={goNext} />}
          {active.type === "quiz" && <PreviewQuizStep step={active} onContinue={goNext} />}
          {active.type === "certificate" && <PreviewCertificateStep step={active} brand={brand} participantName={name.trim() || "Jane Doe"} />}
        </>
      )}
    </div>
  );
}
