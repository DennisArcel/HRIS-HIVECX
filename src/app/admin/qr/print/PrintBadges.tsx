"use client";
import { useRef } from "react";

type Badge = { id: string; name: string; svg: string };

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

// Standard ID card (CR80), portrait: 54mm x 85.6mm. 3 x 3 = 9 per page (fits A4 and Letter).
const CSS = `
@page { margin: 8mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #000; background: #fff; }
.page { width: 162mm; height: 256.8mm; margin: 0 auto; display: grid; grid-template-columns: repeat(3, 54mm); grid-template-rows: repeat(3, 85.6mm); break-after: page; page-break-after: always; }
.page:last-child { break-after: auto; page-break-after: auto; }
.badge { width: 54mm; height: 85.6mm; border: 0.2mm dashed #999; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4mm; text-align: center; overflow: hidden; }
.brand { font-size: 8pt; letter-spacing: .2em; font-weight: 700; margin-bottom: 4mm; }
.qr { width: 42mm; height: 42mm; background: #fff; }
.qr svg { width: 100%; height: 100%; display: block; }
.name { margin-top: 5mm; font-size: 11pt; font-weight: 700; line-height: 1.2; word-break: break-word; }
@media screen {
  body { background: #d9d9d9; padding: 8px 0; }
  .page { background: #fff; margin: 10px auto; padding: 0; }
}
`;

function buildHtml(badges: Badge[]) {
  const pages: Badge[][] = [];
  for (let i = 0; i < badges.length; i += 9) pages.push(badges.slice(i, i + 9));
  const body = pages
    .map(
      (p) =>
        `<div class="page">${p
          .map(
            (b) =>
              `<div class="badge"><div class="brand">HIVE HRIS</div><div class="qr">${b.svg}</div><div class="name">${esc(b.name)}</div></div>`,
          )
          .join("")}</div>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Hive HRIS QR badges</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

export function PrintBadges({ badges }: { badges: Badge[] }) {
  const frame = useRef<HTMLIFrameElement>(null);

  function print() {
    const w = frame.current?.contentWindow;
    if (!w) return;
    w.focus();
    w.print();
  }

  if (badges.length === 0) return <p className="mut">No employees found.</p>;

  return (
    <>
      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "0 0 12px" }}>
        <button type="button" className="btn" onClick={print}>Print / Save as PDF</button>
        <span className="mut">{badges.length} badge{badges.length === 1 ? "" : "s"} · {Math.ceil(badges.length / 9)} page{badges.length <= 9 ? "" : "s"}</span>
      </div>
      <iframe
        ref={frame}
        title="QR badge preview"
        srcDoc={buildHtml(badges)}
        style={{ width: "100%", height: "70vh", border: "1px solid #333", borderRadius: 8, background: "#d9d9d9" }}
      />
    </>
  );
}
