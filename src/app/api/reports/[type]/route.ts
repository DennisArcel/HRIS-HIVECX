import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

type Cell = string | number | boolean | null | undefined;
type Emb = { full_name: string; employee_code: string } | { full_name: string; employee_code: string }[] | null;

const esc = (c: Cell) => {
  const s = c == null ? "" : String(c);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows: Cell[][]) => rows.map((r) => r.map(esc).join(",")).join("\r\n");
const who = (p: Emb) => {
  const x = Array.isArray(p) ? p[0] : p;
  return [x?.employee_code ?? "", x?.full_name ?? ""];
};

export async function GET(_req: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

  const emb = "profiles!employee_id(full_name, employee_code)";
  let rows: Cell[][] = [];

  if (type === "headcount") {
    const { data } = await sb
      .from("profiles")
      .select("employee_code, full_name, position, department, worker_type, hired_on, profile_complete")
      .eq("role", "employee")
      .order("employee_code");
    rows = [
      ["Employee ID", "Name", "Position", "Department", "Worker type", "Date hired", "Profile complete"],
      ...(data ?? []).map((e) => [e.employee_code, e.full_name, e.position, e.department, e.worker_type, e.hired_on, e.profile_complete]),
    ];
  } else if (type === "attendance") {
    const { data } = await sb.from("attendance").select(`work_date, time_in, time_out, note, ${emb}`).order("work_date", { ascending: false });
    rows = [
      ["Date", "Employee ID", "Name", "Time in", "Time out", "Note"],
      ...(data ?? []).map((r) => [r.work_date, ...who(r.profiles as Emb), r.time_in, r.time_out, r.note]),
    ];
  } else if (type === "leave") {
    const { data } = await sb.from("leave_requests").select(`type, from_date, to_date, status, reason, hr_remarks, ${emb}`).order("from_date", { ascending: false });
    rows = [
      ["Employee ID", "Name", "Type", "From", "To", "Status", "Reason", "HR remarks"],
      ...(data ?? []).map((r) => [...who(r.profiles as Emb), r.type, r.from_date, r.to_date, r.status, r.reason, r.hr_remarks]),
    ];
  } else if (type === "corrections") {
    const { data } = await sb.from("attendance_corrections").select(`work_date, type, requested_time, reason, status, hr_remarks, ${emb}`).order("work_date", { ascending: false });
    rows = [
      ["Employee ID", "Name", "Date", "Type", "Requested time", "Reason", "Status", "HR remarks"],
      ...(data ?? []).map((r) => [...who(r.profiles as Emb), r.work_date, r.type, r.requested_time, r.reason, r.status, r.hr_remarks]),
    ];
  } else if (type === "bonus") {
    const { data } = await sb.from("bonus_evaluations").select(`ym, status, reason, amount, ${emb}`).order("ym", { ascending: false });
    rows = [
      ["Employee ID", "Name", "Month", "Status", "Reason", "Bonus days"],
      ...(data ?? []).map((r) => [...who(r.profiles as Emb), r.ym, r.status, r.reason, r.amount]),
    ];
  } else {
    return new NextResponse("Unknown report", { status: 404 });
  }

  return new NextResponse("\uFEFF" + toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hive-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}