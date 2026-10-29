import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";
import { navy, cream, grey, Logo, WORDMARK_SRC, PasswordField, validatePassword } from "./lib/ui.jsx";
import Login from "./components/Login.jsx";
import ApplyForAccess from "./components/ApplyForAccess.jsx";
import AdminApp from "./admin/AdminApp.jsx";
import CustomerApp from "./customer/CustomerApp.jsx";

// A quick way for admin to see exactly what a real customer sees — the
// fixed demo account has every brand unlocked, so this isn't tied to (or
// limited by) any specific real customer's actual access.
function ViewAsDropdown() {
  const [options, setOptions] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("app_users")
      .select("id,name,role,accounts!inner(is_demo)")
      .eq("accounts.is_demo", true)
      .eq("status", "active")
      .then(({ data }) => { if (!cancelled) setOptions(data || []); });
    return () => { cancelled = true; };
  }, []);

  async function choose(appUserId) {
    if (!appUserId) return;
    const { error } = await supabase.rpc("admin_set_view_as", { p_app_user_id: appUserId });
    if (!error) window.location.reload();
  }

  if (!options || options.length === 0) return null;

  return (
    <select
      defaultValue=""
      onChange={(e) => choose(e.target.value)}
      style={{ background: "#fff", border: `1px solid ${navy[300]}`, color: navy[900], borderRadius: 999, padding: "9px 16px", fontSize: 14, fontWeight: 600, fontFamily: "inherit" }}
    >
      <option value="" disabled>View as…</option>
      {options.map((u) => (
        <option key={u.id} value={u.id}>{u.role === "holder" ? "Account holder view" : "Staff view"}</option>
      ))}
    </select>
  );
}

