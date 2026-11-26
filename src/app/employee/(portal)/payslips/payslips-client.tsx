"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PHP, type computePay } from "@/lib/payroll-calc";
import { fmtDate } from "@/lib/fmt";

type Calc = ReturnType<typeof computePay>;

export type SlipRow = {
  from: string;
  to: string;
  label: string;
  status: string;
  released: boolean;
  calc: Calc | null;
};
export type SlipMe = {
  code: string;
  name: string;
  position: string | null;
  department: string | null;
  contractor: boolean;
};

const tagCls = (s: string) => (s === "Processed" ? "ok" : "wait");

export default function PayslipsClient({ rows, me }: { rows: SlipRow[]; me: SlipMe }) {
  const [open, setOpen] = useState<SlipRow | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // globals.css prints only #md while body.printing is set
  const printSlip = () => {
    document.body.classList.add("printing");
    const clean = () => {
      document.body.classList.remove("printing");
      window.removeEventListener("afterprint", clean);
    };
    window.addEventListener("afterprint", clean);
    setTimeout(() => {
      try { window.print(); } finally { setTimeout(clean, 1200); }
    }, 80);
  };

  return (
    <>
      <div className="card flat wrap" style={{ padding: 8 }}>
        <table>
          <thead>
            <tr>{["Pay period", "Gross pay", "Net pay", "Status", ""].map((h) => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td className="mut" colSpan={5}>No payslips yet.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.from}>
                <td>{r.label}</td>
                <td>{r.calc ? PHP(r.calc.g) : <span className="mut">—</span>}</td>
                <td>{r.calc ? <b>{PHP(r.calc.net)}</b> : <span className="mut">—</span>}</td>
                <td><span className={"tag " + tagCls(r.status)}>{r.status}</span></td>
                <td>
                  {r.released ? (
                    <>
                      <button className="sm" onClick={() => setOpen(r)}>View</button>{" "}
                      <button className="sm" onClick={() => { setOpen(r); setTimeout(printSlip, 80); }}>PDF</button>
                    </>
                  ) : (
                    <span className="mut">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mounted && open && open.calc &&
        createPortal(
          <div id="md">
            <div className="mb" onClick={() => setOpen(null)}>
              <div className="mc wide" role="dialog" aria-modal="true" aria-label="Payslip" onClick={(e) => e.stopPropagation()}>
                <Slip me={me} row={open} x={open.calc} onClose={() => setOpen(null)} onPrint={printSlip} />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function Slip({ me, row, x, onClose, onPrint }: { me: SlipMe; row: SlipRow; x: Calc; onClose: () => void; onPrint: () => void }) {
  const crow = (k: "sss" | "ph" | "pg", label: string) => {
    const nd = x[k] <= 0;
    const st = nd ? { opacity: 0.55 } : undefined;
    return (
      <>
        <div className="k" style={st}>{label}{nd && <> <span className="tag">Not deducted</span></>}</div>
        <div className="v" style={st}>−{PHP(x[k])}</div>
      </>
    );
  };

  return (
    <div className="slipdoc print-area">
      <div className="sphd">
        <div>
          <div className="fig">PAYSLIP</div>
          <h3 style={{ marginTop: 6 }}>{me.name}</h3>
          <div className="mut" style={{ fontSize: 13 }}>
            {me.code} · {me.position} · {me.department}{me.contractor ? " · Independent contractor" : ""}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <b>{row.label}</b>
          <div className="mut" style={{ fontSize: 12.5 }}>Pay date: {fmtDate(row.to)}</div>
        </div>
      </div>

      <div className="fig" style={{ marginTop: 14 }}>EARNINGS</div>
      <div className="docgrid">
        <div className="k">Basic pay (semi-monthly)</div><div className="v">{PHP(x.half)}</div>
        <div className="k">Allowances (transport &amp; COLA)</div><div className="v">{PHP(x.allow)}</div>
        <div className="k">Overtime ({x.otHrs} hrs × 125%)</div><div className="v">{PHP(x.ot)}</div>
        {x.extras.filter((z) => +z.amt > 0).map((z, i) => (
          <div key={i} style={{ display: "contents" }}>
            <div className="k">{z.label || "Additional pay"}</div><div className="v">{PHP(z.amt)}</div>
          </div>
        ))}
        <div className="k" style={{ fontWeight: 700, color: "var(--tx)" }}>Gross pay</div>
        <div className="v" style={{ fontWeight: 700 }}>{PHP(x.g)}</div>
      </div>

      <div className="fig" style={{ marginTop: 16 }}>DEDUCTIONS</div>
      <div className="docgrid">
        {crow("sss", "SSS contribution")}
        {crow("ph", "PhilHealth contribution")}
        {crow("pg", "Pag-IBIG contribution")}
        <div className="k">Taxable income (gross − allowances − contributions)</div><div className="v mut">{PHP(x.taxable)}</div>
        <div className="k">Withholding tax</div><div className="v">−{PHP(x.tx)}</div>
        <div className="k" style={{ fontWeight: 700, color: "var(--tx)" }}>Total deductions</div>
        <div className="v" style={{ fontWeight: 700 }}>−{PHP(x.ded)}</div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 18, paddingTop: 14, borderTop: "2px solid var(--ac)" }}>
        <div><div className="fig">NET PAY</div><div className="net">{PHP(x.net)}</div></div>
        <div className="mut" style={{ fontSize: 12, maxWidth: "38ch" }}>
          Withholding tax follows the BIR TRAIN semi-monthly table (nothing is withheld up to ₱10,417 taxable per cutoff). Allowances are treated as non-taxable de minimis benefits.
        </div>
      </div>

      <div className="mact no-print">
        <button onClick={onClose}>Close</button>
        <button onClick={onPrint}>Print / Save as PDF</button>
      </div>
    </div>
  );
}