import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { navy, cream, grey, AuthHero } from "../lib/ui.jsx";

export default function ApplyForAccess({ onSwitchToLogin }) {
  const [brands, setBrands] = useState(null);
  const [customerNumber, setCustomerNumber] = useState("");
  const [company, setCompany] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("brands").select("id,name,tagline").order("name").then(({ data }) => setBrands(data || []));
  }, []);

  function toggleBrand(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function submit(e) {
    e.preventDefault();
    if (!customerNumber.trim() || !company.trim() || !firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setError("Fill in every field first.");
      return;
    }
    if (selected.size === 0) {
      setError("Select at least one brand you stock.");
      return;
    }
    setBusy(true);
    setError("");

    const { error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password });
    if (signUpError) {
      setBusy(false);
      setError(signUpError.message);
      return;
    }

    const { error: rpcError } = await supabase.rpc("submit_account_application", {
      p_customer_number: customerNumber.trim(),
      p_company_name: company.trim(),
      p_main_contact_name: `${firstName.trim()} ${lastName.trim()}`,
      p_requested_brand_ids: Array.from(selected),
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      await supabase.auth.signOut();
      return;
    }
    // App.jsx picks up the new session automatically and shows the
    // "pending approval" screen — nothing else to do here.
  }

  const labelStyle = { fontSize: 13, color: grey, display: "block", marginBottom: 4, fontWeight: 700 };
  const inputStyle = { width: "100%", padding: "11px 12px", border: "1px solid #d8d8d8", borderRadius: 6, marginBottom: 14, fontSize: 15, boxSizing: "border-box", fontFamily: "inherit" };

  return (
    <div style={{ fontFamily: "'Lato', -apple-system, sans-serif", background: cream, minHeight: "100vh" }}>
      <AuthHero
        eyebrow="National Beauty Distribution"
        headline="Education Portal"
        subtitle="Training, certification and brand education for our stockists"
      />

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "48px 20px 80px" }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: navy[900], margin: "0 0 4px", textAlign: "center" }}>Request training access</h2>
        <p style={{ color: grey, fontSize: 14, margin: "0 0 28px", textAlign: "center" }}>
          Tell us about your salon — we'll set up access to the brands you stock once approved.
        </p>

        <form onSubmit={submit}>
          <label style={labelStyle}>NBD customer number</label>
          <input value={customerNumber} onChange={(e) => setCustomerNumber(e.target.value)} placeholder="e.g. CU-1001" style={inputStyle} />

          <label style={labelStyle}>Salon / business name</label>
          <input value={company} onChange={(e) => setCompany(e.target.value)} style={inputStyle} />

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>First name</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Last name</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <label style={labelStyle}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />

          <label style={labelStyle}>Choose a password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...inputStyle, marginBottom: 22 }} />

          <div style={{ fontSize: 13, color: grey, fontWeight: 700, marginBottom: 10 }}>Which brands do you stock?</div>
          {!brands && <div style={{ fontSize: 13, color: "#999", marginBottom: 18 }}>Loading brands…</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
            {(brands || []).map((b) => (
              <label key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e2e2e2", borderRadius: 8, padding: "11px 14px", cursor: "pointer" }}>
                <input type="checkbox" checked={selected.has(b.id)} onChange={() => toggleBrand(b.id)} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: navy[900] }}>{b.name}</div>
                  {b.tagline && <div style={{ fontSize: 12, color: "#999" }}>{b.tagline}</div>}
                </div>
              </label>
            ))}
          </div>

          {error && <div style={{ color: "#a3372f", fontSize: 13, marginBottom: 16 }}>{error}</div>}

          <button
            type="submit"
            disabled={busy}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: navy[700], color: "#fff", border: "none", borderRadius: 6, padding: "13px 16px", fontSize: 15, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", opacity: busy ? 0.7 : 1, fontFamily: "inherit" }}
          >
            {busy && <Loader2 size={14} className="spin" />}
            Submit request
          </button>
        </form>

        <button
          onClick={onSwitchToLogin}
          style={{ display: "block", width: "100%", textAlign: "center", background: "none", border: "none", color: navy[700], fontSize: 14, marginTop: 20, fontFamily: "inherit" }}
        >
          Already have an account? Sign in
        </button>
      </div>

      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
