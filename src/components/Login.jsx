import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { navy, cream, grey, AuthHero, PasswordField, validatePassword, PublicFooter, PublicBrandStrip } from "../lib/ui.jsx";

export default function Login({ onSwitchToApply, initialMode = "signin" }) {
  const [mode, setMode] = useState(initialMode); // "signin" | "signup" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (mode === "forgot") {
      if (!email.trim()) { setError("Enter your email first."); return; }
      setBusy(true);
      setError("");
      setNotice("");
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      setBusy(false);
      if (resetError) { setError(resetError.message); return; }
      setNotice("Check your inbox for a link to reset your password.");
      return;
    }

    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (mode === "signup") {
      const passwordError = validatePassword(password);
      if (passwordError) { setError(passwordError); return; }
      if (password !== confirmPassword) { setError("Those passwords don't match."); return; }
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password });
        if (signUpError) throw signUpError;
        if (data.session === null) {
          setNotice("Check your inbox to confirm your email, then sign in.");
          setMode("signin");
        }
      }
    } catch (err) {
      setError(err.message || "Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ fontFamily: "'Lato', -apple-system, sans-serif", background: cream, minHeight: "100vh" }}>
      <AuthHero />

      <div className="nbd-auth-section">
        <div className="nbd-auth-eyebrow">
          <span className="nbd-auth-eyebrow-rule" />
          ACCESS
        </div>

        <div className="nbd-auth-grid">
          <div className="nbd-auth-aside">
            <h2 style={{ fontSize: 28, fontWeight: 300, color: navy[900], margin: "0 0 14px", lineHeight: 1.15 }}>
              {mode === "signin" ? "Sign in to your account" : mode === "forgot" ? "Reset your password" : "Create your password"}
            </h2>
            <p style={{ color: grey, fontSize: 16, margin: "0 0 28px", lineHeight: 1.6, maxWidth: 360 }}>
              {mode === "signin"
                ? "For approved account holders, staff, and admins — your training, certificates, and brand updates live here."
                : mode === "forgot"
                ? "Enter your email and we'll send you a link to set a new password."
                : "Use the exact email your account manager added you with, then choose a password to finish setting up your account."}
            </p>

            {mode === "signin" && (
              <button
                onClick={onSwitchToApply}
                className="nbd-auth-nudge"
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: navy[900] }}>New customer?</div>
                <div style={{ fontSize: 14, color: grey, marginTop: 2 }}>Request training access for your salon →</div>
              </button>
            )}
          </div>

          <div className="nbd-auth-card">
        <form onSubmit={submit}>
          <label style={{ fontSize: 15, color: grey, display: "block", marginBottom: 4, fontWeight: 700 }}>
            Email<span style={{ color: "#a3372f", fontWeight: 400 }}> (required)</span>
          </label>
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: "11px 12px", border: "1px solid #d8d8d8", borderRadius: 6, marginBottom: 14, fontSize: 17, boxSizing: "border-box", fontFamily: "inherit" }}
          />
          {mode !== "forgot" && (
            <>
              <label style={{ fontSize: 15, color: grey, display: "block", marginBottom: 4, fontWeight: 700 }}>
                Password<span style={{ color: "#a3372f", fontWeight: 400 }}> (required)</span>
              </label>
              <div style={{ marginBottom: mode === "signup" ? 6 : 10 }}>
                <PasswordField
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
              </div>
              {mode === "signup" && (
                <>
                  <p style={{ fontSize: 13, color: "#999", margin: "0 0 14px" }}>At least 8 characters, with an uppercase letter, a lowercase letter, and a number.</p>
                  <label style={{ fontSize: 15, color: grey, display: "block", marginBottom: 4, fontWeight: 700 }}>
                    Confirm password<span style={{ color: "#a3372f", fontWeight: 400 }}> (required)</span>
                  </label>
                  <div style={{ marginBottom: 10 }}>
                    <PasswordField value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
                  </div>
                </>
              )}
            </>
          )}

          {mode === "signin" && (
            <button
              type="button"
              onClick={() => { setMode("forgot"); setError(""); setNotice(""); }}
              style={{ display: "block", textAlign: "right", width: "100%", background: "none", border: "none", color: navy[700], fontSize: 14, margin: "0 0 16px", fontFamily: "inherit" }}
            >
              Forgot your password?
            </button>
          )}
          {mode !== "signin" && <div style={{ marginBottom: 6 }} />}

          {error && <div style={{ color: "#a3372f", fontSize: 15, marginBottom: 16 }}>{error}</div>}
          {notice && <div style={{ color: navy[700], fontSize: 15, marginBottom: 16 }}>{notice}</div>}

          <button
            type="submit"
            disabled={busy}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: navy[900], color: "#fff", border: "none", borderRadius: 6, padding: "13px 16px", fontSize: 17, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", opacity: busy ? 0.7 : 1, fontFamily: "inherit" }}
          >
            {busy && <Loader2 size={14} className="spin" />}
            {mode === "signin" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Create password & continue"}
          </button>
        </form>

        {mode === "forgot" ? (
          <button
            onClick={() => { setMode("signin"); setError(""); setNotice(""); }}
            style={{ display: "block", width: "100%", textAlign: "center", background: "none", border: "none", color: navy[700], fontSize: 16, marginTop: 20, fontFamily: "inherit" }}
          >
            Back to sign in
          </button>
        ) : (
          <button
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setNotice(""); }}
            style={{ display: "block", width: "100%", textAlign: "center", background: "none", border: "none", color: navy[700], fontSize: 16, marginTop: 20, fontFamily: "inherit" }}
          >
            {mode === "signin" ? "Part of a team? Create your password" : "Already have a password? Sign in"}
          </button>
        )}
          </div>
        </div>
      </div>

      <style>{`
        .spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
        .nbd-auth-section { max-width: 1080px; margin: 0 auto; padding: 64px 24px 96px; }
        .nbd-auth-eyebrow { display: flex; align-items: center; gap: 14px; font-size: 13px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #a39a8d; margin-bottom: 40px; }
        .nbd-auth-eyebrow-rule { flex: 1; max-width: 48px; height: 1px; background: #d8d0c2; }
        .nbd-auth-grid { display: grid; grid-template-columns: minmax(260px, 380px) 1fr; gap: 64px; align-items: start; }
        .nbd-auth-aside { padding-top: 8px; }
        .nbd-auth-nudge { display: block; width: 100%; text-align: left; background: #fff; border: 1px solid #e4dfd6; border-radius: 10px; padding: 14px 16px; cursor: pointer; font-family: inherit; }
        .nbd-auth-card { background: #fff; border: 1px solid #e4dfd6; border-radius: 16px; padding: 36px; max-width: 420px; }
        @media (max-width: 860px) {
          .nbd-auth-grid { grid-template-columns: 1fr; gap: 36px; }
          .nbd-auth-card { max-width: 100%; }
        }
      `}</style>

      <PublicBrandStrip />
      <PublicFooter />
    </div>
  );
}
