import React, { useEffect, useState } from "react";
import { Loader2, Upload, Trash2, Image as ImageIcon } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { navy, gold, grey, useSiteSettings } from "../lib/ui.jsx";

function Slider({ label, value, onChange, min = 0, max = 100, step = 1 }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: grey, marginBottom: 4 }}>
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%" }}
      />
    </div>
  );
}

function LogoEditor({ draft, setDraft, onUpload, uploading }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: 20, marginBottom: 20 }}>
      <div style={{ fontWeight: 700, color: navy[900], marginBottom: 4 }}>Logo</div>
      <p style={{ fontSize: 13, color: grey, margin: "0 0 14px" }}>Shown in the white card on the hero banner. Upload a PNG, JPG, SVG, or WebP — PDFs can't display directly in a browser.</p>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ background: "linear-gradient(160deg, #f8f8f8, #eaf2dc)", borderRadius: 12, padding: 20, display: "flex", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: "16px 24px", display: "inline-flex" }}>
            <div style={{ height: 70, width: 200, overflow: "hidden", position: "relative" }}>
              {draft.logo_url ? (
                <img
                  src={draft.logo_url}
                  alt="Logo preview"
                  style={{
                    position: "absolute", inset: 0, width: "100%", height: "100%",
                    objectFit: "contain",
                    objectPosition: `${draft.logo_position_x}% ${draft.logo_position_y}%`,
                    transform: `scale(${draft.logo_zoom})`,
                  }}
                />
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#ccc", fontSize: 12 }}>No logo uploaded</div>
              )}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <label className="nbd-btn nbd-btn--outline nbd-btn--sm" style={{ marginBottom: 16 }}>
            {uploading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
            {uploading ? "Uploading…" : "Upload logo file"}
            <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={onUpload} disabled={uploading} style={{ display: "none" }} />
          </label>
          {draft.logo_url && (
            <>
              <Slider label="Horizontal position" value={draft.logo_position_x} onChange={(v) => setDraft({ ...draft, logo_position_x: v })} />
              <Slider label="Vertical position" value={draft.logo_position_y} onChange={(v) => setDraft({ ...draft, logo_position_y: v })} />
              <Slider label="Zoom" value={draft.logo_zoom} onChange={(v) => setDraft({ ...draft, logo_zoom: v })} min={0.5} max={3} step={0.05} />
            </>
          )}
        </div>
      </div>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function BackgroundEditor({ draft, setDraft, onUpload, uploading }) {
  const backgroundStyle = draft.background_url
    ? {
        backgroundImage: `url(${draft.background_url})`,
        backgroundSize: `${draft.background_zoom * 100}%`,
        backgroundPosition: `${draft.background_position_x}% ${draft.background_position_y}%`,
        backgroundRepeat: "no-repeat",
      }
    : { background: "linear-gradient(160deg, #f8f8f8, #eaf2dc)" };

  return (
    <div style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: 20, marginBottom: 20 }}>
      <div style={{ fontWeight: 700, color: navy[900], marginBottom: 4 }}>Background image</div>
      <p style={{ fontSize: 13, color: grey, margin: "0 0 14px" }}>Fills the hero banner behind the logo and heading. Leave empty to keep the plain gradient.</p>

      <div style={{ ...backgroundStyle, borderRadius: 10, height: 140, marginBottom: 16, position: "relative" }}>
        {draft.background_url && <div style={{ position: "absolute", inset: 0, background: "rgba(20,20,18,0.45)", borderRadius: 10 }} />}
        <div style={{ position: "relative", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, opacity: 0.8 }}>
          {!draft.background_url && "No background image — using gradient"}
        </div>
      </div>

      <label className="nbd-btn nbd-btn--outline nbd-btn--sm" style={{ marginBottom: 16 }}>
        {uploading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
        {uploading ? "Uploading…" : "Upload background image"}
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onUpload} disabled={uploading} style={{ display: "none" }} />
      </label>
      {draft.background_url && (
        <div style={{ maxWidth: 400 }}>
          <Slider label="Horizontal position" value={draft.background_position_x} onChange={(v) => setDraft({ ...draft, background_position_x: v })} />
          <Slider label="Vertical position" value={draft.background_position_y} onChange={(v) => setDraft({ ...draft, background_position_y: v })} />
          <Slider label="Zoom" value={draft.background_zoom} onChange={(v) => setDraft({ ...draft, background_zoom: v })} min={1} max={3} step={0.05} />
        </div>
      )}
    </div>
  );
}

