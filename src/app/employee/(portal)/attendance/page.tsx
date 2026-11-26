import { getPortal, loadCtx } from "@/lib/employee-data";
import {
  POLICY, dayState, longDate, mins, monthFacts, monthLabel, pad2, shortDate, ago, isRestDay, type Ctx,
} from "@/lib/employee-calc";
import { PageHead, Stat, Table, Tag, Dash } from "@/components/employee-ui";
import { AttendanceCalendar, Clock, type CalDay } from "@/components/employee-live";
import { FixForm } from "@/components/employee-forms";

export const dynamic = "force-dynamic";

const ST_LABEL: Record<string, string> = {
  on: "On time", late: "Late", absent: "Absent", rest: "Rest day", hol: "Holiday", inc: "Incomplete",
  none: "Not yet recorded", future: "Scheduled", leave: "Approved leave",
};

function ShiftCard({ c }: { c: Ctx }) {
  const { shift: sh, today: Y } = c;
  const r = c.recs[Y], h = c.hols[Y];
  const off = h ? "Holiday · " + h : isRestDay(Y, sh) ? "Rest day" : "";
  const onLeave = c.leaves.some((l) => l.status === "Approved" && Y >= l.from_date && Y <= l.to_date);
  let status = "", cls = "wait";
  if (onLeave && !r?.time_in) { status = "On approved leave"; cls = "info"; }
  else if (!r?.time_in) {
    status = off ? off + " — not scheduled" : "Not clocked in yet"; cls = off ? "info" : "";
  } else if (!r.time_out) {
    const late = off ? 0 : Math.max(0, mins(r.time_in) - mins(sh.start));
    status = off ? `Clocked in · ${off} work` : late > 0 ? `Clocked in · Late by ${late} min` : "Clocked in · On time";
    cls = late > 0 ? "wait" : "ok";
  } else {
    const late = off ? 0 : Math.max(0, mins(r.time_in) - mins(sh.start)), hrs = Math.max(0, mins(r.time_out) - mins(r.time_in));
    status = `Shift complete · ${Math.floor(hrs / 60)}h ${hrs % 60}m worked${off ? ` · ${off} work` : late ? ` · ${late} min late` : " · On time"}`;
    cls = late > 0 ? "wait" : "ok";
  }
  return (
    <div className="card">
      <div className="cardhd"><div><div className="fig">YOUR SHIFT</div><h3>{sh.name}</h3></div><span className={"tag " + cls}>{status}</span></div>
      <Clock />
      <div className="mut" style={{ fontSize: 13.5 }}>{longDate(Y)}</div>
      <div className="shiftgrid">
        <div><div className="fig">SCHEDULED IN</div><b>{sh.start}</b></div>
        <div><div className="fig">SCHEDULED OUT</div><b>{sh.end}</b></div>
        <div><div className="fig">ACTUAL IN</div><b className={r?.time_in ? "" : "miss"}>{r?.time_in ?? "—"}</b></div>
        <div><div className="fig">ACTUAL OUT</div><b className={r?.time_out ? "" : "miss"}>{r?.time_out ?? "—"}</b></div>
      </div>
      {!r && !off && !onLeave && <p className="mut" style={{ fontSize: 12.5, margin: "12px 0 0" }}>Your arrival is recorded when HR scans your badge. Late arrivals are flagged automatically against your {sh.start} schedule.</p>}
    </div>
  );
}

