"use client";
import { useEffect, useState, type CSSProperties } from "react";

const PREVIEW_ROWS = 4;
const PREVIEW_COLS = 4;
const MODAL_ROWS = 200;

/** Minimal CSV parser: handles quoted fields, escaped quotes ("") and CRLF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

const panel: CSSProperties = {
  background: "rgba(255,255,255,.03)",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 10,
  overflow: "hidden",
  margin: "4px 0 14px",
  minHeight: 148,
  position: "relative",
};
const cellStyle: CSSProperties = {
  padding: "6px 10px",
  fontSize: 11.5,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: 120,
  textAlign: "left",
  borderBottom: "1px solid rgba(255,255,255,.06)",
};
const headStyle: CSSProperties = {
  ...cellStyle,
  fontFamily: "ui-monospace,Menlo,monospace",
  fontSize: 10,
  letterSpacing: ".06em",
  textTransform: "uppercase",
  opacity: 0.6,
  background: "rgba(255,255,255,.04)",
};

const bigCell: CSSProperties = {
  ...cellStyle,
  padding: "12px 18px",
  fontSize: 14.5,
  maxWidth: "none",
  overflow: "visible",
  textOverflow: "clip",
};
const bigHead: CSSProperties = {
  ...headStyle,
  padding: "12px 18px",
  fontSize: 11.5,
  maxWidth: "none",
  overflow: "visible",
  textOverflow: "clip",
};

function MiniTable({
  data, cols, limit, large = false,
}: { data: string[][]; cols: number; limit: number; large?: boolean }) {
  const [head, ...body] = data;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "auto" }}>
      <thead>
        <tr>{head.slice(0, cols).map((h, i) => <th key={i} style={large ? bigHead : headStyle}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {body.slice(0, limit).map((r, i) => (
          <tr key={i}>
            {head.slice(0, cols).map((_, j) => <td key={j} style={large ? bigCell : cellStyle}>{r[j] ?? ""}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ReportPreview({ href, title }: { href: string; title: string }) {
  const [data, setData] = useState<string[][] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(href, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text(); })
      .then((t) => { if (!cancelled) setData(parseCsv(t)); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [href]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const count = data ? Math.max(0, data.length - 1) : 0;
  const extraCols = data && data[0] ? Math.max(0, data[0].length - PREVIEW_COLS) : 0;

  return (
    <>
      <div style={panel}>
        {failed && <p className="mut" style={{ fontSize: 12.5, padding: 14, margin: 0 }}>Couldn&apos;t load the preview.</p>}
        {!failed && !data && <p className="mut" style={{ fontSize: 12.5, padding: 14, margin: 0 }}>Loading preview…</p>}
        {data && count === 0 && <p className="mut" style={{ fontSize: 12.5, padding: 14, margin: 0 }}>No data yet.</p>}
        {data && count > 0 && (
          <>
            <MiniTable data={data} cols={PREVIEW_COLS} limit={PREVIEW_ROWS} />
            <div
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 10px", fontSize: 11.5,
              }}
            >
              <span className="mut">
                {count} row{count === 1 ? "" : "s"}{extraCols ? ` · +${extraCols} more column${extraCols === 1 ? "" : "s"}` : ""}
              </span>
              <button type="button" className="sm" onClick={() => setOpen(true)}>View all</button>
            </div>
          </>
        )}
      </div>

      {open && data && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", zIndex: 50,
            display: "grid", placeItems: "center", padding: 24,
          }}
        >
          <div
            className="card"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(1300px, 96vw)", maxHeight: "90vh", padding: 28,
              display: "flex", flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
              <div>
                <div className="fig">REPORT PREVIEW</div>
                <h2 style={{ margin: "6px 0 4px", fontSize: 26 }}>{title}</h2>
                <p className="mut" style={{ margin: "0 0 16px", fontSize: 13.5 }}>
                  {count} row{count === 1 ? "" : "s"} · {data[0].length} columns
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)}>Close</button>
            </div>
            <div
              style={{
                flex: 1, overflow: "auto", minHeight: 0,
                border: "1px solid rgba(255,255,255,.08)", borderRadius: 10,
              }}
            >
              <MiniTable data={data} cols={data[0].length} limit={MODAL_ROWS} large />
            </div>
            {count > MODAL_ROWS && (
              <p className="mut" style={{ fontSize: 12.5, marginBottom: 0 }}>
                Showing the first {MODAL_ROWS} of {count} rows. Export the CSV for the full list.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}