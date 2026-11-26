import { supabaseServer } from "@/lib/supabase/server";
import { computePay, periodList, periodOf, PHP, type Adj } from "@/lib/payroll-calc";
import { PayrollTable, type PRow } from "./PayrollTable";
import { RunControls } from "./RunControls";

export const dynamic = "force-dynamic";

function Stat({ fig, title, value }: { fig: string; title: string; value: React.ReactNode }) {
  return (
    <div className="card stat">
      <div className="fig">{fig}</div>
      <h3>{title}</h3>
      <div className="big">{value}</div>
    </div>
  );
}

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const sb = await supabaseServer();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const periods = periodList(today);
  const cur = periods.find((x) => x.from === p) ?? periods[0];
  const per = periodOf(cur.from);

  const [emps, run, adjs, ot, hol] = await Promise.all([
    sb.from("profiles").select("id, employee_code, full_name, position, department, salary_semi, worker_type").eq("role", "employee").order("employee_code"),
    sb.from("payroll_runs").select("status, runs, reopened").eq("period_from", per.from).maybeSingle(),
    sb.from("pay_adjustments").select("employee_id, sss, ph, pg, extras").eq("period_from", per.from),
    sb.from("hr_requests").select("employee_id, overtime_hours").eq("status", "Approved").ilike("type", "%overtime%").gte("request_date", per.from).lte("request_date", per.to),
    sb.from("holidays").select("on_date, name").gte("on_date", per.from).lte("on_date", per.to).order("on_date"),
  ]);

  const adjBy = new Map((adjs.data ?? []).map((a) => [a.employee_id, a]));
  const otBy = new Map<string, number>();
  (ot.data ?? []).forEach((o) => otBy.set(o.employee_id, (otBy.get(o.employee_id) ?? 0) + (Number(o.overtime_hours) || 0)));

  const rows: PRow[] = (emps.data ?? []).map((e) => {
    const a = adjBy.get(e.id);
    return {
      id: e.id,
      code: e.employee_code,
      name: e.full_name,
      position: e.position,
      department: e.department,
      salary: Number(e.salary_semi) || 0,
      workerType: e.worker_type,
      adj: a ? ({ sss: a.sss ?? undefined, ph: a.ph ?? undefined, pg: a.pg ?? undefined, extras: a.extras ?? [] } as Adj) : null,
      otHours: otBy.get(e.id) ?? 0,
    };
  });

  const T = (k: "g" | "ded" | "net") =>
    rows.reduce((s, r) => s + computePay({ salary_semi: r.salary, worker_type: r.workerType }, r.adj, r.otHours)[k], 0);
  const processed = run.data?.status === "Processed";
  const runs = run.data?.runs ?? 0;
  const reopened = run.data?.reopened ?? 0;

  return (
    <>
      <div className="eyebrow">HR Admin / Payroll</div>
      <h1>
        Pay runs,
        <br />
        <em>without friction.</em>
      </h1>
      <p className="lead">
        Period {per.label}. Contributions follow the 2026 SSS, PhilHealth and Pag-IBIG tables (half deducted per payslip). Verify against the official circulars before real use.
      </p>

      <form method="get" className="row" style={{ alignItems: "center", marginBottom: 14 }}>
        <label htmlFor="pp" className="mut" style={{ margin: 0 }}>Pay period</label>
        <select id="pp" name="p" defaultValue={per.from} style={{ width: "auto" }}>
          {periods.map((x) => <option key={x.from} value={x.from}>{x.label}</option>)}
        </select>
        <button className="sm" type="submit">View</button>
      </form>

      <div className="grid g4">
        <Stat fig="GROSS" title="Gross" value={<span style={{ fontSize: 24 }}>{PHP(T("g"))}</span>} />
        <Stat fig="DEDUCTIONS" title="Deductions" value={<span style={{ fontSize: 24 }}>{PHP(T("ded"))}</span>} />
        <Stat fig="NET" title="Net pay" value={<span style={{ fontSize: 24 }}>{PHP(T("net"))}</span>} />
        <div className="card">
          <div className="fig">STATUS</div>
          <h3>
            <span className={"tag " + (processed ? "ok" : "wait")}>{processed ? "Processed" : "Draft"}</span>
            {!processed && reopened > 0 && <> <span className="tag info">Re-opened</span></>}
          </h3>
          <RunControls from={per.from} label={per.label} processed={processed} runs={runs} />
        </div>
      </div>

      <div className="mt">
        <PayrollTable
          rows={rows}
          period={per}
          locked={processed}
          holidays={(hol.data ?? []).map((h) => ({ d: h.on_date as string, n: h.name as string }))}
        />
      </div>
      <p className="mut" style={{ fontSize: 12.5, marginTop: 14 }}>
        {processed ? (
          <>Payroll is processed, so payslips are locked. Use <b>Re-open payroll</b> if something needs correcting.</>
        ) : (
          <>Use <b>Edit</b> to change an employee&apos;s salary, switch SSS, PhilHealth or Pag-IBIG on or off (or change the amount) and to add holiday pay. Withholding tax is calculated automatically. Edits lock once you run payroll, but you can re-open it and run it again if there are errors.</>
        )}
      </p>
    </>
  );
}