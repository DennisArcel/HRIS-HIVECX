import { supabaseServer } from "@/lib/supabase/server";
import { computePay, isIC, periodList, periodOf, PHP, type Adj } from "@/lib/payroll-calc";
import { computeHours, type AttRow, type LeaveRow, type ShiftInfo } from "@/lib/pay-hours";
import { PayrollTable, type PRow } from "./PayrollTable";
import { RunControls } from "./RunControls";
import { PeriodPicker } from "./PeriodPicker";
import { manilaNow } from "@/lib/dates";

export const dynamic = "force-dynamic";

const DEFAULT_SHIFT: ShiftInfo = { start_time: "09:00", end_time: "18:00", rest_days: [0, 6] };

function Stat({ fig, title, value }: { fig: string; title: string; value: React.ReactNode }) {
  return (
    <div className="card stat">
      <div className="fig">{fig}</div>
      <h3>{title}</h3>
      <div className="big">{value}</div>
    </div>
  );
}

function group<T extends { employee_id: string }>(list: T[] | null) {
  const m = new Map<string, T[]>();
  (list ?? []).forEach((r) => m.set(r.employee_id, [...(m.get(r.employee_id) ?? []), r]));
  return m;
}

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const sb = await supabaseServer();
  const today = manilaNow().date; // same "today" as the rest of the app
  const periods = periodList(today);
  const cur = periods.find((x) => x.from === p) ?? periods[0];
  const per = periodOf(cur.from);

  const [emps, run, adjs, ot, hol, att, lv, shf] = await Promise.all([
    // only employees who were already hired by the end of this pay period
    sb.from("profiles").select("id, employee_code, full_name, position, salary_monthly, worker_type, shift_id, hired_on").eq("role", "employee").or(`hired_on.is.null,hired_on.lte.${per.to}`).order("employee_code"),
    sb.from("payroll_runs").select("status, runs, reopened").eq("period_from", per.from).maybeSingle(),
    sb.from("pay_adjustments").select("employee_id, sss, ph, pg, extras").eq("period_from", per.from),
    sb.from("hr_requests").select("employee_id, overtime_hours").eq("status", "Approved").ilike("type", "%overtime%").gte("request_date", per.from).lte("request_date", per.to),
    sb.from("holidays").select("on_date, name").gte("on_date", per.from).lte("on_date", per.to).order("on_date"),
    // the clock: every clock in / clock out in this pay period
    sb.from("attendance").select("employee_id, work_date, time_in, time_out").gte("work_date", per.from).lte("work_date", per.to).limit(5000),
    sb.from("leave_requests").select("employee_id, from_date, to_date").eq("status", "Approved").lte("from_date", per.to).gte("to_date", per.from),
    sb.from("shifts").select("id, start_time, end_time, rest_days"),
  ]);

  const adjBy = new Map((adjs.data ?? []).map((a) => [a.employee_id, a]));
  const otBy = new Map<string, number>();
  (ot.data ?? []).forEach((o) => otBy.set(o.employee_id, (otBy.get(o.employee_id) ?? 0) + (Number(o.overtime_hours) || 0)));
  const attBy = group(att.data as ({ employee_id: string } & AttRow)[] | null);
  const lvBy = group(lv.data as ({ employee_id: string } & LeaveRow)[] | null);
  const shiftBy = new Map<string, ShiftInfo>((shf.data ?? []).map((s: { id: string } & ShiftInfo) => [s.id, s]));
  const holSet = new Set<string>((hol.data ?? []).map((h: { on_date: string }) => h.on_date));

  const rows: PRow[] = (emps.data ?? []).map((e) => {
    const a = adjBy.get(e.id);
    return {
      id: e.id,
      code: e.employee_code,
      name: e.full_name,
      position: e.position,
      monthly: Number(e.salary_monthly) || 0,
      workerType: e.worker_type,
      adj: a ? ({ sss: a.sss ?? undefined, ph: a.ph ?? undefined, pg: a.pg ?? undefined, extras: a.extras ?? [] } as Adj) : null,
      otHours: otBy.get(e.id) ?? 0,
      hours: computeHours({
        from: per.from,
        to: per.to,
        today,
        hiredOn: e.hired_on as string | null,
        shift: shiftBy.get(e.shift_id as string) ?? DEFAULT_SHIFT,
        holidays: holSet,
        attendance: attBy.get(e.id) ?? [],
        leaves: lvBy.get(e.id) ?? [],
        paidLeave: !isIC({ worker_type: e.worker_type }), // contractors are paid for hours worked only
      }),
    };
  });

  const T = (k: "g" | "ded" | "net") =>
    rows.reduce((s, r) => s + computePay({ salary_monthly: r.monthly, worker_type: r.workerType }, r.adj, r.otHours, r.hours)[k], 0);
  const processed = run.data?.status === "Processed";
  const runs = run.data?.runs ?? 0;
  const reopened = run.data?.reopened ?? 0;
  const missing = rows.reduce((s, r) => s + r.hours.missingOut, 0);

  return (
    <>
      <div className="eyebrow">HR Admin / Payroll</div>
      <h1>
        Pay runs,
        <br />
        <em>without friction.</em>
      </h1>
      <p className="lead">
        Period {per.label}. Pay comes from the clock: hourly rate = monthly salary ÷ 20 days ÷ 8 hours, multiplied by the hours each person clocked in and out. Employees receive a Payslip; independent contractors receive a Settlement. Contributions follow the 2026 SSS, PhilHealth and Pag-IBIG tables (half deducted per payslip). Verify against the official circulars before real use.
      </p>

      <PeriodPicker periods={periods.map((x) => ({ from: x.from, label: x.label }))} current={per.from} />

      {!processed && missing > 0 && (
        <p className="err-box" style={{ marginBottom: 14 }}>
          <span>
            {missing} clock-in{missing === 1 ? " has" : "s have"} no clock-out in this period. Those days are unpaid until the time is fixed in Attendance.
          </span>
        </p>
      )}

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
          <>Payroll is processed, so payslips and settlements are locked. Use <b>Re-open payroll</b> if something needs correcting.</>
        ) : (
          <>Use <b>Edit</b> to change an employee&apos;s monthly salary, switch SSS, PhilHealth or Pag-IBIG on or off (or change the amount) and to add holiday pay. Hours can&apos;t be typed here: they come from the clock, so fix a wrong time in Attendance. Withholding tax is calculated automatically. Edits lock once you run payroll, but you can re-open it and run it again if there are errors.</>
        )}
      </p>
    </>
  );
}
