"use client";
import { useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/ui";
import { fmtDate, initials } from "@/lib/fmt";
import { PHP, WHT_MONTHLY_FREE, computePay, contribFor, isIC, type Adj } from "@/lib/payroll-calc";
import { resetPayslip, savePayslip } from "./actions";

export type PRow = {
  id: string;
  code: string;
  name: string;
  position: string | null;
  department: string | null;
  salary: number;
  workerType: string;
  adj: Adj;
  otHours: number;
};
type Period = { from: string; to: string; label: string };
type Hol = { d: string; n: string };
type XD = { label: string; amt: string; hd?: string };

const num = (s: string) => Math.max(0, parseFloat(s) || 0);
const row = (r: PRow) => ({ salary_semi: r.salary, worker_type: r.workerType });

function Slip({ r, period, onClose, onEdit }: { r: PRow; period: Period; onClose: () => void; onEdit?: () => void }) {
  const x = computePay(row(r), r.adj, r.otHours);
  const crow = (k: "sss" | "ph" | "pg", label: string) => {
    const nd = x[k] <= 0;
    return (
      <>
        <div className="k" style={nd ? { opacity: 0.55 } : undefined}>{label}{nd && <> <span className="tag">Not deducted</span></>}</div>
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
              {r.code} · {r.position} · {r.department}{isIC(row(r)) ? " · Independent contractor" : ""}
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
            <div key={i} style={{ display: "contents" }}><div className="k">{z.label || "Additional pay"}</div><div className="v">{PHP(z.amt)}</div></div>
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
          {onEdit && <button className="pri" onClick={onEdit}>Edit payslip</button>}
          <span className="mut" style={{ fontSize: 12, alignSelf: "center" }}>HR preview{onEdit ? "" : " · locked (payroll processed)"}</span>
        </div>
      </div>
    </Modal>
  );
}

function EditSlip({ r, period, holidays, onClose }: { r: PRow; period: Period; holidays: Hol[]; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const def0 = contribFor(r.salary);
  const a = r.adj;
  const [sal, setSal] = useState(String(r.salary));
  const [on, setOn] = useState(a ? !!(a.sss?.on || a.ph?.on || a.pg?.on) : !isIC(row(r)));
  const [sss, setSss] = useState(String(a?.sss?.amt ?? def0.sss));
  const [ph, setPh] = useState(String(a?.ph?.amt ?? def0.ph));
  const [pg, setPg] = useState(String(a?.pg?.amt ?? def0.pg));
  const [extras, setExtras] = useState<XD[]>((a?.extras ?? []).map((x) => ({ label: x.label, amt: String(x.amt), hd: x.hd })));
  const [hol, setHol] = useState("");

  const draft = useMemo<Adj>(
    () => ({
      sss: { on, amt: num(sss) }, ph: { on, amt: num(ph) }, pg: { on, amt: num(pg) },
      extras: extras.map((x) => ({ label: x.label, amt: num(x.amt), hd: x.hd })),
    }),
    [on, sss, ph, pg, extras],
  );
  const x = computePay({ salary_semi: num(sal), worker_type: r.workerType }, draft, r.otHours);
  const free = holidays.filter((h) => !extras.some((e) => e.hd === h.d));

  function changeSalary(v: string) {
    setSal(v);
    const d = contribFor(num(v));
    setSss(String(d.sss)); setPh(String(d.ph)); setPg(String(d.pg));
  }
  const save = () =>
    start(async () => {
      const res = await savePayslip({
        employeeId: r.id, periodFrom: period.from, salary: num(sal),
        sss: draft!.sss!, ph: draft!.ph!, pg: draft!.pg!, extras: draft!.extras!,
      });
      if (res.error) setErr(res.error); else onClose();
    });
  const reset = () =>
    start(async () => {
      const res = await resetPayslip(r.id, period.from);
      if (res.error) setErr(res.error); else onClose();
    });
  const conRow = (name: string, v: string, set: (s: string) => void) => (
    <div className="pe-row">
      <span style={{ fontSize: 14 }}>{name}</span>
      <input type="number" min="0" step="0.01" value={v} disabled={!on} aria-label={`${name} amount`} onChange={(e) => set(e.target.value)} />
    </div>
  );
  const line = (k: string, v: string, b?: boolean) => (
    <>
      <div className="k" style={b ? { fontWeight: 700, color: "var(--tx)" } : undefined}>{k}</div>
      <div className="v" style={b ? { fontWeight: 700 } : undefined}>{v}</div>
    </>
  );

  return (
    <Modal>
      <div className="fig">EDIT PAYSLIP</div>
      <h3 style={{ margin: "6px 0 2px" }}>{r.name}</h3>
      <div className="mut" style={{ fontSize: 13 }}>{r.code} · {period.label}</div>
      {err && <p className="err-box"><span>{err}</span></p>}

      <div className="fig" style={{ marginTop: 18 }}>SALARY PER CUTOFF</div>
      <p className="mut" style={{ fontSize: 12.5, margin: "4px 0 0" }}>
        Change this if the salary changes. SSS, PhilHealth and Pag-IBIG are recomputed from the 2026 tables each time, and the new salary is saved to the employee&apos;s record when you press Save payslip.
      </p>
      <div className="pe-row" style={{ marginTop: 12 }}>
        <span style={{ fontSize: 14 }}>Salary per cutoff (₱)</span>
        <input type="number" min="0" step="0.01" value={sal} aria-label="Salary per cutoff" onChange={(e) => changeSalary(e.target.value)} />
      </div>

      <div className="fig" style={{ marginTop: 18 }}>SSS · PHILHEALTH · PAG-IBIG</div>
      <p className="mut" style={{ fontSize: 12.5, margin: "4px 0 0" }}>
        {isIC(row(r)) ? "Independent contractor: switched off by default. " : "Real 2026 employee shares, half per payslip. "}
        Switch off to skip all three, or set one amount to 0 to skip just that one. Skipped contributions are not subtracted when the tax is computed.
      </p>
      <label className="sw" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
        <span className="tr"></span><span>Deduct SSS, PhilHealth &amp; Pag-IBIG</span>
      </label>
      <div className={on ? undefined : "off"}>
        {conRow("SSS", sss, setSss)}{conRow("PhilHealth", ph, setPh)}{conRow("Pag-IBIG", pg, setPg)}
      </div>

      <div className="fig" style={{ marginTop: 18 }}>ADDITIONAL PAY</div>
      <p className="mut" style={{ fontSize: 12.5, margin: "4px 0 0" }}>
        Holidays are unpaid by default. Add holiday pay (defaults to one day&apos;s pay) or any other extra pay only when it applies.
      </p>
      {extras.length === 0 && <p className="mut" style={{ fontSize: 13, margin: "10px 0 0" }}>No additional pay on this payslip.</p>}
      {extras.map((e, i) => (
        <div className="pe-extra" key={i}>
          <input value={e.label} placeholder="Description" aria-label="Additional pay description"
            onChange={(ev) => setExtras(extras.map((z, j) => (j === i ? { ...z, label: ev.target.value } : z)))} />
          <input type="number" min="0" step="0.01" value={e.amt} aria-label="Additional pay amount"
            onChange={(ev) => setExtras(extras.map((z, j) => (j === i ? { ...z, amt: ev.target.value } : z)))} />
          <button className="sm dngr" type="button" onClick={() => setExtras(extras.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      <div className="row" style={{ margin: "12px 0 0" }}>
        {free.length ? (
          <>
            <select value={hol || free[0].d} onChange={(e) => setHol(e.target.value)} style={{ flex: 1, minWidth: 190, width: "auto" }} aria-label="Holiday">
              {free.map((h) => <option key={h.d} value={h.d}>{h.n} · {fmtDate(h.d)}</option>)}
            </select>
            <button className="sm" type="button" onClick={() => {
              const h = free.find((f) => f.d === (hol || free[0].d))!;
              setExtras([...extras, { label: "Holiday pay — " + h.n, amt: String(Math.round((num(sal) * 2) / 22)), hd: h.d }]);
              setHol("");
            }}>+ Add holiday pay</button>
          </>
        ) : (
          <span className="mut" style={{ fontSize: 12.5 }}>No unpaid holidays left in this pay period.</span>
        )}
        <button className="sm" type="button" onClick={() => setExtras([...extras, { label: "", amt: "0" }])}>+ Other pay</button>
      </div>

      <div className="fig" style={{ marginTop: 18 }}>WITHHOLDING TAX · AUTOMATIC</div>
      <div className="pe-sum">
        <div className="docgrid" style={{ margin: 0 }}>
          {line("Gross pay", PHP(x.g))}
          {line("Contributions deducted", "−" + PHP(x.sss + x.ph + x.pg))}
          {line("Taxable income (gross − allowances − contributions)", PHP(x.taxable))}
          {line("Withholding tax (automatic)", "−" + PHP(x.tx))}
          {line("Net pay", PHP(x.net), true)}
        </div>
        <div className="mut" style={{ fontSize: 12, marginTop: 10 }}>
          {x.tx > 0
            ? `Monthly equivalent ${PHP(x.taxable * 2)} is above ₱${WHT_MONTHLY_FREE.toLocaleString("en-PH")}, so withholding tax is deducted automatically.`
            : `Monthly equivalent ${PHP(x.taxable * 2)} is within the ₱${WHT_MONTHLY_FREE.toLocaleString("en-PH")} tax-free amount, so no withholding tax.`}
        </div>
      </div>

      <div className="mact no-print">
        {r.adj && <button className="dngr" disabled={pending} onClick={reset}>Reset to standard</button>}
        <button onClick={onClose}>Cancel</button>
        <button className="pri" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save payslip"}</button>
      </div>
    </Modal>
  );
}

export function PayrollTable({ rows, period, locked, holidays }: { rows: PRow[]; period: Period; locked: boolean; holidays: Hol[] }) {
  const [view, setView] = useState<PRow | null>(null);
  const [edit, setEdit] = useState<PRow | null>(null);
  // always show the freshest data after a save/refresh
  const fresh = (r: PRow | null) => (r ? rows.find((x) => x.id === r.id) ?? r : null);

  return (
    <>
      <div className="card flat wrap" style={{ padding: 8 }}>
        <table>
          <thead><tr>{["Employee", "Gross", "Deductions", "Net", ""].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td className="mut" colSpan={5}>No employees yet.</td></tr>}
            {rows.map((r) => {
              const x = computePay(row(r), r.adj, r.otHours);
              return (
                <tr key={r.id}>
                  <td>
                    <span className="av">{initials(r.name)}</span>{r.name}
                    {isIC(row(r)) && <> <span className="tag">Contractor</span></>}
                    {x.edited && <> <span className="tag info">Edited</span></>}
                  </td>
                  <td>{PHP(x.g)}</td>
                  <td><span className="mut">−{PHP(x.ded)}</span></td>
                  <td><b>{PHP(x.net)}</b></td>
                  <td>
                    <button className="sm" onClick={() => setView(r)}>Preview</button>
                    {!locked && <> <button className="sm" onClick={() => setEdit(r)}>Edit</button></>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {view && <Slip r={fresh(view)!} period={period} onClose={() => setView(null)} onEdit={locked ? undefined : () => { setEdit(view); setView(null); }} />}
      {edit && <EditSlip key={edit.id + JSON.stringify(fresh(edit)!.adj) + fresh(edit)!.salary} r={fresh(edit)!} period={period} holidays={holidays} onClose={() => setEdit(null)} />}
    </>
  );
}