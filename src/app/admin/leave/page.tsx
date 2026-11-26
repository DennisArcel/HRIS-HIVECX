import { supabaseServer } from "@/lib/supabase/server";
import { Decision } from "@/components/Decision";
import { fmtDate } from "@/lib/fmt";
import { leaveDays } from "@/lib/workdays";
import { decideLeave } from "./actions";
import { FileLeaveForm, PolicyToggle } from "./LeaveTools";

export const dynamic = "force-dynamic";

type Emb = { full_name: string } | { full_name: string }[] | null;
const nm = (p: unknown) => ((Array.isArray(p) ? p[0] : p) as { full_name?: string } | null)?.full_name ?? "—";
const tagCls = (s: string) => (s === "Approved" ? "ok" : s === "Rejected" ? "bad" : "wait");

function Stat({ fig, title, value }: { fig: string; title: string; value: React.ReactNode }) {
  return (
    <div className="card stat">
      <div className="fig">{fig}</div>
      <h3>{title}</h3>
      <div className="big">{value}</div>
    </div>
  );
}

export default async function LeavePage() {
  const sb = await supabaseServer();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  const [lv, emps, shifts, hol, pol] = await Promise.all([
    sb
      .from("leave_requests")
      .select("id, employee_id, type, from_date, to_date, status, hr_remarks, reason, profiles!employee_id(full_name)")
      .order("from_date", { ascending: false }),
    sb.from("profiles").select("id, full_name, shift_id").eq("role", "employee").order("full_name"),
    sb.from("shifts").select("id, rest_days"),
    sb.from("holidays").select("on_date"),
    sb.from("policy").select("*").eq("id", true).single(),
  ]);

  const holidays = new Set((hol.data ?? []).map((h) => h.on_date as string));
  const restBy = new Map((shifts.data ?? []).map((s) => [s.id, (s.rest_days ?? [0, 6]) as number[]]));
  const shiftOf = new Map((emps.data ?? []).map((e) => [e.id, e.shift_id]));
  const days = (l: { employee_id: string; from_date: string; to_date: string }) =>
    leaveDays(l.from_date, l.to_date, restBy.get(shiftOf.get(l.employee_id) ?? "day") ?? [0, 6], holidays);

  const list = [...(lv.data ?? [])].sort((a, b) => (a.status === "Pending" ? -1 : 0) - (b.status === "Pending" ? -1 : 0));
  const pending = list.filter((l) => l.status === "Pending").length;
  const year = today.slice(0, 4);
  const approvedYear = list.filter((l) => l.status === "Approved" && l.from_date.startsWith(year)).length;
  const out = list
    .filter((l) => l.status === "Approved" && l.to_date >= today)
    .sort((a, b) => (a.from_date < b.from_date ? -1 : 1))
    .slice(0, 8);

  const p = pol.data;

  return (
    <>
      <div className="eyebrow">HR Admin / Leave</div>
      <h1>
        Approvals,
        <br />
        <em>without the chase.</em>
      </h1>
      <p className="lead">Review requests, see who is out, and manage the leave policy.</p>

      <div className="card">
        <div className="fig">WHO&apos;S OUT</div>
        <h3>Upcoming approved leave</h3>
        {out.length === 0 && <p className="mut">Nobody is on leave soon.</p>}
        {out.map((l) => (
          <div className="ls" key={l.id}>
            <b>{nm(l.profiles as Emb)}</b> <span className="mut">· {l.type} · {fmtDate(l.from_date)} → {fmtDate(l.to_date)}</span>
          </div>
        ))}
      </div>

      <div className="grid g4 mt">
        <Stat fig="QUEUE" title="Pending" value={pending} />
        <Stat fig="THIS YEAR" title="Approved" value={approvedYear} />
        <Stat fig="POLICY" title="Allowance" value={<>{p?.annual_allowance_days ?? "—"}<span style={{ fontSize: ".5em" }}> days</span></>} />
        <Stat fig="POLICY" title="Monthly bonus" value={<>{p?.monthly_bonus_days ?? "—"}<span style={{ fontSize: ".5em" }}> days</span></>} />
      </div>

      <div className="card mt">
        <div className="cardhd"><div><div className="fig">APPROVAL QUEUE</div><h3>Leave requests</h3></div></div>
        <div className="wrap">
          <table>
            <thead><tr>{["Employee", "Type", "Dates", "Days", "Status", "Remarks / action"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {list.length === 0 && <tr><td className="mut" colSpan={6}>No leave requests.</td></tr>}
              {list.map((l) => (
                <tr key={l.id}>
                  <td>{nm(l.profiles as Emb)}</td>
                  <td>{l.type}</td>
                  <td>{fmtDate(l.from_date)} → {fmtDate(l.to_date)}</td>
                  <td>{days(l)}</td>
                  <td><span className={"tag " + tagCls(l.status)}>{l.status}</span></td>
                  <td>
                    {l.status === "Pending" ? (
                      <Decision
                        id={l.id}
                        withRemarks
                        action={decideLeave}
                        label={`${nm(l.profiles as Emb)}'s ${l.type.toLowerCase()} leave (${days(l)} working days)`}
                      />
                    ) : (
                      l.hr_remarks ?? <span className="mut">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {p && (
        <div className="card mt">
          <div className="cardhd">
            <div><div className="fig">LEAVE POLICY</div><h3>Rules the whole system uses</h3></div>
            <PolicyToggle />
          </div>
          <div className="pol">
            <div><div className="fig">ANNUAL ALLOWANCE</div><b>{p.annual_allowance_days} days</b></div>
            <div><div className="fig">MONTHLY BONUS</div><b>{p.monthly_bonus_days} days</b></div>
            <div><div className="fig">LATENESS THRESHOLD</div><b>{p.lateness_forfeit_minutes} min</b></div>
            <div><div className="fig">CONSECUTIVE LATE</div><b>{p.consecutive_late_forfeit_days} days</b></div>
          </div>
          <p className="mut" style={{ fontSize: 13, margin: "14px 0 0" }}>
            Current rule:{" "}
            <b style={{ color: "var(--tx)" }}>
              {p.allowance_includes_bonus
                ? `bonus days count INSIDE the ${p.annual_allowance_days}-day allowance (hard maximum)`
                : `bonus days are ADDITIONAL to the ${p.annual_allowance_days}-day allowance`}
            </b>
            . The values live in the <code>policy</code> table in Supabase.
          </p>
        </div>
      )}

      <div className="card mt">
        <h3>File leave for an employee</h3>
        <FileLeaveForm emps={emps.data ?? []} />
      </div>
    </>
  );
}