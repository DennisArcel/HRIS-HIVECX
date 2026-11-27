import { supabaseServer } from "@/lib/supabase/server";
import { Decision } from "@/components/Decision";
import AdminAttendanceCalendar, { type DayData } from "@/components/AdminAttendanceCalendar";
import AuditTrailButton, { type AuditEntry } from "@/components/AuditTrailButton";
import { fmtDate, initials } from "@/lib/fmt";
import { decideFix, decideReq } from "./actions";

export const dynamic = "force-dynamic";

type Emb = { full_name: string } | { full_name: string }[] | null;
const nm = (p: unknown) => ((Array.isArray(p) ? p[0] : p) as { full_name?: string } | null)?.full_name ?? "—";
const hm = (t: string | null) => (t ? t.slice(0, 5) : null);
const mins = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const pad2 = (n: number) => String(n).padStart(2, "0");
const statusTag = (s: string) => <span className={"tag " + (s === "Approved" ? "ok" : s === "Rejected" ? "bad" : "wait")}>{s}</span>;
const Dash = () => <span className="mut">—</span>;

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const sb = await supabaseServer();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const nowM = mins(
    new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Manila", hour12: false, hour: "2-digit", minute: "2-digit" }),
  );
  const dow = new Date(today + "T00:00:00").getDay();

  // ---- month selected for the calendar ----
  const cur = today.slice(0, 7);
  let ym = /^\d{4}-\d{2}$/.test(sp?.m ?? "") ? sp.m! : cur;
  if (ym > cur) ym = cur;
  const [y, mo] = ym.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const lead = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay();
  const shiftYm = (d: number) => {
    const t = new Date(Date.UTC(y, mo - 1 + d, 1));
    return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}`;
  };
  const first = `${ym}-01`;
  const last = `${ym}-${pad2(lastDay)}`;
  const prevHref = `/admin/attendance?m=${shiftYm(-1)}`;
  const nextHref = ym < cur ? `/admin/attendance?m=${shiftYm(1)}` : null;
  const monthTitle = new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });

  const [emps, shifts, att, leaves, hol, fixes, reqs, audit, mAtt, mLeaves, mHol, mFix] = await Promise.all([
    sb.from("profiles").select("id, full_name, shift_id, hired_on").eq("role", "employee").order("employee_code"),
    sb.from("shifts").select("id, name, start_time, rest_days"),
    sb.from("attendance").select("employee_id, time_in, time_out").eq("work_date", today),
    sb.from("leave_requests").select("employee_id").eq("status", "Approved").lte("from_date", today).gte("to_date", today),
    sb.from("holidays").select("name").eq("on_date", today),
    sb
      .from("attendance_corrections")
      .select("id, work_date, type, requested_time, reason, status, hr_remarks, created_at, profiles!employee_id(full_name)")
      .order("created_at", { ascending: false }),
    sb.from("hr_requests").select("id, type, request_date, status, profiles!employee_id(full_name)").order("id", { ascending: false }),
    sb
      .from("audit_log")
      .select("action, detail, actor_name, created_at")
      .in("action", ["Attendance corrected", "Correction rejected", "Request approved", "Request rejected"])
      .order("created_at", { ascending: false })
      .limit(200),
    // ---- month data for the calendar ----
    sb.from("attendance").select("employee_id, work_date, time_in, time_out").gte("work_date", first).lte("work_date", last).limit(5000),
    sb.from("leave_requests").select("employee_id, from_date, to_date").eq("status", "Approved").lte("from_date", last).gte("to_date", first),
    sb.from("holidays").select("name, on_date").gte("on_date", first).lte("on_date", last),
    sb
      .from("attendance_corrections")
      .select("work_date, type, requested_time, status, hr_remarks, profiles!employee_id(full_name)")
      .gte("work_date", first)
      .lte("work_date", last),
  ]);

  const shiftBy = new Map((shifts.data ?? []).map((s) => [s.id, s]));
  const recBy = new Map((att.data ?? []).map((r) => [r.employee_id, r]));
  const onLeave = new Set((leaves.data ?? []).map((l) => l.employee_id));
  const isHoliday = (hol.data ?? []).length > 0;

  const rows = (emps.data ?? []).map((e) => {
    const sh = shiftBy.get(e.shift_id);
    const r = recBy.get(e.id);
    const rest = !!sh?.rest_days?.includes(dow);
    const tin = hm(r?.time_in ?? null);
    const tout = hm(r?.time_out ?? null);
    let tag: React.ReactNode;
    if (today < e.hired_on) tag = <span className="tag">Starts {fmtDate(e.hired_on)}</span>;
    else if (rest && !tin) tag = <span className="tag">Rest day</span>;
    else if (isHoliday && !tin) tag = <span className="tag info">Holiday</span>;
    else if (onLeave.has(e.id)) tag = <span className="tag info">On leave</span>;
    else if (rest) tag = <span className="tag info">Rest-day work</span>;
    else if (!tin) tag = nowM < mins(sh?.start_time ?? "09:00") ? <span className="tag">Not in yet</span> : <span className="tag bad">Absent</span>;
    else if (!tout) tag = <span className="tag wait">Clocked in</span>;
    else tag = mins(tin) > mins(sh?.start_time ?? "09:00") ? <span className="tag wait">Late</span> : <span className="tag ok">On time</span>;
    return { e, sh, tin, tout, tag };
  });

  // ---- build per-day summaries for the calendar ----
  const mRecBy = new Map((mAtt.data ?? []).map((r) => [`${r.employee_id}|${r.work_date}`, r]));
  const mHolBy = new Map((mHol.data ?? []).map((h) => [h.on_date as string, h.name as string]));
  const mLeaveList = mLeaves.data ?? [];

  const days: DayData[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const k = `${ym}-${pad2(d)}`;
    const dDow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
    const holName = mHolBy.get(k) ?? null;
    const future = k > today;
    const counts = { on: 0, late: 0, absent: 0, leave: 0, inc: 0, clocked: 0 };
    const dayRows: DayData["rows"] = [];

    if (!future) {
      for (const e of emps.data ?? []) {
        if (k < e.hired_on) continue;
        const sh = shiftBy.get(e.shift_id);
        const start = sh?.start_time ?? "09:00";
        const r = mRecBy.get(`${e.id}|${k}`);
        const tin = hm(r?.time_in ?? null);
        const tout = hm(r?.time_out ?? null);
        const rest = !!sh?.rest_days?.includes(dDow);
        const leave = mLeaveList.some((l) => l.employee_id === e.id && k >= l.from_date && k <= l.to_date);
        let label = "", cls = "";
        if (rest && !tin) { label = "Rest day"; }
        else if (holName && !tin) { label = "Holiday"; cls = "info"; }
        else if (leave && !tin) { label = "On leave"; cls = "info"; counts.leave++; }
        else if (rest) { label = "Rest-day work"; cls = "info"; }
        else if (!tin) {
          if (k === today && nowM < mins(start)) label = "Not in yet";
          else { label = "Absent"; cls = "bad"; counts.absent++; }
        } else if (!tout) {
          if (k === today) { label = "Clocked in"; cls = "wait"; counts.clocked++; }
          else { label = "Incomplete (no clock-out)"; cls = "wait"; counts.inc++; }
        } else if (mins(tin) > mins(start)) {
          label = `Late · ${mins(tin) - mins(start)} min`; cls = "wait"; counts.late++;
        } else { label = "On time"; cls = "ok"; counts.on++; }
        dayRows.push({ name: e.full_name, shift: sh?.name ?? "—", tin, tout, label, cls });
      }
    }

    days.push({
      k,
      n: d,
      future,
      hol: holName,
      counts,
      rows: dayRows,
      fixes: (mFix.data ?? [])
        .filter((f) => f.work_date === k)
        .map((f) => ({
          name: nm(f.profiles as Emb),
          type: f.type,
          requested: hm(f.requested_time),
          status: f.status,
          remarks: f.hr_remarks ?? null,
        })),
    });
  }

  const fixList = [...(fixes.data ?? [])].sort((a, b) => (a.status === "Pending" ? -1 : 0) - (b.status === "Pending" ? -1 : 0));
  const pendFix = fixList.filter((f) => f.status === "Pending").length;
  const auditEntries: AuditEntry[] = (audit.data ?? []).map((a) => ({
    action: a.action, detail: a.detail, actor: a.actor_name, at: a.created_at,
  }));

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div className="eyebrow">HR Admin / Attendance</div>
          <h1>
            Today&apos;s shift,
            <br />
            <em>every employee.</em>
          </h1>
        </div>
        <AuditTrailButton entries={auditEntries} />
      </div>
      <p className="lead">Spot lates and absences, then clear correction requests. Every change is logged.</p>

      <div className="card flat wrap" style={{ padding: 8 }}>
        <table>
          <thead><tr>{["Employee", "Shift", "In", "Out", "Status"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td className="mut" colSpan={5}>No employees yet.</td></tr>}
            {rows.map(({ e, sh, tin, tout, tag }) => (
              <tr key={e.id}>
                <td><span className="av">{initials(e.full_name)}</span>{e.full_name}</td>
                <td>{sh?.name ?? "—"}</td>
                <td>{tin ?? <Dash />}</td>
                <td>{tout ?? <Dash />}</td>
                <td>{tag}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminAttendanceCalendar
        days={days}
        lead={lead}
        prev={prevHref}
        next={nextHref}
        todayHref={`/admin/attendance?m=${cur}`}
        today={today}
        monthTitle={monthTitle}
      />

      <div className="card mt">
        <div className="cardhd">
          <div><div className="fig">CORRECTION REQUESTS</div><h3>Attendance corrections</h3></div>
          <span className={"tag " + (pendFix ? "wait" : "")}>{pendFix} pending</span>
        </div>
        <div className="wrap">
          <table>
            <thead><tr>{["Employee", "Date", "Type", "Requested", "Reason", "Status", "HR remarks / action"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {fixList.length === 0 && <tr><td className="mut" colSpan={7}>No correction requests.</td></tr>}
              {fixList.map((f) => (
                <tr key={f.id}>
                  <td>{nm(f.profiles as Emb)}</td>
                  <td>{fmtDate(f.work_date)}</td>
                  <td>{f.type}</td>
                  <td><b>{hm(f.requested_time)}</b></td>
                  <td>{f.reason}</td>
                  <td>{statusTag(f.status)}</td>
                  <td>
                    {f.status === "Pending" ? (
                      <Decision id={f.id} withRemarks action={decideFix} label={`the attendance correction for ${nm(f.profiles as Emb)} on ${fmtDate(f.work_date)}`} />
                    ) : (
                      f.hr_remarks ?? <Dash />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mt">
        <div className="cardhd"><div><div className="fig">OVERTIME &amp; DOCUMENT REQUESTS</div><h3>Other requests</h3></div></div>
        <div className="wrap">
          <table>
            <thead><tr>{["Employee", "Request", "Date", "Status", ""].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {(reqs.data ?? []).length === 0 && <tr><td className="mut" colSpan={5}>No requests.</td></tr>}
              {(reqs.data ?? []).map((r) => (
                <tr key={r.id}>
                  <td>{nm(r.profiles as Emb)}</td>
                  <td>{r.type}</td>
                  <td>{fmtDate(r.request_date)}</td>
                  <td>{statusTag(r.status)}</td>
                  <td>
                    {r.status === "Pending" ? (
                      <Decision id={r.id} action={decideReq} label={`this ${r.type.toLowerCase()} request`} />
                    ) : (
                      <span className="mut">Done</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}