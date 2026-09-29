import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Download, Award, Upload } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { navy } from "../lib/ui.jsx";

// Record of every certificate the platform has issued. Admins have full RLS
// access to `certificates` and to the `certificates` storage bucket, so both
// reading the list and manually attaching a PDF are plain Supabase calls —
// no RPC, no migration.

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" });
}

function toCsv(rows) {
  const head = ["Learner", "Email", "Salon", "Customer number", "Brand", "Date issued"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) => [r.learner, r.email, r.salon, r.customerNumber, r.brand, fmtDate(r.issuedAt)].map(esc).join(","));
  return [head.map(esc).join(","), ...lines].join("\r\n");
}

export default function CertificatesTab() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from("certificates")
        .select("id, user_id, brand_id, issued_at, pdf_path, brands(name), app_users(name, email, accounts(company_name, customer_number))")
        .order("issued_at", { ascending: false });
      if (cancelled) return;
      if (err) { setError(err.message); setRows([]); return; }
      setRows((data || []).map((c) => ({
        id: c.id,
        userId: c.user_id,
        brandId: c.brand_id,
        issuedAt: c.issued_at,
        pdfPath: c.pdf_path || null,
        learner: c.app_users?.name || "—",
        email: c.app_users?.email || "",
        salon: c.app_users?.accounts?.company_name || "—",
        customerNumber: c.app_users?.accounts?.customer_number || "",
        brand: c.brands?.name || "—",
      })));
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.learner, r.email, r.salon, r.customerNumber, r.brand].some((v) => v.toLowerCase().includes(q))
    );
  }, [rows, query]);

  const [opening, setOpening] = useState(null);
  async function openStoredPdf(row) {
    setOpening(row.id);
    const { data, error: err } = await supabase.storage
      .from("certificates")
      .createSignedUrl(row.pdfPath, 60);
    setOpening(null);
    if (err || !data?.signedUrl) { setError(err?.message || "Couldn't open that file"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  const [uploadingId, setUploadingId] = useState(null);
  async function uploadPdf(row, file) {
    if (!file) return;
    if (file.type !== "application/pdf") { setError("Please choose a PDF file."); return; }
    setUploadingId(row.id);
    setError("");
    const path = `${row.userId}/${row.brandId}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("certificates")
      .upload(path, file, { contentType: "application/pdf", upsert: true });
    if (upErr) { setUploadingId(null); setError(upErr.message); return; }
    const { error: rowErr } = await supabase.from("certificates").update({ pdf_path: path }).eq("id", row.id);
    setUploadingId(null);
    if (rowErr) { setError(rowErr.message); return; }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, pdfPath: path } : r)));
  }

  function downloadCsv() {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nbd-certificates-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const th = { textAlign: "left", fontSize: 13, fontWeight: 700, color: "#8a8074", padding: "10px 12px", borderBottom: "1px solid #e4dfd6", whiteSpace: "nowrap" };
  const td = { fontSize: 14, color: navy[900], padding: "10px 12px", borderBottom: "1px solid #f0ece4" };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: navy[900], margin: "0 0 4px" }}>Certificates</h2>
      <p style={{ color: "#8a8074", fontSize: 14, margin: "0 0 18px" }}>
        Every certificate issued, newest first. A row is created automatically the moment a learner finishes a brand.
      </p>

      {rows === null && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8a8074", fontSize: 15 }}>
          <Loader2 size={16} className="spin" /> Loading…
        </div>
      )}
      {error && <div style={{ color: "#a3372f", fontSize: 14 }}>{error}</div>}

      {rows !== null && !error && (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
              <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#a39a8d" }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search learner, salon, brand…"
                style={{ width: "100%", padding: "8px 10px 8px 32px", border: "1px solid #ddd5cb", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
              />
            </div>
            <button className="nbd-btn nbd-btn--outline" onClick={downloadCsv} disabled={filtered.length === 0}>
              <Download size={14} /> Export CSV
            </button>
          </div>

          <div style={{ fontSize: 13, color: "#8a8074", marginBottom: 10 }}>
            {filtered.length} certificate{filtered.length === 1 ? "" : "s"}{query ? ` matching "${query}"` : ""}
          </div>

          {filtered.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#a39a8d", fontSize: 14, padding: "24px 0" }}>
              <Award size={16} /> {rows.length === 0 ? "No certificates issued yet." : "No matches."}
            </div>
          ) : (
            <div style={{ overflowX: "auto", border: "1px solid #e4dfd6", borderRadius: 10, background: "#fff" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>Learner</th>
                    <th style={th}>Salon</th>
                    <th style={th}>Brand</th>
                    <th style={th}>Date issued</th>
                    <th style={th}>Stored copy</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td style={td}>
                        <div style={{ fontWeight: 500 }}>{r.learner}</div>
                        {r.email && <div style={{ fontSize: 12.5, color: "#a39a8d" }}>{r.email}</div>}
                      </td>
                      <td style={td}>
                        {r.salon}
                        {r.customerNumber && <span style={{ color: "#a39a8d" }}> · {r.customerNumber}</span>}
                      </td>
                      <td style={td}>{r.brand}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(r.issuedAt)}</td>
                      <td style={td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          {r.pdfPath ? (
                            <button className="nbd-btn nbd-btn--outline nbd-btn--sm" onClick={() => openStoredPdf(r)} disabled={opening === r.id}>
                              <Download size={13} /> {opening === r.id ? "Opening…" : "PDF"}
                            </button>
                          ) : (
                            <span style={{ fontSize: 12.5, color: "#a39a8d" }}>Not stored</span>
                          )}
                          <label className="nbd-btn nbd-btn--outline nbd-btn--sm" title={r.pdfPath ? "Replace the stored PDF" : "Manually attach a PDF for this certificate"}>
                            {uploadingId === r.id ? <Loader2 size={13} className="spin" /> : <Upload size={13} />}
                            {uploadingId === r.id ? "Uploading…" : r.pdfPath ? "Replace" : "Add PDF"}
                            <input
                              type="file"
                              accept="application/pdf"
                              onChange={(e) => { uploadPdf(r, e.target.files?.[0]); e.target.value = ""; }}
                              disabled={uploadingId === r.id}
                              style={{ display: "none" }}
                            />
                          </label>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
