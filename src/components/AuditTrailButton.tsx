"use client";
import { useEffect, useState } from "react";

export type AuditEntry = { action: string; detail: string; actor: string; at: string };

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", {
    timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit",
  });
const tone = (a: string) => (/rejected/i.test(a) ? "bad" : /approved|corrected/i.test(a) ? "ok" : "info");

export default function AuditTrailButton({ entries }: { entries: AuditEntry[] }) {
  const [open, setOpen] = useState(false);
  const [newest, setNewest] = useState(true);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const list = newest ? entries : [...entries].reverse();

  return (
    <>
      <button type="button" className="sm" onClick={() => setOpen(true)}>History</button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 100, display: "grid", placeItems: "center", padding: 16 }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Audit trail"
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(920px, 100%)", maxHeight: "86vh", display: "flex", flexDirection: "column", padding: 20 }}
          >
            <div className="cardhd">
              <div><div className="fig">AUDIT TRAIL</div><h3>Attendance history</h3></div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="sm" onClick={() => setNewest((v) => !v)}>
                  {newest ? "Newest first" : "Oldest first"}
                </button>
                <button type="button" className="sm" onClick={() => setOpen(false)}>Close</button>
              </div>
            </div>

            <p className="mut" style={{ fontSize: 12.5, margin: "0 0 10px" }}>
              A chronological record of who did what and when. Entries are read-only and cannot be edited or deleted.
            </p>

            <div className="wrap" style={{ overflow: "auto" }}>
              <table>
                <thead><tr>{["#", "Date & time (PH)", "Performed by", "Action", "Details"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {list.length === 0 && <tr><td className="mut" colSpan={5}>No changes recorded yet. Approvals and corrections appear here.</td></tr>}
                  {list.map((a, i) => (
                    <tr key={a.at + i}>
                      <td className="mut">{newest ? entries.length - i : i + 1}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{fmt(a.at)}</td>
                      <td>{a.actor}</td>
                      <td><span className={"tag " + tone(a.action)}>{a.action}</span></td>
                      <td className="mut">{a.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mut" style={{ fontSize: 12, margin: "10px 0 0" }}>Showing the latest {entries.length} attendance-related entries.</p>
          </div>
        </div>
      )}
    </>
  );
}