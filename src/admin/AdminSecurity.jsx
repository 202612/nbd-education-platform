import React, { useEffect, useState } from "react";
import { ShieldCheck, Loader2, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { navy, grey } from "../lib/ui.jsx";

// Admin-only two-factor auth management, using Supabase Auth's built-in TOTP
// support. Enrolling here means the "Enter your 2FA code" challenge in
// App.jsx starts appearing on every future sign-in for this admin.

export default function AdminSecurity() {
  const [factors, setFactors] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [qr, setQr] = useState(null);
  const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors(data?.totp || []);
  }

  useEffect(() => { reload(); }, []);

  async function startEnroll() {
    setError("");
    setBusy(true);
    const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
    setEnrolling(true);
  }

  async function confirmEnroll() {
    if (!code.trim()) { setError("Enter the 6-digit code from your app first"); return; }
    setBusy(true);
    setError("");
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) { setBusy(false); setError(challengeError.message); return; }
    const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: code.trim() });
    setBusy(false);
    if (verifyError) { setError(verifyError.message); return; }
    setEnrolling(false);
    setCode("");
    setQr(null);
    await reload();
  }

  async function cancelEnroll() {
    if (factorId) await supabase.auth.mfa.unenroll({ factorId });
    setEnrolling(false);
    setQr(null);
    setCode("");
    setError("");
  }

  async function removeFactor(id) {
    if (!window.confirm("Turn off two-factor authentication for your account?")) return;
    setBusy(true);
    await supabase.auth.mfa.unenroll({ factorId: id });
    setBusy(false);
    await reload();
  }

  if (!factors) return <div style={{ color: grey, fontSize: 14 }}>Loading…</div>;

  const verified = factors.filter((f) => f.status === "verified");

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 600, color: navy[900], margin: "0 0 4px" }}>Security</h2>
      <p style={{ color: grey, fontSize: 16, margin: "0 0 24px" }}>
        Two-factor authentication for admin logins. Once enabled, signing in needs your password plus a 6-digit code from an authenticator app (Google Authenticator, Authy, 1Password, etc).
      </p>

      {verified.length > 0 && !enrolling && (
        <div style={{ background: "#f2f7e9", border: "1px solid #cde3ab", borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "#4d6b2c", marginBottom: 4 }}>
            <ShieldCheck size={16} /> Two-factor authentication is ON
          </div>
          <div style={{ fontSize: 14, color: "#6b6155" }}>Your account requires a code at every sign-in.</div>
          {verified.map((f) => (
            <button
              key={f.id}
              onClick={() => removeFactor(f.id)}
              disabled={busy}
              className="nbd-btn nbd-btn--outline nbd-btn--sm"
              style={{ marginTop: 12 }}
            >
              <Trash2 size={13} /> Turn off 2FA
            </button>
          ))}
        </div>
      )}

      {verified.length === 0 && !enrolling && (
        <div style={{ background: "#fdf6e3", border: "1px solid #eddfad", borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: "#8a6d1f", marginBottom: 6 }}>Two-factor authentication is OFF</div>
          <p style={{ fontSize: 14, color: "#6b6155", margin: "0 0 12px" }}>
            Turning this on means anyone who gets your password still can't sign in without your phone.
          </p>
          <button onClick={startEnroll} disabled={busy} className="nbd-btn nbd-btn--primary">
            {busy ? <Loader2 size={14} className="spin" /> : <ShieldCheck size={14} />}
            Set up two-factor authentication
          </button>
        </div>
      )}

      {enrolling && (
        <div style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: 20 }}>
          <div style={{ fontWeight: 700, color: navy[900], marginBottom: 12 }}>1. Scan this with your authenticator app</div>
          {qr && <img src={qr} alt="2FA QR code" style={{ width: 180, height: 180, display: "block", marginBottom: 12 }} />}
          <p style={{ fontSize: 13, color: "#8a8074", margin: "0 0 16px" }}>
            Can't scan it? Enter this code manually: <code style={{ background: "#f7f4ee", padding: "2px 6px", borderRadius: 4 }}>{secret}</code>
          </p>
          <div style={{ fontWeight: 700, color: navy[900], marginBottom: 8 }}>2. Enter the 6-digit code it shows you</div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            style={{ padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, fontSize: 16, width: 140, marginBottom: 14, letterSpacing: 2 }}
          />
          {error && <div style={{ color: "#a3372f", fontSize: 14, marginBottom: 12 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={confirmEnroll} disabled={busy} className="nbd-btn nbd-btn--primary">
              {busy ? "Verifying…" : "Confirm & turn on"}
            </button>
            <button onClick={cancelEnroll} disabled={busy} className="nbd-btn nbd-btn--outline">Cancel</button>
          </div>
        </div>
      )}

      {error && !enrolling && <div style={{ color: "#a3372f", fontSize: 14, marginTop: 12 }}>{error}</div>}
    </div>
  );
}
