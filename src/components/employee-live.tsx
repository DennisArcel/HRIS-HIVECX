"use client";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { Icon } from "./Icon";

/** Live Manila clock. */
export function Clock() {
  const [now, setNow] = useState<string>("--:--:--");
  useEffect(() => {
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    const tick = () => setNow(f.format(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <div className="clock" aria-live="off">{now}</div>;
}

/** Rotating QR for HR to scan. The code is signed server-side by /api/qr; this only displays it. */
export function QrCard({ title, text }: { title: string; text: string }) {
  const [svg, setSvg] = useState("");
  const [pct, setPct] = useState(100);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true, started = Date.now(), ttl = 30, timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const r = await fetch("/api/qr", { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as { svg: string; ttl: number };
        if (!alive) return;
        setSvg(j.svg); setErr(false); started = Date.now(); ttl = j.ttl || 30;
        timer = setTimeout(load, Math.max(5, ttl - 5) * 1000);   // refresh a little before it expires
      } catch { if (alive) { setErr(true); timer = setTimeout(load, 8000); } }
    }
    load();
    const bar = setInterval(() => setPct(Math.max(0, 100 - ((Date.now() - started) / (ttl * 10)))), 500);
    return () => { alive = false; clearTimeout(timer); clearInterval(bar); };
  }, []);
  return (
    <div className="qrwrap">
      <div className="qrbox" role="img" aria-label="Your clock-in QR code"
        dangerouslySetInnerHTML={{ __html: svg || (err ? '<p style="color:#555;font-size:12px;margin:0">Could not load your code. Retrying…</p>' : "") }} />
      <div className="qrinfo">
        <div className="fig">{title}</div>
        <p>{text}</p>
        <div className="qrbar" aria-hidden="true"><i style={{ width: pct + "%" }} /></div>
        <p className="mut" style={{ fontSize: 12, margin: "8px 0 0" }}><Icon name="shield" /> Code refreshes automatically — screenshots won&apos;t work.</p>
      </div>
    </div>
  );
}

export type CalDay = {
  k: string; n: number; st: string; label: string; sub: string; today: boolean;
  rows: [string, string][]; fixes: { type: string; status: string; reason: string; remarks: string | null }[];
};
const LEGEND: [string, string][] = [
  ["var(--ok)", "On time"], ["var(--warn)", "Late"], ["var(--bad)", "Absent"], ["var(--mut)", "Rest day"],
  ["var(--info)", "Holiday"], ["var(--inc)", "Incomplete"], ["var(--leave)", "Approved leave"],
];

/** Month grid. Month navigation is a normal link (?m=YYYY-MM) so the server recomputes the month. */
export function AttendanceCalendar({ days, lead, prev, next, todayHref }: {
  days: CalDay[]; lead: number; prev: string | null; next: string | null; todayHref: string;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const cur = days.find((d) => d.k === sel);
  return (
    <>
      <div className="calnav" style={{ marginBottom: 10 }}>
        {prev ? <Link href={prev} aria-label="Previous month" className="ib"><Icon name="cl" /></Link> : <button disabled aria-label="Previous month"><Icon name="cl" /></button>}
        <Link href={todayHref} className="sm">Today</Link>
        {next ? <Link href={next} aria-label="Next month" className="ib"><Icon name="cr" /></Link> : <button disabled aria-label="Next month"><Icon name="cr" /></button>}
      </div>
      <div className="cal">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((x) => <div className="h" key={x}>{x}</div>)}
        {Array.from({ length: lead }).map((_, i) => <div className="h" key={"b" + i} />)}
        {days.map((d) => (
          <button key={d.k} type="button" aria-label={`${d.k} — ${d.label}`}
            className={["day", ["on", "late", "absent", "rest", "hol", "inc", "leave"].includes(d.st) ? d.st : "", d.st === "future" ? "future" : "", d.today ? "td" : "", sel === d.k ? "sel" : ""].filter(Boolean).join(" ")}
            onClick={() => setSel(d.k)}>
            {d.n}{d.sub ? <small>{d.sub}</small> : null}
          </button>
        ))}
      </div>
      <div className="leg">{LEGEND.map(([c, l]) => <span key={l}><i style={{ background: c }} />{l}</span>)}</div>
      {cur ? (
        <div className="card flat" style={{ marginTop: 14, padding: 18 }}>
          <div className="cardhd"><div><div className="fig">ATTENDANCE DETAIL</div><h3>{cur.k}</h3></div><button className="sm" onClick={() => setSel(null)}>Close</button></div>
          <div className="docgrid">{cur.rows.map(([k, v]) => (<Fragment key={k}><div className="k">{k}</div><div className="v">{v}</div></Fragment>))}</div>
          {cur.fixes.length > 0 && (
            <>
              <div className="fig" style={{ marginTop: 16 }}>CORRECTION REQUESTS</div>
              {cur.fixes.map((f, i) => (
                <div className="ls" key={i}><b>{f.type}</b> <span className="tag">{f.status}</span><br />
                  <span className="mut" style={{ fontSize: 12.5 }}>{f.reason}{f.remarks ? " · HR: " + f.remarks : ""}</span></div>
              ))}
            </>
          )}
          {cur.st === "inc" && <p className="mut" style={{ fontSize: 13, marginTop: 14 }}>This record is incomplete. Use the correction form below to ask HR to fix it.</p>}
        </div>
      ) : <p className="mut" style={{ fontSize: 12.5, margin: "12px 0 0" }}>Click any date to see the full record for that day.</p>}
    </>
  );
}

export function PrintButton() {
  return <button className="sm" onClick={() => window.print()}><Icon name="print" /> Print / Save as PDF</button>;
}
