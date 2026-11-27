"use client";
import { useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/ui";
import { fmtDate, initials } from "@/lib/fmt";
import {
  PHP, WHT_MONTHLY_FREE, MAX_CUTOFF_HOURS, computePay, contribFor, dailyRate, docName, isIC,
  type Adj, type PayHours,
} from "@/lib/payroll-calc";
import { resetPayslip, savePayslip } from "./actions";

export type PRow = {
  id: string;
  code: string;
  name: string;
  position: string | null;
  monthly: number;
  workerType: string;
  adj: Adj;
  otHours: number;
  hours: PayHours;
};
type Period = { from: string; to: string; label: string };
type Hol = { d: string; n: string };
type XD = { label: string; amt: string; hd?: string };

const num = (s: string) => Math.max(0, parseFloat(s) || 0);
const row = (r: PRow) => ({ salary_monthly: r.monthly, worker_type: r.workerType });
const hrs = (n: number) => n.toFixed(2).replace(/\.?0+$/, "") || "0";
/** Negative amounts read "−₱850.00", not "₱-850.00". */
const money = (n: number) => (n < 0 ? "−" + PHP(-n) : PHP(n));

/** Read-only attendance summary taken from clock in / clock out. */
function AttendanceBox({ h, rate }: { h: PayHours; rate: number }) {
  return (
    <div className="pe-sum" style={{ marginTop: 10 }}>
      <div className="docgrid" style={{ margin: 0 }}>
        <div className="k">Hours worked (from clock in / out)</div><div className="v">{hrs(h.hours)} hrs</div>
        <div className="k">Days worked</div><div className="v">{h.days}</div>
        {h.leaveDays > 0 && <><div className="k">Approved leave (8 hrs a day)</div><div className="v">{h.leaveDays} day{h.leaveDays === 1 ? "" : "s"}</div></>}
        {h.absent > 0 && <><div className="k">Absent (unpaid)</div><div className="v">{h.absent} day{h.absent === 1 ? "" : "s"}</div></>}
        {h.missingOut > 0 && <><div className="k">Clock-in without clock-out (unpaid until fixed)</div><div className="v">{h.missingOut} day{h.missingOut === 1 ? "" : "s"}</div></>}
        <div className="k">Hourly rate</div><div className="v">{PHP(rate)}</div>
      </div>
    </div>
  );
}

function Slip({ r, period, onClose, onEdit }: { r: PRow; period: Period; onClose: () => void; onEdit?: () => void }) {
  const x = computePay(row(r), r.adj, r.otHours, r.hours);
  const doc = docName(r.workerType);
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
            <div className="fig">{doc.toUpperCase()}</div>
            <h3 style={{ marginTop: 6 }}>{r.name}</h3>
            <div className="mut" style={{ fontSize: 13 }}>
              {r.code} · {r.position}{isIC(row(r)) ? " · Independent contractor" : ""}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <b>{period.label}</b>
            <div className="mut" style={{ fontSize: 12.5 }}>Pay date: {fmtDate(period.to)}</div>
          </div>
        </div>
        <div className="fig" style={{ marginTop: 14 }}>EARNINGS</div>
        <div className="docgrid">
          <div className="k">Basic pay ({hrs(x.hoursPaid ?? 0)} hrs × {PHP(x.rate)}/hr)</div><div className="v">{PHP(x.basic)}</div>
          <div className="k">Allowances (transport &amp; COLA, 4% of basic)</div><div className="v">{PHP(x.allow)}</div>
          <div className="k">Overtime ({x.otHrs} hrs × 125%)</div><div className="v">{PHP(x.ot)}</div>
          {x.extras.filter((z) => +z.amt > 0).map((z, i) => (
            <div key={i} style={{ display: "contents" }}><div className="k">{z.label || "Additional pay"}</div><div className="v">{PHP(z.amt)}</div></div>
          ))}
          <div className="k" style={{ fontWeight: 700, color: "var(--tx)" }}>Gross pay</div>
          <div className="v" style={{ fontWeight: 700 }}>{PHP(x.g)}</div>
        </div>
        <p className="mut" style={{ fontSize: 12, margin: "8px 0 0" }}>
          Hourly rate = monthly salary {PHP(x.monthly)} ÷ 20 days ÷ 8 hrs. {r.hours.days} day{r.hours.days === 1 ? "" : "s"} worked
          {r.hours.leaveDays ? `, ${r.hours.leaveDays} on approved leave` : ""}
          {x.capped ? `. Paid hours are capped at ${MAX_CUTOFF_HOURS} per cutoff.` : "."}
        </p>
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
          <div><div className="fig">NET PAY</div><div className="net">{money(x.net)}</div></div>
          <div className="mut" style={{ fontSize: 12, maxWidth: "38ch" }}>
            Withholding tax follows the BIR TRAIN semi-monthly table (nothing is withheld up to ₱10,417 taxable per cutoff). Allowances are treated as non-taxable de minimis benefits.
          </div>
        </div>
        <div className="mact no-print">
          <button onClick={onClose}>Close</button>
          <button onClick={() => window.print()}>Print / Save as PDF</button>
          {onEdit && <button className="pri" onClick={onEdit}>Edit {doc.toLowerCase()}</button>}
          <span className="mut" style={{ fontSize: 12, alignSelf: "center" }}>HR preview{onEdit ? "" : " · locked (payroll processed)"}</span>
        </div>
      </div>
    </Modal>
  );
}

