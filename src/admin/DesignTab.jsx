import React, { useEffect, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { navy, grey, useSiteSettings } from "../lib/ui.jsx";

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

function BrandLogoRow({ brand, onChange, onMove, isFirst, isLast }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "14px 0", borderBottom: "1px solid #eee2d3" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <button className="nbd-btn nbd-btn--ghost nbd-btn--sm" disabled={isFirst} onClick={() => onMove(-1)} style={{ padding: "2px 8px" }}>↑</button>
        <button className="nbd-btn nbd-btn--ghost nbd-btn--sm" disabled={isLast} onClick={() => onMove(1)} style={{ padding: "2px 8px" }}>↓</button>
      </div>

      <div style={{ width: 90, height: 44, background: navy[100], borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <img src={brand.logo_url} alt={brand.name} style={{ height: Math.min(brand.hero_size, 40), maxWidth: 80, objectFit: "contain" }} />
      </div>

      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 700, color: navy[900], fontSize: 14, marginBottom: 8 }}>{brand.name}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          <label style={{ fontSize: 13, color: grey, display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={brand.hero_visible} onChange={(e) => onChange({ hero_visible: e.target.checked })} />
            Show on landing page
          </label>
          <label style={{ fontSize: 13, color: grey, display: "flex", alignItems: "center", gap: 6 }}>
            Side:
            <select value={brand.hero_side} onChange={(e) => onChange({ hero_side: e.target.value })} style={{ padding: "3px 6px", border: "1px solid #ddd5cb", borderRadius: 6, fontSize: 13 }}>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </label>
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 10, flexWrap: "wrap" }}>
          <div style={{ minWidth: 160 }}>
            <Slider label="Size" value={brand.hero_size} onChange={(v) => onChange({ hero_size: v })} min={20} max={90} />
          </div>
          <div style={{ minWidth: 160 }}>
            <Slider label="Vertical offset" value={brand.hero_offset_y} onChange={(v) => onChange({ hero_offset_y: v })} min={-60} max={60} />
          </div>
        </div>
      </div>
    </div>
  );
}

function BrandHeroLogos() {
  const [brands, setBrands] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function reload() {
    const { data } = await supabase
      .from("brands")
      .select("id,name,logo_url,hero_visible,hero_side,hero_size,hero_offset_y,hero_order")
      .not("logo_url", "is", null)
      .order("hero_order");
    setBrands(data || []);
  }

  useEffect(() => { reload(); }, []);

  function updateLocal(id, fields) {
    setBrands((list) => list.map((b) => (b.id === id ? { ...b, ...fields } : b)));
  }

  function move(id, dir) {
    setBrands((list) => {
      const idx = list.findIndex((b) => b.id === id);
      const swapWith = idx + dir;
      if (swapWith < 0 || swapWith >= list.length) return list;
      const next = [...list];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setNotice("");
    await Promise.all(
      brands.map((b, i) =>
        supabase
          .from("brands")
          .update({ hero_visible: b.hero_visible, hero_side: b.hero_side, hero_size: b.hero_size, hero_offset_y: b.hero_offset_y, hero_order: i })
          .eq("id", b.id)
      )
    );
    setSaving(false);
    setNotice("Saved — changes are live on the landing page now.");
    reload();
  }

  if (!brands) return <div style={{ color: grey, fontSize: 14 }}>Loading…</div>;

  return (
    <div style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: 20, marginBottom: 20 }}>
      <div style={{ fontWeight: 700, color: navy[900], marginBottom: 4 }}>Brand logos on the landing page</div>
      <p style={{ fontSize: 13, color: grey, margin: "0 0 14px" }}>
        Choose which side each brand's logo sits on, how big it is, and its vertical position. Use the arrows to reorder within a side.
      </p>

      {brands.length === 0 ? (
        <div style={{ color: "#a39a8d", fontSize: 14 }}>No brands have a logo uploaded yet.</div>
      ) : (
        brands.map((b, i) => (
          <BrandLogoRow
            key={b.id}
            brand={b}
            isFirst={i === 0}
            isLast={i === brands.length - 1}
            onChange={(fields) => updateLocal(b.id, fields)}
            onMove={(dir) => move(b.id, dir)}
          />
        ))
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
