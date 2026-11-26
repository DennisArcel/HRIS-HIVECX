import type { ReactNode } from "react";

/* Small server-safe presentational helpers using the prototype class names from globals.css.
   If ui.tsx already has equivalents, swap them in. */
export function PageHead({ eyebrow, title, lead }: { eyebrow: string; title: ReactNode; lead: string }) {
  return (<><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="lead">{lead}</p></>);
}
export function tagClass(s: string) {
  return /Approved|Paid|Processed|On time|Qualified|Active|Regular/.test(s) ? "ok"
    : /Rejected|Absent|Voided|Urgent/.test(s) ? "bad"
    : /Pending|Upcoming|Draft/.test(s) ? "wait" : "";
}
export const Tag = ({ s }: { s: string }) => <span className={"tag " + tagClass(s)}>{s}</span>;
export const Stat = ({ f, t, v, sub }: { f: string; t: string; v: ReactNode; sub?: ReactNode }) => (
  <div className="card stat"><div className="fig">{f}</div><h3>{t}</h3><div className="big">{v}</div>{sub ? <small>{sub}</small> : null}</div>
);
export const Mini = ({ label, val, note }: { label: string; val: ReactNode; note?: string }) => (
  <div>
    <div className="fig">{label}</div>
    <div style={{ fontSize: 25, fontWeight: 600, letterSpacing: "-.03em", fontVariantNumeric: "tabular-nums", marginTop: 4 }}>{val}</div>
    {note ? <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 3 }}>{note}</div> : null}
  </div>
);
export function Table({ head, rows, empty }: { head: string[]; rows: ReactNode[][]; empty?: string }) {
  return (
    <div className="card flat wrap" style={{ padding: 8 }}>
      <table>
        <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.length ? rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)
            : <tr><td className="mut" colSpan={head.length}>{empty ?? "Nothing here yet."}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
export const Dash = () => <span className="mut">—</span>;
