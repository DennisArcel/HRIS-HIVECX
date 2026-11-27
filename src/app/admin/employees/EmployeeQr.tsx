"use client";
import { useState, type CSSProperties } from "react";
import { regenerateQr } from "../qr/actions";

const overlay: CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "grid", placeItems: "center", zIndex: 50, padding: 16,
};
const primary: CSSProperties = {
  background: "var(--ac)", color: "#111", fontWeight: 600, padding: "10px 18px", borderRadius: 999, border: 0, cursor: "pointer",
};

/** Admin-only buttons: view an employee's badge QR, or replace it if the badge is lost. */
export function EmployeeQr({ id, name }: { id: string; name: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function load() {
    try {
      const r = await fetch(`/api/qr?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const j = (await r.json().catch(() => null)) as { svg?: string; error?: string } | null;
      if (!r.ok || !j?.svg) { setMsg(j?.error ? `Couldn't load QR: ${j.error}` : `Couldn't load QR (error ${r.status})`); return; }
      setSvg(j.svg);
    } catch {
      setMsg("Couldn't load QR");
    }
  }

  async function open() {
    setMsg("");
    await load();
  }

  async function renew() {
    setConfirming(false);
    setBusy(true);
    setMsg("");
    const res = await regenerateQr(id);
    if (!res.ok) {
      setMsg(res.error);
      setBusy(false);
      return;
    }
    await load();
    setBusy(false);
  }

  return (
    <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
      {msg && <span style={{ color: "var(--bad)", fontSize: 12.5 }}>{msg}</span>}
      <button type="button" className="btn" onClick={open}>View QR</button>
      <button type="button" className="btn" onClick={() => setConfirming(true)} disabled={busy}>
        {busy ? "Generating…" : "Generate new QR"}
      </button>

      {confirming && (
        <div style={overlay} onClick={() => setConfirming(false)}>
          <div
            className="card"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: 24, maxWidth: 380, width: "100%" }}
          >
            <div className="fig">REPLACE BADGE</div>
            <h3 style={{ margin: "6px 0 8px" }}>Generate a new QR for {name}?</h3>
            <p className="mut" style={{ margin: "0 0 18px", fontSize: 13.5 }}>
              Their old QR will stop working. Print a new badge and give it to them.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={() => setConfirming(false)}>Cancel</button>
              <button type="button" style={primary} onClick={renew}>Generate new QR</button>
            </div>
          </div>
        </div>
      )}

      {svg && (
        <div style={overlay} onClick={() => setSvg(null)}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ padding: 24, textAlign: "center" }}>
            <b>{name}</b>
            <div
              style={{ width: 260, margin: "12px auto", background: "#fff", padding: 8 }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <button type="button" className="btn" onClick={() => setSvg(null)}>Close</button>
          </div>
        </div>
      )}
    </span>
  );
}