export default async function EmployeeAttendance({ searchParams }: { searchParams: Promise<{ m?: string }> | { m?: string } }) {
  const sp = await searchParams;
  const p = await getPortal();
  const c = await loadCtx(p);
  const cur = p.today.slice(0, 7);
  let ym = /^\d{4}-\d{2}$/.test(sp?.m ?? "") ? sp.m! : cur;
  if (ym < POLICY.minMonth) ym = POLICY.minMonth;
  if (ym > POLICY.maxMonth) ym = POLICY.maxMonth;

  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const shiftYm = (d: number) => { const t = new Date(Date.UTC(y, m - 1 + d, 1)); return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}`; };
  const prev = ym > POLICY.minMonth ? `/employee/attendance?m=${shiftYm(-1)}` : null;
  const next = ym < POLICY.maxMonth ? `/employee/attendance?m=${shiftYm(1)}` : null;

  const days: CalDay[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const k = `${ym}-${pad2(d)}`, s = dayState(k, c), r = c.recs[k];
    const sub = s.st === "on" || s.st === "late" ? (r?.time_in ?? "")
      : s.st === "absent" ? "absent" : s.st === "inc" ? "incomplete" : s.st === "rest" ? "rest" : s.st === "leave" ? "leave"
      : s.st === "hol" ? c.hols[k].split(" ")[0].slice(0, 9).toLowerCase() : s.st === "none" ? "—" : "";
    const worked = r?.time_in && r?.time_out ? mins(r.time_out) - mins(r.time_in) : 0;
    days.push({
      k, n: d, st: s.st, label: ST_LABEL[s.st], sub, today: k === c.today,
      rows: [
        ["Date", longDate(k)],
        ["Attendance status", ST_LABEL[s.st] + (s.st === "late" ? ` · ${s.late} min late` : "")],
        ["Scheduled shift", `${c.shift.name} · ${c.shift.start} – ${c.shift.end}`],
        ["Actual clock-in", r?.time_in ?? "—"],
        ["Actual clock-out", r?.time_out ?? "—"],
        ["Total working hours", worked > 0 ? `${Math.floor(worked / 60)}h ${worked % 60}m` : "—"],
        ["Late minutes", s.st === "late" ? `${s.late} min` : "0"],
        ["Notes", r?.note ?? (s.st === "leave" ? "On approved leave — no clock record" : s.st === "hol" ? c.hols[k] : s.st === "rest" ? "Scheduled rest day" : "None")],
      ],
      fixes: c.fixes.filter((f) => f.work_date === k).map((f) => ({ type: f.type, status: f.status, reason: f.reason, remarks: f.remarks })),
    });
  }
  const mf = monthFacts(ym, c);

  return (
    <>
      <PageHead eyebrow="Employee / Attendance" title={<>Every day,<br /><em>on record.</em></>}
        lead="Your shift, monthly attendance and correction requests — all in one place." />
      <ShiftCard c={c} />
      <div className="card mt">
        <div className="calhd"><div><div className="fig">MONTHLY ATTENDANCE</div><h3>{monthLabel(ym)}</h3></div></div>
        <AttendanceCalendar days={days} lead={lead} prev={prev} next={next} todayHref={`/employee/attendance?m=${cur}`} />
      </div>
      <div className="grid g6 mt">
        <Stat f="THIS MONTH" t="On time" v={<span style={{ color: "var(--ok)" }}>{mf.on}</span>} />
        <Stat f="THIS MONTH" t="Late days" v={<span style={{ color: "var(--warn)" }}>{mf.late}</span>} />
        <Stat f="THIS MONTH" t="Absences" v={<span style={{ color: "var(--bad)" }}>{mf.absent}</span>} />
        <Stat f="THIS MONTH" t="On leave" v={<span style={{ color: "var(--leave)" }}>{mf.leave}</span>} />
        <Stat f="THIS MONTH" t="Late minutes" v={<>{mf.lateMin}<span style={{ fontSize: ".5em" }}> min</span></>} />
        <Stat f="THIS MONTH" t="Incomplete" v={<span style={{ color: "var(--inc)" }}>{mf.inc}</span>} />
        <Stat f="THIS MONTH" t="Workdays" v={mf.total} />
      </div>
      <div className="card mt">
        <div className="cardhd"><div><div className="fig">ATTENDANCE CORRECTION</div><h3>Request a correction</h3></div></div>
        <p className="mut" style={{ fontSize: 13, margin: 0 }}>Forgot to clock in or out? Ask HR to correct the record — attendance can only be changed through an approved request, never edited directly.</p>
        <FixForm today={c.today} />
      </div>
      <div className="mt">
        <div className="fig" style={{ marginBottom: 8 }}>CORRECTION HISTORY</div>
        <Table head={["Submitted", "Attendance date", "Type", "Requested", "Reason", "Status", "HR remarks", "Reviewed"]}
          empty="You haven't filed any corrections yet."
          rows={c.fixes.map((f) => [
            ago(f.created_at), shortDate(f.work_date), f.type, f.requested_time ? <b>{f.requested_time}</b> : <Dash />, f.reason,
            <Tag key="s" s={f.status} />, f.remarks ?? <Dash />, f.reviewed_at ? shortDate(f.reviewed_at.slice(0, 10)) : <Dash />,
          ])} />
      </div>
    </>
  );
}