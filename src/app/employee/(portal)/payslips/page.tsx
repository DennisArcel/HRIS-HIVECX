import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { computePay, periodList, PHP, type Adj } from "@/lib/payroll-calc";
import { fmtDate } from "@/lib/fmt";
import PayslipsClient, { type SlipRow } from "./payslips-client";

// Always read fresh data: a payslip must appear the moment HR runs payroll.
export const dynamic = "force-dynamic";

function Stat({ fig, title, value, sub }: { fig: string; title: string; value: string; sub: string }) {
  return (
    <div className="card stat">
      <div className="fig">{fig}</div>
      <h3>{title}</h3>
      <div className="big"><span style={{ fontSize: 26 }}>{value}</span></div>
      <small>{sub}</small>
    </div>
  );
}

/** Payday rule: cutoff 1–15 is paid on the 20th of the same month; cutoff 16–end is paid on the 5th of the next month. */
function payday(to: string) {
  const [y, m, d] = to.split("-").map(Number);
  const p = (n: number) => String(n).padStart(2, "0");
  if (d <= 15) return `${y}-${p(m)}-20`;
  return m === 12 ? `${y + 1}-01-05` : `${y}-${p(m + 1)}-05`;
}

export default async function PayslipsPage() {
  // 1. Who is signed in? Everything below is filtered by this id, so an employee only ever gets their own data.
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  const user = auth.user;
  if (!user) redirect("/signin");

  const db = supabaseAdmin();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const periods = periodList(today); // newest first, same list HR sees

  const froms = periods.map((p) => p.from);
  const earliest = froms[froms.length - 1];
  const latest = periods[0].to;

  const [meQ, runsQ, adjQ, otQ] = await Promise.all([
    db.from("profiles").select("id, employee_code, full_name, position, department, salary_semi, worker_type").eq("id", user.id).single(),
    db.from("payroll_runs").select("period_from, status").in("period_from", froms),
    db.from("pay_adjustments").select("period_from, sss, ph, pg, extras").eq("employee_id", user.id).in("period_from", froms),
    db.from("hr_requests").select("overtime_hours, request_date").eq("employee_id", user.id).eq("status", "Approved").ilike("type", "%overtime%").gte("request_date", earliest).lte("request_date", latest),
  ]);

  const me = meQ.data;
  if (!me) redirect("/signin");

  const processed = new Set((runsQ.data ?? []).filter((r) => r.status === "Processed").map((r) => r.period_from as string));
  const adjBy = new Map((adjQ.data ?? []).map((a) => [a.period_from as string, a]));

  const calcFor = (p: { from: string; to: string }) => {
    const a = adjBy.get(p.from);
    const adj = a ? ({ sss: a.sss ?? undefined, ph: a.ph ?? undefined, pg: a.pg ?? undefined, extras: a.extras ?? [] } as Adj) : null;
    const otHours = (otQ.data ?? [])
      .filter((o) => (o.request_date as string) >= p.from && (o.request_date as string) <= p.to)
      .reduce((s, o) => s + (Number(o.overtime_hours) || 0), 0);
    return computePay({ salary_semi: Number(me.salary_semi) || 0, worker_type: me.worker_type }, adj, otHours);
  };

  // Show only released payslips and the periods still coming up. Past periods that payroll never ran are hidden;
  // they appear here (as Processed) the moment HR runs them.
  const rows: SlipRow[] = periods
    .filter((p) => processed.has(p.from) || p.to >= today)
    .map((p) => {
      const released = processed.has(p.from);
      return {
        from: p.from,
        to: p.to,
        payday: payday(p.to),
        label: p.label,
        released,
        status: released ? "Processed" : "Upcoming",
        calc: released ? calcFor(p) : null, // amounts are only sent to the browser once payroll is run
      };
    });

  // Stat cards
  const released = rows.filter((r) => r.released);
  const latestSlip = released[0]?.calc ?? null;
  const nextPayday = periods.map((p) => payday(p.to)).filter((d) => d >= today).sort()[0];

  return (
    <>
      <div className="eyebrow">Employee / Payslips</div>
      <h1>
        Your pay,
        <br />
        <em>clearly broken down.</em>
      </h1>
      <p className="lead">
        Your payslip appears here once HR runs payroll for the period. Select one to see the full breakdown — earnings, contributions, tax and net pay.
      </p>

      <div className="grid g4">
        <Stat fig="NEXT PAYDAY" title="Pay date" value={nextPayday ? fmtDate(nextPayday) : "—"} sub="amount is shown once HR runs payroll" />
        <Stat fig="LATEST PAYSLIP" title="Gross pay" value={latestSlip ? PHP(latestSlip.g) : "—"} sub="basic + allowances + overtime" />
        <Stat fig="LATEST PAYSLIP" title="Deductions" value={latestSlip ? PHP(latestSlip.ded) : "—"} sub="SSS · PhilHealth · Pag-IBIG · tax" />
        <Stat fig="RELEASED" title="Payslips" value={String(released.length)} sub="available to view" />
      </div>

      <div className="mt">
        <PayslipsClient
          rows={rows}
          me={{
            code: me.employee_code,
            name: me.full_name,
            position: me.position,
            department: me.department,
            contractor: me.worker_type === "Independent contractor",
          }}
        />
      </div>

      <p className="mut" style={{ fontSize: 12.5, marginTop: 14 }}>
        You can only access your own payslips. Choose <b>PDF</b> to print or save a copy — pick “Save as PDF” in the print dialog.
      </p>
    </>
  );
}