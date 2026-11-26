import { getPortal, loadCtx } from "@/lib/employee-data";
import {
  bal, bonusRows, leaveDays, monthLabel, pad2, shortDate, ago, isRestDay, type Ctx,
} from "@/lib/employee-calc";
import { PageHead, Mini, Table, Tag, Dash } from "@/components/employee-ui";
import { LeaveForm } from "@/components/employee-forms";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

function LeaveCalendar({ c }: { c: Ctx }) {
  const ym = c.today.slice(0, 7), [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate(), lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const cells = [];
  for (let d = 1; d <= last; d++) {
    const k = `${ym}-${pad2(d)}`;
    const lv = c.leaves.find((l) => ["Approved", "Pending"].includes(l.status) && k >= l.from_date && k <= l.to_date);
    const cls = c.hols[k] ? "hol" : isRestDay(k, c.shift) ? "rest" : lv ? (lv.status === "Approved" ? "leave" : "inc") : "";
    cells.push(<div key={k} className={["day", cls, k === c.today ? "td" : ""].filter(Boolean).join(" ")} title={c.hols[k] ?? lv?.leave_type ?? ""}>{d}</div>);
  }
  const L: [string, string][] = [["var(--leave)", "Approved leave"], ["var(--inc)", "Pending leave"], ["var(--info)", "Holiday"], ["var(--mut)", "Rest day"]];
  return (
    <div className="card">
      <div className="cardhd"><div><div className="fig">MY LEAVE CALENDAR</div><h3>{monthLabel(ym)}</h3></div>
        <span className="mut" style={{ fontSize: 12.5 }}>Your approved and pending leave, holidays and rest days</span></div>
      <div className="cal">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((x) => <div className="h" key={x}>{x}</div>)}
        {Array.from({ length: lead }).map((_, i) => <div className="h" key={"b" + i} />)}
        {cells}
      </div>
      <div className="leg big">
        {L.map(([col, l]) => <span key={l}><i style={{ background: col }} />{l}</span>)}
        <span><i style={{ background: "transparent", boxShadow: "inset 0 0 0 2px var(--ac)" }} />Today</span>
      </div>
    </div>
  );
}

export default async function EmployeeLeave() {
  const p = await getPortal();
  const c = await loadCtx(p);
  const b = bal(c), rows = bonusRows(c).slice(0, 7);
  const T = c.policy;
  return (
    <>
      <PageHead eyebrow="Employee / Leave" title={<>Time off,<br /><em>made simple.</em></>}
        lead="Your annual allowance, the monthly attendance bonus, and every request you've filed." />
      <LeaveCalendar c={c} />

      <div className="card mt">
        <div className="cardhd"><div><div className="fig">LEAVE BALANCE · {c.today.slice(0, 4)}</div><h3>Where you stand</h3></div>
          <span className={"tag " + (b.remaining > 3 ? "ok" : "wait")}>{b.remaining} days available</span></div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: "18px 12px" }}>
          <Mini label="Annual allowance" val={b.allowance} note="days / year" />
          <Mini label="Earned so far" val={b.earned} note="accrued monthly" />
          <Mini label="Bonus earned" val={<span style={{ color: "var(--ac)" }}>+{b.bonusEarned}</span>} note="from attendance" />
          <Mini label="Used" val={b.used} note="approved leave" />
          <Mini label="Pending" val={b.pending} note="awaiting approval" />
          <Mini label="Remaining" val={<span style={{ color: "var(--ok)" }}>{b.remaining}</span>} note="bookable now" />
          <Mini label="Bonus forfeited" val={<span style={{ color: "var(--bad)" }}>{b.forfeited}</span>} note="voided months" />
        </div>
        <p className="mut" style={{ fontSize: 12.5, margin: "16px 0 0" }}>
          {b.includesBonus
            ? <>Rule in use: <b style={{ color: "var(--tx)" }}>bonus days count inside</b> your {b.allowance}-day allowance (total capped at {b.allowance} days).</>
            : <>Rule in use: <b style={{ color: "var(--tx)" }}>bonus days are additional</b> to your {b.allowance}-day allowance.</>}{" "}
          Rest days and holidays are not deducted from your balance.
        </p>
      </div>

      <div className="card mt">
        <div className="cardhd"><div><div className="fig">APPLY FOR LEAVE</div><h3>New leave request</h3></div>
          <span className="mut" style={{ fontSize: 13 }}>Available: <b style={{ color: "var(--tx)" }}>{b.remaining} days</b></span></div>
        <LeaveForm today={c.today} shift={c.shift} hols={c.hols} remaining={b.remaining} />
      </div>

      <div className="mt">
        <div className="fig" style={{ marginBottom: 8 }}>LEAVE HISTORY</div>
        <Table head={["Leave type", "Dates", "Days", "Submitted", "Status", "Remarks"]} empty="No leave requests yet."
          rows={c.leaves.map((l) => [
            l.leave_type, `${shortDate(l.from_date)} → ${shortDate(l.to_date)}`, leaveDays(l.from_date, l.to_date, c.shift, c.hols),
            ago(l.created_at), <Tag key="s" s={l.status} />,
            l.status === "Pending"
              ? (l.reason ? <>{l.reason} <span className="mut">· awaiting HR</span></> : <Dash />)
              : (l.remarks ? l.remarks : <Dash />),
          ])} />
      </div>

      <div className="card mt">
        <div className="cardhd"><div><div className="fig">MONTHLY ATTENDANCE BONUS</div><h3>How you earn +{T.bonus} days</h3></div></div>
        <div className="grid g3" style={{ gap: 10 }}>
          <div className="hintbox" style={{ margin: 0 }}><Icon name="check" /> Complete attendance for the whole month</div>
          <div className="hintbox" style={{ margin: 0 }}><Icon name="check" /> Less than {T.lateMin} late minutes in total</div>
          <div className="hintbox" style={{ margin: 0 }}><Icon name="check" /> No {T.consec} consecutive late days</div>
          <div className="hintbox" style={{ margin: 0, color: "var(--bad)" }}><Icon name="x" /> {T.lateMin}+ late minutes voids the bonus</div>
          <div className="hintbox" style={{ margin: 0, color: "var(--bad)" }}><Icon name="x" /> {T.consec} consecutive late days voids it too</div>
          <div className="hintbox" style={{ margin: 0 }}><Icon name="clock" /> Evaluated automatically every month end</div>
        </div>
        <div className="fig" style={{ margin: "20px 0 8px" }}>BONUS HISTORY</div>
        <Table head={["Month", "Late minutes", "Late days", "Max consecutive", "Completeness", "Status", "Bonus"]} empty="No evaluations yet."
          rows={rows.map((r) => [
            monthLabel(r.ym),
            <span key="l" style={{ color: r.lateMin >= T.lateMin ? "var(--bad)" : r.lateMin ? "var(--warn)" : "var(--mut)" }}>{r.lateMin} min</span>,
            r.late, r.maxConsec,
            <>{r.resolved}/{r.total}{r.complete ? "" : <span style={{ color: "var(--inc)" }}> · incomplete</span>}</>,
            <><Tag s={r.status} /><br /><span className="mut" style={{ fontSize: 11.5 }}>{r.reason}</span></>,
            r.amount ? <b key="a" style={{ color: "var(--ac)" }}>+{r.amount} day</b> : <Dash />,
          ])} />
        <p className="mut" style={{ fontSize: 12.5, margin: "14px 0 0" }}>Evaluations run automatically after each month ends — nothing is assigned by hand. Incomplete or disputed months stay <b>Pending Evaluation</b> until the records are resolved.</p>
      </div>
    </>
  );
}