function DraggableLogo({ brand, selected, stageRef, onSelect, onMove, onResize }) {
  function startDrag(e) {
    e.preventDefault();
    onSelect(brand.id);
    const stage = stageRef.current;
    if (!stage) return;

    function handleMove(ev) {
      const rect = stage.getBoundingClientRect();
      const x = Math.min(97, Math.max(3, ((ev.clientX - rect.left) / rect.width) * 100));
      const y = Math.min(94, Math.max(6, ((ev.clientY - rect.top) / rect.height) * 100));
      onMove(brand.id, x, y);
    }
    function handleUp() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  function startResize(e) {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startSize = brand.hero_size;

    function handleMove(ev) {
      const next = Math.min(90, Math.max(20, Math.round(startSize + (ev.clientY - startY) * 0.5)));
      onResize(brand.id, next);
    }
    function handleUp() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  return (
    <div
      onPointerDown={startDrag}
      style={{
        position: "absolute",
        left: `${brand.hero_x}%`,
        top: `${brand.hero_y}%`,
        transform: "translate(-50%, -50%)",
        cursor: "grab",
        padding: 6,
        borderRadius: 8,
        border: selected ? `2px dashed ${gold}` : "2px dashed transparent",
      }}
    >
      <img src={brand.logo_url} alt={brand.name} draggable={false} style={{ height: brand.hero_size, maxWidth: 130, objectFit: "contain", pointerEvents: "none" }} />
      {selected && (
        <div
          onPointerDown={startResize}
          title="Drag to resize"
          style={{
            position: "absolute", right: -6, bottom: -6, width: 16, height: 16, borderRadius: "50%",
            background: gold, border: "2px solid #fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", cursor: "nwse-resize",
          }}
        />
      )}
    </div>
  );
}

function BrandHeroLogos() {
  const { settings } = useSiteSettings();
  const [brands, setBrands] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const stageRef = React.useRef(null);

  async function reload() {
    const { data } = await supabase
      .from("brands")
      .select("id,name,logo_url,hero_visible,hero_size,hero_x,hero_y")
      .order("name");
    setBrands(data || []);
  }

  useEffect(() => { reload(); }, []);

  function updateLocal(id, fields) {
    setBrands((list) => list.map((b) => (b.id === id ? { ...b, ...fields } : b)));
  }

  async function uploadLogo(brand, file) {
    setNotice("");
    const path = `${brand.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("brand-logos").upload(path, file);
    if (uploadError) { setNotice(uploadError.message); return; }
    const { data } = supabase.storage.from("brand-logos").getPublicUrl(path);
    await supabase.from("brands").update({ logo_url: data.publicUrl }).eq("id", brand.id);
    reload();
  }

  async function removeLogo(brand) {
    if (!window.confirm(`Remove ${brand.name}'s logo from the landing page? You can upload a new one any time.`)) return;
    await supabase.from("brands").update({ logo_url: null }).eq("id", brand.id);
    if (selectedId === brand.id) setSelectedId(null);
    reload();
  }

  async function save() {
    setSaving(true);
    setNotice("");
    await Promise.all(
      brands.map((b) =>
        supabase
          .from("brands")
          .update({ hero_visible: b.hero_visible, hero_size: b.hero_size, hero_x: b.hero_x, hero_y: b.hero_y })
          .eq("id", b.id)
      )
    );
    setSaving(false);
    setNotice("Saved — changes are live on the landing page now.");
    reload();
  }

  if (!brands) return <div style={{ color: grey, fontSize: 14 }}>Loading…</div>;

  const visible = brands.filter((b) => b.hero_visible && b.logo_url);
  const selected = brands.find((b) => b.id === selectedId);

  return (
    <div style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: 20, marginBottom: 20 }}>
      <div style={{ fontWeight: 700, color: navy[900], marginBottom: 4 }}>Brand logos on the landing page</div>
      <p style={{ fontSize: 13, color: grey, margin: "0 0 14px" }}>
        Drag any logo to move it. Click one to select it, then drag the small handle at its corner to resize it. Changes save when you click Save below.
      </p>

      <div
        ref={stageRef}
        onPointerDown={() => setSelectedId(null)}
        style={{
          position: "relative",
          width: "100%",
          height: 320,
          borderRadius: 12,
          overflow: "hidden",
          background: settings.background_url
            ? `url(${settings.background_url}) center / cover no-repeat`
            : navy[100],
          border: "1px solid #e4dfd6",
          marginBottom: 16,
          userSelect: "none",
        }}
      >
        <div
          style={{
            position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
            width: "60%", textAlign: "center", pointerEvents: "none", opacity: 0.55,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: navy[700], marginBottom: 6 }}>{settings.eyebrow}</div>
          <div style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300, fontSize: 22, color: navy[900] }}>{settings.headline}</div>
        </div>

        {visible.map((b) => (
          <DraggableLogo
            key={b.id}
            brand={b}
            selected={b.id === selectedId}
            stageRef={stageRef}
            onSelect={setSelectedId}
            onMove={(id, x, y) => updateLocal(id, { hero_x: x, hero_y: y })}
            onResize={(id, size) => updateLocal(id, { hero_size: size })}
          />
        ))}
      </div>

      <div style={{ fontWeight: 700, color: navy[900], fontSize: 14, margin: "20px 0 10px" }}>Brand logo files</div>
      <p style={{ fontSize: 13, color: grey, margin: "0 0 12px" }}>
        Upload a logo for a new brand, replace an existing one, or remove one. Removing a logo automatically takes it off the landing page.
      </p>
      {brands.map((b) => (
        <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: "1px solid #f0ebe0" }}>
          <div style={{ width: 56, height: 44, background: navy[100], borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {b.logo_url ? (
              <img src={b.logo_url} alt={b.name} style={{ maxHeight: 36, maxWidth: 48, objectFit: "contain" }} />
            ) : (
              <ImageIcon size={16} color="#a39a8d" />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 120, fontSize: 14, color: navy[900], fontWeight: 600 }}>{b.name}</div>
          <label style={{ fontSize: 13, color: grey, display: "flex", alignItems: "center", gap: 6, marginRight: 4 }}>
            <input type="checkbox" checked={b.hero_visible} disabled={!b.logo_url} onChange={(e) => updateLocal(b.id, { hero_visible: e.target.checked })} />
            On landing page
          </label>
          <label className="nbd-btn nbd-btn--outline nbd-btn--sm">
            <Upload size={13} /> {b.logo_url ? "Replace" : "Upload"}
            <input type="file" accept="image/*" onChange={(e) => e.target.files[0] && uploadLogo(b, e.target.files[0])} style={{ display: "none" }} />
          </label>
          {b.logo_url && (
            <button className="nbd-btn nbd-btn--outline nbd-btn--sm nbd-btn--danger" onClick={() => removeLogo(b)} title="Remove logo">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ))}
      {selected && (
        <p style={{ fontSize: 12, color: "#a39a8d", margin: "8px 0 0" }}>
          Selected: <strong>{selected.name}</strong> — drag it on the stage above, or drag its corner handle to resize.
        </p>
      )}

      {notice && <div style={{ color: "#4d6b2c", fontSize: 13, margin: "14px 0 0" }}>{notice}</div>}

      <button className="nbd-btn nbd-btn--primary" onClick={save} disabled={saving} style={{ marginTop: 16, padding: "10px 22px" }}>
        {saving ? "Saving…" : "Save brand logo layout"}
      </button>
    </div>
  );
}

