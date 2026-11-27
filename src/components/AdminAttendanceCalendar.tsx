"use client";
import Link from "next/link";
import { useState } from "react";

export type DayRow = { name: string; shift: string; tin: string | null; tout: string | null; label: string; cls: string };
export type DayFix = { name: string; type: string; requested: string | null; status: string; remarks: string | null };
export type DayData = {
  k: string;
  n: number;
  future: boolean;
  hol: string | null;
  counts: { on: number; late: number; absent: number; leave: number; inc: number; clocked: number };
  rows: DayRow[];
  fixes: DayFix[];
};

const LEGEND: [string, string][] = [
  ["var(--ok)", "All on time"], ["var(--warn)", "Has lates"], ["var(--bad)", "Has absences"], ["var(--mut)", "Rest day"],
  ["var(--info)", "Holiday"], ["var(--inc)", "Incomplete"], ["var(--leave)", "On leave"],
];
const Chev = ({ dir }: { dir: "l" | "r" }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points={dir === "l" ? "15 5 8 12 15 19" : "9 5 16 12 9 19"} />
  </svg>
);
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const longDate = (k: string) =>
  new Date(k + "T00:00:00").toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

const rank = (l: string) => (l === "Absent" ? 0 : l.startsWith("Late") ? 1 : l.startsWith("Incomplete") ? 2 : l === "Clocked in" ? 3 : l === "On time" ? 4 : 5);
const hours = (a: string | null, b: string | null) => {
  if (!a || !b) return null;
  const m = (t: string) => { const [h, x] = t.split(":").map(Number); return h * 60 + x; };
  const d = Math.max(0, m(b) - m(a));
  return `${Math.floor(d / 60)}h ${d % 60}m`;
};

/** Overall state of a day, used for the cell color (same classes as the employee calendar). */
function summarize(d: DayData) {
  const c = d.counts;
  const expected = c.on + c.late + c.absent + c.inc + c.clocked;
  const present = c.on + c.late + c.inc + c.clocked;
  let st = "rest";
  if (d.future) st = "future";
  else if (c.absent > 0) st = "absent";
  else if (c.late > 0) st = "late";
  else if (c.inc > 0) st = "inc";
  else if (c.on + c.clocked > 0) st = "on";
  else if (c.leave > 0) st = "leave";
  else if (d.hol) st = "hol";
  const sub = d.future ? "" : expected > 0 ? `${present}/${expected} in` : d.hol ? d.hol.split(" ")[0].slice(0, 9).toLowerCase() : st === "leave" ? "leave" : "rest";
  return { st, sub, expected, present };
}

export default function AdminAttendanceCalendar({
  days, lead, prev, next, todayHref, today, monthTitle,
}: {
  days: DayData[]; lead: number; prev: string | null; next: string | null; todayHref: string; today: string; monthTitle: string;
}) {
  const [sel, setSel] = useState<string | null>(days.find((d) => d.k === today)?.k ?? null);
  const cur = days.find((d) => d.k === sel) ?? null;

  return (
    <div className="card mt">
      <div className="calhd"><div><div className="fig">ATTENDANCE CALENDAR</div><h3>{monthTitle}</h3></div></div>

      <div className="calnav" style={{ marginBottom: 10 }}>
        {prev ? <Link href={prev} aria-label="Previous month" className="ib"><Chev dir="l" /></Link> : <button disabled aria-label="Previous month"><Chev dir="l" /></button>}
        <Link href={todayHref} className="sm">Today</Link>
        {next ? <Link href={next} aria-label="Next month" className="ib"><Chev dir="r" /></Link> : <button disabled aria-label="Next month"><Chev dir="r" /></button>}
      </div>

      <div className="cal">
        {WD.map((x) => <div className="h" key={x}>{x}</div>)}
        {Array.from({ length: lead }).map((_, i) => <div className="h" key={"b" + i} />)}
        {days.map((d) => {
          const { st, sub } = summarize(d);
          return (
            <button
              key={d.k}
              type="button"
              aria-label={`${d.k} — ${sub || st}`}
              className={["day", ["on", "late", "absent", "rest", "hol", "inc", "leave"].includes(st) ? st : "", st === "future" ? "future" : "", d.k === today ? "td" : "", sel === d.k ? "sel" : ""].filter(Boolean).join(" ")}
              onClick={() => setSel(d.k)}
            >
              {d.n}{sub ? <small>{sub}</small> : null}
            </button>
          );
        })}
      </div>
      <div className="leg">{LEGEND.map(([c, l]) => <span key={l}><i style={{ background: c }} />{l}</span>)}</div>

      {cur ? (
        <div className="card flat" style={{ marginTop: 14, padding: 18 }}>
          <div className="cardhd">
            <div><div className="fig">DAY SUMMARY</div><h3>{longDate(cur.k)}</h3></div>
            <button className="sm" onClick={() => setSel(null)}>Close</button>
          </div>

          {cur.hol && <span className="tag info" style={{ marginBottom: 10, display: "inline-block" }}>Holiday · {cur.hol}</span>}
          {cur.future ? (
            <p className="mut">This date hasn&apos;t happened yet.</p>
          ) : (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "4px 0 12px" }}>
                <span className="tag ok">{cur.counts.on + cur.counts.clocked} on time</span>
                <span className={"tag " + (cur.counts.late ? "wait" : "")}>{cur.counts.late} late</span>
                <span className={"tag " + (cur.counts.absent ? "bad" : "")}>{cur.counts.absent} absent</span>
                {cur.counts.leave > 0 && <span className="tag info">{cur.counts.leave} on leave</span>}
                {cur.counts.inc > 0 && <span className="tag wait">{cur.counts.inc} incomplete</span>}
              </div>
              <div className="wrap">
                <table>
                  <thead><tr>{["Employee", "In", "Out", "Hours", "Status"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {cur.rows.length === 0 && <tr><td className="mut" colSpan={5}>No employee records for this day.</td></tr>}
                    {[...cur.rows].sort((a, b) => rank(a.label) - rank(b.label)).map((r, i) => {
                      const fx = cur.fixes.find((f) => f.name === r.name);
                      return (
                        <tr key={i}>
                          <td>{r.name}</td>
                          <td>{r.tin ?? <span className="mut">—</span>}</td>
                          <td>{r.tout ?? <span className="mut">—</span>}</td>
                          <td>{hours(r.tin, r.tout) ?? <span className="mut">—</span>}</td>
                          <td>
                            <span className={"tag " + r.cls}>{r.label}</span>
                            {fx && <span className={"tag " + (fx.status === "Approved" ? "ok" : fx.status === "Rejected" ? "bad" : "wait")} style={{ marginLeft: 6 }}>Correction {fx.status.toLowerCase()}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ) : <p className="mut" style={{ fontSize: 12.5, margin: "12px 0 0" }}>Click any date to see what happened that day.</p>}
    </div>
  );
}