function EditSlip({ r, period, holidays, onClose }: { r: PRow; period: Period; holidays: Hol[]; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const doc = docName(r.workerType);
  const def0 = contribFor(r.monthly / 2);
  const a = r.adj;
  const [sal, setSal] = useState(String(r.monthly));
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
  const x = computePay({ salary_monthly: num(sal), worker_type: r.workerType }, draft, r.otHours, r.hours);
  const free = holidays.filter((h) => !extras.some((e) => e.hd === h.d));

  function changeSalary(v: string) {
    setSal(v);
    const d = contribFor(num(v) / 2);
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
      <div className="fig">EDIT {doc.toUpperCase()}</div>
      <h3 style={{ margin: "6px 0 2px" }}>{r.name}</h3>
      <div className="mut" style={{ fontSize: 13 }}>{r.code} · {period.label}</div>
      {err && <p className="err-box"><span>{err}</span></p>}

      <div className="fig" style={{ marginTop: 18 }}>HOURS · FROM CLOCK IN / OUT</div>
      <p className="mut" style={{ fontSize: 12.5, margin: "4px 0 0" }}>
        Basic pay = hours worked × hourly rate. To change the hours, correct the clock times in Attendance.
      </p>
      <AttendanceBox h={r.hours} rate={x.rate} />

      <div className="fig" style={{ marginTop: 18 }}>MONTHLY SALARY</div>
      <p className="mut" style={{ fontSize: 12.5, margin: "4px 0 0" }}>
        Hourly rate = monthly salary ÷ 20 days ÷ 8 hrs. Changing it updates the employee&apos;s record when you press Save, and applies to every pay period. SSS, PhilHealth and Pag-IBIG are recomputed from the 2026 tables.
      </p>
      <div className="pe-row" style={{ marginTop: 12 }}>
        <span style={{ fontSize: 14 }}>Monthly salary (₱) · {PHP(x.rate)}/hr</span>
        <input type="number" min="0" step="0.01" value={sal} aria-label="Monthly salary" onChange={(e) => changeSalary(e.target.value)} />
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
      {extras.length === 0 && <p className="mut" style={{ fontSize: 13, margin: "10px 0 0" }}>No additional pay on this {doc.toLowerCase()}.</p>}
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
              setExtras([...extras, { label: "Holiday pay — " + h.n, amt: String(dailyRate(num(sal))), hd: h.d }]);
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
          {line(`Basic pay (${hrs(x.hoursPaid ?? 0)} hrs × ${PHP(x.rate)})`, PHP(x.basic))}
          {line("Gross pay", PHP(x.g))}
          {line("Contributions deducted", "−" + PHP(x.sss + x.ph + x.pg))}
          {line("Taxable income (gross − allowances − contributions)", PHP(x.taxable))}
          {line("Withholding tax (automatic)", "−" + PHP(x.tx))}
          {line("Net pay", money(x.net), true)}
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
        <button className="pri" disabled={pending} onClick={save}>{pending ? "Saving…" : `Save ${doc.toLowerCase()}`}</button>
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
      <style>{`
        .paytbl{width:100%;border-collapse:collapse}
        .paytbl th{white-space:nowrap;text-align:left;padding:14px 18px;font-weight:500}
        .paytbl td{padding:18px;vertical-align:middle;border-top:1px solid var(--line, #2a2a2a)}
        .paytbl tbody tr:first-child td{border-top:0}
        .paytbl .num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
        .paytbl .who{display:flex;align-items:center;gap:14px;min-width:220px}
        .paytbl .sub{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
        .paytbl .note{font-size:12px;margin-top:5px}
        .paytbl .end{text-align:right;white-space:nowrap}
        .paytbl .neg{color:var(--bad, #ff6b6b)}
      `}</style>
      <div className="card flat wrap" style={{ padding: 8, overflowX: "auto" }}>
        <table className="paytbl">
          <thead>
            <tr>
              <th>Employee</th>
              <th className="num">Hours</th>
              <th className="num">Gross</th>
              <th className="num">Deductions</th>
              <th className="num">Net pay</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td className="mut" colSpan={6}>No employees yet.</td></tr>}
            {rows.map((r) => {
              const x = computePay(row(r), r.adj, r.otHours, r.hours);
              const ic = isIC(row(r));
              return (
                <tr key={r.id}>
                  <td>
                    <div className="who">
                      <span className="av" style={{ flex: "none" }}>{initials(r.name)}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>{r.name}</div>
                        {(ic || x.edited) && (
                          <div className="sub">
                            {ic && <span className="tag">Contractor · Settlement</span>}
                            {x.edited && <span className="tag info">Edited</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="num">
                    <div>{hrs(r.hours.hours)} h</div>
                    {r.hours.missingOut > 0 && (
                      <div className="note">
                        <span className="tag wait" title="Clock-in with no clock-out. Unpaid until fixed in Attendance.">{r.hours.missingOut} no clock-out</span>
                      </div>
                    )}
                  </td>
                  <td className="num">{PHP(x.g)}</td>
                  <td className="num mut">{x.ded > 0 ? "−" + PHP(x.ded) : PHP(0)}</td>
                  <td className="num">
                    <b className={x.net < 0 ? "neg" : undefined}>{money(x.net)}</b>
                    {x.net < 0 && <div className="note neg">Deductions exceed pay</div>}
                  </td>
                  <td className="end">
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
      {edit && <EditSlip key={edit.id + JSON.stringify(fresh(edit)!.adj) + fresh(edit)!.monthly + fresh(edit)!.hours.hours} r={fresh(edit)!} period={period} holidays={holidays} onClose={() => setEdit(null)} />}
    </>
  );
}