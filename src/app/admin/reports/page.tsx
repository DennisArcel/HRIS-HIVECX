import { supabaseServer } from "@/lib/supabase/server";
import { ExportButton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const sb = await supabaseServer();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const c = { count: "exact" as const, head: true };

  const [emps, present, lvOk, lvPend, fixPend, audit, bonQ, bonV] = await Promise.all([
    sb.from("profiles").select("department").eq("role", "employee"),
    sb.from("attendance").select("id", c).eq("work_date", today).not("time_in", "is", null),
    sb.from("leave_requests").select("id", c).eq("status", "Approved"),
    sb.from("leave_requests").select("id", c).eq("status", "Pending"),
    sb.from("attendance_corrections").select("id", c).eq("status", "Pending"),
    sb.from("audit_log").select("id", c),
    sb.from("bonus_evaluations").select("employee_id", c).eq("status", "Qualified"),
    sb.from("bonus_evaluations").select("employee_id", c).eq("status", "Voided"),
  ]);

  const total = emps.data?.length ?? 0;
  const depts = new Set((emps.data ?? []).map((e) => e.department).filter(Boolean)).size;

  const reports = [
    { key: "headcount", title: "Headcount", text: `${total} employees across ${depts} departments` },
    { key: "attendance", title: "Attendance", text: `${present.count ?? 0} of ${total} present today` },
    { key: "leave", title: "Leave", text: `${lvOk.count ?? 0} approved, ${lvPend.count ?? 0} pending` },
    { key: "corrections", title: "Corrections", text: `${fixPend.count ?? 0} awaiting review, ${audit.count ?? 0} logged changes` },
    { key: "bonus", title: "Bonus", text: `${bonQ.count ?? 0} qualified months, ${bonV.count ?? 0} voided` },
  ];

  return (
    <>
      <div className="eyebrow">HR Admin / Reports</div>
      <h1>
        Numbers,
        <br />
        <em>ready to share.</em>
      </h1>
      <p className="lead">Live summaries from your data. Export any of them as a CSV file.</p>
      <div className="grid g2">
        {reports.map((r) => (
          <div className="card" key={r.key}>
            <div className="fig">REPORT</div>
            <h3>{r.title}</h3>
            <p className="mut">{r.text}</p>
            <ExportButton href={`/api/reports/${r.key}`}>Export CSV</ExportButton>
          </div>
        ))}
      </div>
    </>
  );
}