export default function DesignTab() {
  const { settings, loading, reload } = useSiteSettings();
  const [draft, setDraft] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (!draft && !loading) setDraft(settings);
  if (!draft) return <div style={{ color: grey, fontSize: 14 }}>Loading…</div>;

  async function uploadFile(file, setBusy, urlField) {
    setBusy(true);
    setError("");
    const path = `hero/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("site-assets").upload(path, file);
    setBusy(false);
    if (uploadError) { setError(uploadError.message); return; }
    const { data } = supabase.storage.from("site-assets").getPublicUrl(path);
    setDraft((d) => ({ ...d, [urlField]: data.publicUrl }));
  }

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    const { id, updated_at, ...fields } = draft;
    const { error: err } = await supabase.from("site_settings").update(fields).eq("id", 1);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setNotice("Saved — changes are live on the landing page now.");
    reload();
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: navy[900], margin: "0 0 4px" }}>Design</h2>
      <p style={{ color: grey, fontSize: 14, margin: "0 0 20px" }}>
        Customize the hero banner on the sign-in and request-access screens. The form section below it always stays as-is.
      </p>

      <LogoEditor draft={draft} setDraft={setDraft} uploading={uploadingLogo} onUpload={(e) => e.target.files[0] && uploadFile(e.target.files[0], setUploadingLogo, "logo_url")} />
      <BackgroundEditor draft={draft} setDraft={setDraft} uploading={uploadingBg} onUpload={(e) => e.target.files[0] && uploadFile(e.target.files[0], setUploadingBg, "background_url")} />
      <BrandHeroLogos />

      <div style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: 20, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, color: navy[900], marginBottom: 14 }}>Heading text</div>
        <label style={{ fontSize: 13, color: grey, display: "block", marginBottom: 4, fontWeight: 700 }}>Eyebrow (small caps line above the heading)</label>
        <input value={draft.eyebrow} onChange={(e) => setDraft({ ...draft, eyebrow: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 12, fontSize: 14, boxSizing: "border-box" }} />
        <label style={{ fontSize: 13, color: grey, display: "block", marginBottom: 4, fontWeight: 700 }}>Heading</label>
        <input value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 12, fontSize: 14, boxSizing: "border-box" }} />
        <label style={{ fontSize: 13, color: grey, display: "block", marginBottom: 4, fontWeight: 700 }}>Subheading text</label>
        <textarea value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} rows={2} style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }} />
      </div>

      {error && <div style={{ color: "#a3372f", fontSize: 13, marginBottom: 14 }}>{error}</div>}
      {notice && <div style={{ color: "#4d6b2c", fontSize: 13, marginBottom: 14 }}>{notice}</div>}

      <button className="nbd-btn nbd-btn--primary" onClick={save} disabled={saving} style={{ padding: "10px 22px" }}>
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
