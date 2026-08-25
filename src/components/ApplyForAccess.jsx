import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { navy, Logo } from "../lib/ui.jsx";

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

  return (
    <div style={{ maxWidth: 440, margin: "60px auto", padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
        <Logo size={48} />
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: navy[900], margin: "0 0 4px", textAlign: "center" }}>Request training access</h2>
      <p style={{ color: "#8a8074", fontSize: 13, margin: "0 0 24px", textAlign: "center" }}>
        Tell us about your salon — we'll set up access to the brands you stock once approved.
      </p>

      <form onSubmit={submit}>
        <label style={{ fontSize: 13, color: "#6b6155", display: "block", marginBottom: 4 }}>NBD customer number</label>
        <input value={customerNumber} onChange={(e) => setCustomerNumber(e.target.value)} placeholder="e.g. CU-1001" style={{ width: "100%", padding: "9px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 12, fontSize: 14, boxSizing: "border-box" }} />

        <label style={{ fontSize: 13, color: "#6b6155", display: "block", marginBottom: 4 }}>Salon / business name</label>
        <input value={company} onChange={(e) => setCompany(e.target.value)} style={{ width: "100%", padding: "9px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 12, fontSize: 14, boxSizing: "border-box" }} />

        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13, color: "#6b6155", display: "block", marginBottom: 4 }}>First name</label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={{ width: "100%", padding: "9px 10px", border: "1px solid #ddd5cb", borderRadius: 6, fontSize: 14, boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13, color: "#6b6155", display: "block", marginBottom: 4 }}>Last name</label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} style={{ width: "100%", padding: "9px 10px", border: "1px solid #ddd5cb", borderRadius: 6, fontSize: 14, boxSizing: "border-box" }} />
          </div>
        </div>

        <label style={{ fontSize: 13, color: "#6b6155", display: "block", marginBottom: 4 }}>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", padding: "9px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 12, fontSize: 14, boxSizing: "border-box" }} />

        <label style={{ fontSize: 13, color: "#6b6155", display: "block", marginBottom: 4 }}>Choose a password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%", padding: "9px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 18, fontSize: 14, boxSizing: "border-box" }} />

        <div style={{ fontSize: 13, color: "#6b6155", marginBottom: 8 }}>Which brands do you stock?</div>
        {!brands && <div style={{ fontSize: 13, color: "#a39a8d", marginBottom: 18 }}>Loading brands…</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
          {(brands || []).map((b) => (
            <label key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e4dfd6", borderRadius: 8, padding: "10px 12px", cursor: "pointer" }}>
              <input type="checkbox" checked={selected.has(b.id)} onChange={() => toggleBrand(b.id)} />
              <div>
                <div style={{ fontWeight: 500, fontSize: 14, color: navy[900] }}>{b.name}</div>
                {b.tagline && <div style={{ fontSize: 12, color: "#8a8074" }}>{b.tagline}</div>}
              </div>
            </label>
          ))}
        </div>

        {error && <div style={{ color: "#a3372f", fontSize: 13, marginBottom: 14 }}>{error}</div>}

        <button
          type="submit"
          disabled={busy}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: navy[700], color: "#fff", border: "none", borderRadius: 8, padding: "11px 16px", fontSize: 14, fontWeight: 500, opacity: busy ? 0.7 : 1 }}
        >
          {busy && <Loader2 size={14} className="spin" />}
          Submit request
        </button>
      </form>

      <button
        onClick={onSwitchToLogin}
        style={{ display: "block", width: "100%", textAlign: "center", background: "none", border: "none", color: navy[700], fontSize: 13, marginTop: 16 }}
      >
        Already approved? Sign in
      </button>

      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
