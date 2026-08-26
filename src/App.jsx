import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";
import { navy, cream, Logo, WORDMARK_SRC } from "./lib/ui.jsx";
import Login from "./components/Login.jsx";
import ApplyForAccess from "./components/ApplyForAccess.jsx";
import AdminApp from "./admin/AdminApp.jsx";
import CustomerApp from "./customer/CustomerApp.jsx";

function Shell({ children, onSignOut, roleLabel }) {
  return (
    <div style={{ fontFamily: "'Lato', -apple-system, sans-serif", background: cream, minHeight: 600, padding: 24 }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Logo size={44} />
            <div style={{ width: 1, height: 32, background: "#e4dfd6" }} />
            <div>
              <div style={{ fontSize: 13, color: "#a39a8d", letterSpacing: 1, textTransform: "uppercase" }}>{roleLabel}</div>
              <img src={WORDMARK_SRC} alt="National Beauty Distribution Ireland" style={{ height: 22, marginTop: 4 }} />
            </div>
          </div>
          {onSignOut && (
            <button onClick={onSignOut} style={{ background: "none", border: "1px solid #e4dfd6", borderRadius: 999, padding: "7px 16px", fontSize: 15, color: "#6b6155" }}>
              Sign out
            </button>
          )}
        </div>
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

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = not checked yet, null = signed out
  const [identity, setIdentity] = useState(null); // { kind, admin } | { kind, user, account } | { kind: "unrecognized" }
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const [authScreen, setAuthScreen] = useState("apply"); // "login" | "apply" — new customers land here first; staff/admin sign in via the link on that screen

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setIdentity(null); return; }
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
  }, [session]);

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (session === undefined) return <CenteredLoader label="Loading…" />;
  if (!session) {
    return authScreen === "apply"
      ? <ApplyForAccess onSwitchToLogin={() => setAuthScreen("login")} />
      : <Login onSwitchToApply={() => setAuthScreen("apply")} />;
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
      <Shell onSignOut={signOut} roleLabel="Education platform · admin">
        <AdminApp />
      </Shell>
    );
  }

  if (identity.kind === "customer" || identity.kind === "pending") {
    return (
      <Shell onSignOut={signOut} roleLabel={`Education platform · ${identity.account.company_name}`}>
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