function Shell({ children, onSignOut, roleLabel, showViewAs }) {
  return (
    <div style={{ fontFamily: "'Lato', -apple-system, sans-serif", background: cream, minHeight: "100vh" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e4dfd6" }}>
        <div className="nbd-shell-header" style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
            <Logo size={56} />
            <div>
              <img src={WORDMARK_SRC} alt="National Beauty Distribution Ireland" style={{ height: 80, display: "block", maxWidth: "100%" }} />
              <div style={{ fontSize: 13, color: grey, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginTop: 8 }}>{roleLabel}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {showViewAs && <ViewAsDropdown />}
            {onSignOut && (
              <button onClick={onSignOut} style={{ background: "none", border: `1px solid ${navy[700]}`, color: navy[700], borderRadius: 999, padding: "9px 20px", fontSize: 15, fontWeight: 700 }}>
                Sign out
              </button>
            )}
          </div>
        </div>
      </div>
      <style>{`
        .nbd-shell-body { max-width: 1100px; margin: 0 auto; padding: 32px; }
        @media (max-width: 760px) {
          .nbd-shell-body { padding: 16px; }
          .nbd-shell-header { padding: 16px !important; }
        }
      `}</style>
      <div className="nbd-shell-body">
        {children}
      </div>
    </div>
  );
}

function CenteredLoader({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, color: "#8a8074", fontSize: 16, gap: 8 }}>
      <Loader2 size={16} className="spin" /> {label}
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// Shown after a correct password when the account has 2FA enrolled and the
// current session hasn't cleared that second factor yet.
function MfaChallengeScreen({ onVerified, onSignOut }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!code.trim()) { setError("Enter the 6-digit code from your authenticator app."); return; }
    setBusy(true);
    setError("");
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) { setBusy(false); setError(listError.message); return; }
    const factor = factors.totp.find((f) => f.status === "verified");
    if (!factor) { setBusy(false); setError("No verified authenticator found."); return; }
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (challengeError) { setBusy(false); setError(challengeError.message); return; }
    const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code: code.trim() });
    setBusy(false);
    if (verifyError) { setError("That code didn't work — try again."); return; }
    onVerified();
  }

  return (
    <div style={{ fontFamily: "'Lato', -apple-system, sans-serif", background: cream, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <form onSubmit={submit} style={{ maxWidth: 360, width: "100%", padding: 20, textAlign: "center" }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: navy[900], margin: "0 0 6px" }}>Enter your 2FA code</h2>
        <p style={{ color: grey, fontSize: 15, margin: "0 0 22px" }}>Open your authenticator app and enter the 6-digit code.</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123456"
          autoFocus
          style={{ width: "100%", padding: "11px 12px", border: "1px solid #d8d8d8", borderRadius: 6, marginBottom: 14, fontSize: 20, textAlign: "center", letterSpacing: 4, boxSizing: "border-box" }}
        />
        {error && <div style={{ color: "#a3372f", fontSize: 14, marginBottom: 14 }}>{error}</div>}
        <button type="submit" disabled={busy} style={{ width: "100%", background: navy[700], color: "#fff", border: "none", borderRadius: 6, padding: "13px 16px", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
          {busy ? "Checking…" : "Verify"}
        </button>
        <button type="button" onClick={onSignOut} style={{ background: "none", border: "none", color: grey, fontSize: 14 }}>
          Sign out
        </button>
      </form>
    </div>
  );
}

// Shown when the session came from a "reset your password" email link, in
// place of the normal app — they're technically signed in at this point,
// but still need to actually set the new password before going anywhere.
function ResetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    const passwordError = validatePassword(password);
    if (passwordError) { setError(passwordError); return; }
    if (password !== confirm) { setError("Those passwords don't match."); return; }
    setBusy(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) { setError(updateError.message); return; }
    onDone();
  }

  return (
    <div style={{ fontFamily: "'Lato', -apple-system, sans-serif", background: cream, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <form onSubmit={submit} style={{ maxWidth: 380, width: "100%", padding: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: navy[900], margin: "0 0 6px", textAlign: "center" }}>Set a new password</h2>
        <p style={{ color: grey, fontSize: 15, margin: "0 0 22px", textAlign: "center" }}>Choose a new password for your account.</p>
        <label style={{ fontSize: 15, color: grey, display: "block", marginBottom: 4, fontWeight: 700 }}>
          New password<span style={{ color: "#a3372f", fontWeight: 400 }}> (required)</span>
        </label>
        <div style={{ marginBottom: 6 }}>
          <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </div>
        <p style={{ fontSize: 13, color: "#999", margin: "0 0 14px" }}>At least 8 characters, with an uppercase letter, a lowercase letter, and a number.</p>
        <label style={{ fontSize: 15, color: grey, display: "block", marginBottom: 4, fontWeight: 700 }}>
          Confirm password<span style={{ color: "#a3372f", fontWeight: 400 }}> (required)</span>
        </label>
        <div style={{ marginBottom: 20 }}>
          <PasswordField value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </div>
        {error && <div style={{ color: "#a3372f", fontSize: 15, marginBottom: 16 }}>{error}</div>}
        <button type="submit" disabled={busy} style={{ width: "100%", background: navy[700], color: "#fff", border: "none", borderRadius: 6, padding: "13px 16px", fontSize: 16, fontWeight: 700 }}>
          {busy ? "Saving…" : "Save password"}
        </button>
      </form>
    </div>
  );
}

// Catches any render error anywhere in the app and shows a plain "reload"
// screen instead of a blank white page — without this, one unexpected
// error in any component takes down the whole site for that customer.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error("Unhandled app error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ fontFamily: "'Lato', -apple-system, sans-serif", background: cream, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ maxWidth: 420, textAlign: "center" }}>
            <Logo size={48} />
            <h2 style={{ fontSize: 22, fontWeight: 700, color: navy[900], margin: "18px 0 8px" }}>Something went wrong</h2>
            <p style={{ color: grey, fontSize: 16, lineHeight: 1.6, margin: "0 0 20px" }}>
              This page hit an unexpected error. Reloading usually fixes it — if it keeps happening, let NBD know what you were doing when it occurred.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{ background: navy[700], color: "#fff", border: "none", borderRadius: 999, padding: "10px 24px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppInner() {
  const [session, setSession] = useState(undefined); // undefined = not checked yet, null = signed out
  const [identity, setIdentity] = useState(null); // { kind, admin } | { kind, user, account } | { kind: "unrecognized" }
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const [authScreen, setAuthScreen] = useState("apply"); // "login" | "apply" | "team" — new customers land here first; staff/admin sign in via the link on that screen, "team" is a shortcut straight into password creation
  const [mfaNeeded, setMfaNeeded] = useState(false);
  const [mfaChecked, setMfaChecked] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setMfaChecked(false); setMfaNeeded(false); return; }
    let cancelled = false;
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (cancelled) return;
      setMfaNeeded(!!data && data.nextLevel === "aal2" && data.currentLevel !== "aal2");
      setMfaChecked(true);
    });
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    if (!session || mfaNeeded) { setIdentity(null); return; }
    if (!mfaChecked) return;
    let cancelled = false;
    setResolving(true);
    setResolveError("");
    supabase.rpc("resolve_login").then(({ data, error }) => {
      if (cancelled) return;
      setResolving(false);
      if (error) { setResolveError(error.message); return; }
      setIdentity(data);
    });
    return () => { cancelled = true; };
  }, [session, mfaNeeded, mfaChecked]);

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (session === undefined) return <CenteredLoader label="Loading…" />;
  if (passwordRecovery) {
    return <ResetPasswordScreen onDone={() => setPasswordRecovery(false)} />;
  }
  if (!session) {
    if (authScreen === "apply") {
      return <ApplyForAccess onSwitchToLogin={() => setAuthScreen("login")} onSwitchToTeam={() => setAuthScreen("team")} />;
    }
    return (
      <Login
        onSwitchToApply={() => setAuthScreen("apply")}
        initialMode={authScreen === "team" ? "signup" : "signin"}
      />
    );
  }
  if (!mfaChecked) return <CenteredLoader label="Checking your account…" />;
  if (mfaNeeded) {
    return <MfaChallengeScreen onVerified={() => setMfaNeeded(false)} onSignOut={signOut} />;
  }
  if (resolving || identity === null) return <CenteredLoader label="Checking your account…" />;
  if (resolveError) {
    return (
      <div style={{ maxWidth: 420, margin: "80px auto", textAlign: "center", color: "#a3372f", fontSize: 16 }}>
        Couldn't check your account: {resolveError}
      </div>
    );
  }

  if (identity.kind === "admin") {
    return (
      <Shell onSignOut={signOut} roleLabel="Education platform · admin" showViewAs>
        <AdminApp />
      </Shell>
    );
  }

  if (identity.kind === "staff_pending") {
    return (
      <Shell onSignOut={signOut} roleLabel={`Education platform · ${identity.account.company_name}`}>
        <div style={{ maxWidth: 420, margin: "60px auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: navy[900], margin: "0 0 8px" }}>Waiting on approval</h2>
          <p style={{ color: "#8a8074", fontSize: 16, lineHeight: 1.6 }}>
            Your account's been created, but NBD still needs to approve you before you can get in. This usually doesn't take long — check back shortly.
          </p>
        </div>
      </Shell>
    );
  }

  if (identity.kind === "customer" || identity.kind === "pending") {
    return (
      <Shell onSignOut={signOut} roleLabel={`Education platform · ${identity.account.company_name}`}>
        {identity.admin_testing && (
          <div style={{ background: "#fdf6e3", border: "1px solid #eddfad", color: "#8a6d1f", fontSize: 15, padding: "12px 16px", borderRadius: 8, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span>
              <strong>Admin test mode</strong> — you're viewing everything as {identity.user.name} ({identity.account.company_name}). Anything you do here (watching videos, taking quizzes, claiming certificates) is real and will show up on this customer's record.
            </span>
            <button
              onClick={async () => {
                await supabase.rpc("admin_set_view_as", { p_app_user_id: null });
                const { data } = await supabase.rpc("resolve_login");
                setIdentity(data);
              }}
              style={{ background: "#8a6d1f", color: "#fff", border: "none", borderRadius: 999, padding: "8px 16px", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}
            >
              Exit test mode
            </button>
          </div>
        )}
        <CustomerApp user={identity.user} account={identity.account} />
      </Shell>
    );
  }

  return (
    <Shell onSignOut={signOut} roleLabel="Education platform">
      <div style={{ maxWidth: 420, margin: "60px auto", textAlign: "center" }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: navy[900], margin: "0 0 8px" }}>This login isn't set up yet</h2>
        <p style={{ color: "#8a8074", fontSize: 16, lineHeight: 1.6 }}>
          {session.user.email} doesn't match any admin or account on this platform. If this is a mistake, contact your NBD admin.
        </p>
      </div>
    </Shell>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
