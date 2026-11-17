import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { navy, cream, grey, AuthHero, PasswordField, validatePassword } from "../lib/ui.jsx";

export default function ApplyForAccess({ onSwitchToLogin, onSwitchToTeam }) {
  const [brands, setBrands] = useState(null);
  const [customerNumber, setCustomerNumber] = useState("");
  const [company, setCompany] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
    const passwordError = validatePassword(password);
    if (passwordError) { setError(passwordError); return; }
    if (password !== confirmPassword) { setError("Those passwords don't match."); return; }
    if (selected.size === 0) {
      setError("Select at least one brand you stock.");
      return;
    }
    setBusy(true);
    setError("");

    // Check this before creating the login — otherwise a taken customer
    // number fails the application step after the login already exists,
    // which permanently blocks that email from signing up again.
    const { data: available, error: checkError } = await supabase.rpc("check_customer_number_available", {
      p_customer_number: customerNumber.trim(),
    });
    if (checkError) {
      setBusy(false);
      setError(checkError.message);
      return;
    }
    if (!available) {
      setBusy(false);
      setError("That customer number is already registered — contact NBD if this is a mistake.");
      return;
    }

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

  const labelStyle = { fontSize: 15, color: grey, display: "block", marginBottom: 4, fontWeight: 700 };
  const Required = () => <span style={{ color: "#a3372f", fontWeight: 400 }}> (required)</span>;
  const inputStyle = { width: "100%", padding: "11px 12px", border: "1px solid #d8d8d8", borderRadius: 6, marginBottom: 14, fontSize: 17, boxSizing: "border-box", fontFamily: "inherit" };

  const groupLabelStyle = { fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#a39a8d", marginBottom: 16 };

  return (
    <div style={{ fontFamily: "'Lato', -apple-system, sans-serif", background: cream, minHeight: "100vh" }}>
      <AuthHero />

      <div className="nbd-auth-section">
        <div className="nbd-auth-eyebrow">
          <span className="nbd-auth-eyebrow-rule" />
          GET STARTED
        </div>

        <div className="nbd-auth-grid">
          <div className="nbd-auth-aside">
            <h2 style={{ fontSize: 28, fontWeight: 300, color: navy[900], margin: "0 0 14px", lineHeight: 1.15 }}>Request training access</h2>
            <p style={{ color: grey, fontSize: 16, margin: "0 0 24px", lineHeight: 1.6, maxWidth: 360 }}>
              Tell us about your salon and the brands you stock. We'll set up your access once approved.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: 12 }}>
              {["Reviewed within 1–2 business days", "Access tailored to the brands you stock", "You'll get an email as soon as you're set up"].map((line) => (
                <li key={line} style={{ display: "flex", gap: 10, fontSize: 14, color: grey, lineHeight: 1.5 }}>
                  <span style={{ color: navy[900], fontWeight: 700 }}>—</span> {line}
                </li>
              ))}
            </ul>

            <button onClick={onSwitchToTeam} className="nbd-auth-nudge">
              <div style={{ fontSize: 15, fontWeight: 700, color: navy[900] }}>Logging in as part of a team?</div>
              <div style={{ fontSize: 14, color: grey, marginTop: 2 }}>If your account manager already added you, create your password here →</div>
            </button>
          </div>

          <div className="nbd-auth-card" style={{ maxWidth: 520 }}>
            <form onSubmit={submit}>
              <div style={groupLabelStyle}>Your salon</div>
              <label style={labelStyle}>NBD customer number<Required /></label>
              <input required value={customerNumber} onChange={(e) => setCustomerNumber(e.target.value)} placeholder="e.g. CU-1001" style={inputStyle} />

              <label style={labelStyle}>Salon / business name<Required /></label>
              <input required value={company} onChange={(e) => setCompany(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />

              <div className="nbd-auth-divider" />

              <div style={groupLabelStyle}>Your details</div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>First name<Required /></label>
                  <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Last name<Required /></label>
                  <input required value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <label style={labelStyle}>Email<Required /></label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />

              <label style={labelStyle}>Choose a password<Required /></label>
              <div style={{ marginBottom: 6 }}>
                <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              </div>
              <p style={{ fontSize: 13, color: "#999", margin: "0 0 14px" }}>At least 8 characters, with an uppercase letter, a lowercase letter, and a number.</p>

              <label style={labelStyle}>Confirm password<Required /></label>
              <div style={{ marginBottom: 0 }}>
                <PasswordField value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
              </div>

              <div className="nbd-auth-divider" />

              <div style={{ ...groupLabelStyle, marginBottom: 10 }}>Brands you stock<Required /></div>
              {!brands && <div style={{ fontSize: 15, color: "#999", marginBottom: 18 }}>Loading brands…</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
                {(brands || []).map((b) => (
                  <label key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, background: cream, border: "1px solid #e2e2e2", borderRadius: 8, padding: "11px 14px", cursor: "pointer" }}>
                    <input type="checkbox" checked={selected.has(b.id)} onChange={() => toggleBrand(b.id)} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: navy[900] }}>{b.name}</div>
                      {b.tagline && <div style={{ fontSize: 14, color: "#999" }}>{b.tagline}</div>}
                    </div>
                  </label>
                ))}
              </div>

              {error && <div style={{ color: "#a3372f", fontSize: 15, marginBottom: 16 }}>{error}</div>}

              <button
                type="submit"
                disabled={busy}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: navy[900], color: "#fff", border: "none", borderRadius: 6, padding: "13px 16px", fontSize: 17, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", opacity: busy ? 0.7 : 1, fontFamily: "inherit" }}
              >
                {busy && <Loader2 size={14} className="spin" />}
                Submit request
              </button>
            </form>

            <button
              onClick={onSwitchToLogin}
              style={{ display: "block", width: "100%", textAlign: "center", background: "none", border: "none", color: navy[700], fontSize: 16, marginTop: 20, fontFamily: "inherit" }}
            >
              Already have an account? Sign in
            </button>
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
        .nbd-auth-card { background: #fff; border: 1px solid #e4dfd6; border-radius: 16px; padding: 36px; }
        .nbd-auth-divider { height: 1px; background: #ece6da; margin: 28px 0 24px; }
        @media (max-width: 860px) {
          .nbd-auth-grid { grid-template-columns: 1fr; gap: 36px; }
          .nbd-auth-card { max-width: 100% !important; }
        }
      `}</style>
    </div>
  );
}
