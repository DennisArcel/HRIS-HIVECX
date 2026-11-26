"use client";
import { useEffect } from "react";
import { Modal } from "./ui";
import { fmtDate } from "@/lib/fmt";
import { PHP, computePay, isIC, type Adj } from "@/lib/payroll-calc";

export type SlipData = {
  name: string;
  code: string;
  position: string | null;
  department: string | null;
  salary: number;
  workerType: string;
  adj: Adj;
  otHours: number;
};

export function Payslip({
  r,
  period,
  onClose,
  autoPrint,
}: {
  r: SlipData;
  period: { label: string; to: string };
  onClose: () => void;
  autoPrint?: boolean;
}) {
  const w = { salary_semi: r.salary, worker_type: r.workerType };
  const x = computePay(w, r.adj, r.otHours);
  useEffect(() => {
    if (!autoPrint) return;
    const t = setTimeout(() => window.print(), 250);
    return () => clearTimeout(t);
  }, [autoPrint]);

  const crow = (k: "sss" | "ph" | "pg", label: string) => {
    const nd = x[k] <= 0;
    return (
      <>
        <div className="k" style={nd ? { opacity: 0.55 } : undefined}>
          {label}
          {nd && <> <span className="tag">Not deducted</span></>}
        </div>
        <div className="v" style={nd ? { opacity: 0.55 } : undefined}>−{PHP(x[k])}</div>
      </>
    );
  };

  return (
    <Modal>
      <div className="slipdoc print-area">
        <div className="sphd">
          <div>
            <div className="fig">PAYSLIP</div>
            <h3 style={{ marginTop: 6 }}>{r.name}</h3>
            <div className="mut" style={{ fontSize: 13 }}>
              {r.code} · {r.position} · {r.department}
              {isIC(w) ? " · Independent contractor" : ""}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <b>{period.label}</b>
            <div className="mut" style={{ fontSize: 12.5 }}>Pay date: {fmtDate(period.to)}</div>
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
          {crow("sss", "SSS contribution (5%)")}
          {crow("ph", "PhilHealth contribution (2.5%)")}
          {crow("pg", "Pag-IBIG contribution (2%)")}
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
          <button onClick={() => window.print()}>Print / Save as PDF</button>
        </div>
      </div>
    </Modal>
  );
}