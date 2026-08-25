import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { navy, Logo } from "../lib/ui.jsx";

export default function Login({ onSwitchToApply }) {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
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
    <div style={{ maxWidth: 380, margin: "80px auto", padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
        <Logo size={48} />
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: navy[900], margin: "0 0 4px", textAlign: "center" }}>
        {mode === "signin" ? "Sign in" : "Create your password"}
      </h2>
      <p style={{ color: "#8a8074", fontSize: 13, margin: "0 0 24px", textAlign: "center" }}>
        {mode === "signin"
          ? "For approved account holders, staff, and admins."
          : "First time here? Use the email your admin set up for you and choose a password."}
      </p>

      <form onSubmit={submit}>
        <label style={{ fontSize: 13, color: "#6b6155", display: "block", marginBottom: 4 }}>Email</label>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: "9px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 12, fontSize: 14, boxSizing: "border-box" }}
        />
        <label style={{ fontSize: 13, color: "#6b6155", display: "block", marginBottom: 4 }}>Password</label>
        <input
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: "9px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 18, fontSize: 14, boxSizing: "border-box" }}
        />

        {error && <div style={{ color: "#a3372f", fontSize: 13, marginBottom: 14 }}>{error}</div>}
        {notice && <div style={{ color: "#4d6b2c", fontSize: 13, marginBottom: 14 }}>{notice}</div>}

        <button
          type="submit"
          disabled={busy}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: navy[700], color: "#fff", border: "none", borderRadius: 8, padding: "11px 16px", fontSize: 14, fontWeight: 500, opacity: busy ? 0.7 : 1 }}
        >
          {busy && <Loader2 size={14} className="spin" />}
          {mode === "signin" ? "Sign in" : "Create password & continue"}
        </button>
      </form>

      <button
        onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setNotice(""); }}
        style={{ display: "block", width: "100%", textAlign: "center", background: "none", border: "none", color: navy[700], fontSize: 13, marginTop: 16 }}
      >
        {mode === "signin" ? "First time signing in? Create your password" : "Already have a password? Sign in"}
      </button>

      {mode === "signin" && (
        <button
          onClick={onSwitchToApply}
          style={{ display: "block", width: "100%", textAlign: "center", background: "none", border: "none", color: "#8a8074", fontSize: 13, marginTop: 10 }}
        >
          New customer? Request training access
        </button>
      )}

      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
