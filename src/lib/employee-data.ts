import { cache } from "react";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { manilaNow } from "@/lib/dates";
import {
  DEFAULT_POLICY, computePay, t5, type Ctx, type Fix, type Leave, type PayAdj, type Period, type Rec, type Shift,
} from "@/lib/employee-calc";

/**
 * Everything the employee pages read comes through here, and EVERY query is scoped to the signed-in user's id
 * taken from the session on the server. Nothing the browser sends can pick whose data is returned.
 * Table/column names follow supabase/migrations/0001_schema.sql; rows are normalised to the shapes the pages use.
 */
export type Profile = {
  id: string; role: string; full_name: string; email: string | null; hired_on: string;
  employee_no: string | null; username: string | null; position: string | null; department: string | null;
  employment_status: string | null; salary: number | null; is_ic: boolean; birthday: string | null; phone: string | null;
  address: string | null; emergency_contact: string | null; profile_complete: boolean | null;
};

export const getPortal = cache(async () => {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/signin");
  const { data } = await sb.from("profiles").select("*, shifts(*)").eq("id", user.id).single();
  if (!data) redirect("/signin");
  if (data.role === "admin") redirect("/admin/dashboard");
  const sh = (data.shifts ?? {}) as { name?: string; start_time?: string; end_time?: string; rest_days?: number[] };
  const shift: Shift = {
    name: sh.name ?? "Day Shift", start: t5(sh.start_time) ?? "09:00", end: t5(sh.end_time) ?? "18:00", rest: sh.rest_days ?? [0, 6],
  };
  const me: Profile = {
    id: data.id, role: data.role, full_name: data.full_name, email: data.email, hired_on: data.hired_on,
    employee_no: data.employee_code, username: data.username, position: data.position, department: data.department,
    employment_status: data.employment_status, salary: data.salary_semi, is_ic: data.worker_type === "Independent contractor",
    birthday: data.birthday, phone: data.phone, address: data.address, emergency_contact: data.emergency_contact,
    profile_complete: data.profile_complete,
  };
  const { date: today, time: now } = manilaNow();
  return { sb, user, me, shift, today, now };
});

type Portal = Awaited<ReturnType<typeof getPortal>>;

export async function loadCtx(p: Portal): Promise<Ctx> {
  const { sb, user, me, shift, today } = p;
  const [att, leaves, hols, fixes, pol] = await Promise.all([
    sb.from("attendance").select("work_date,time_in,time_out,note").eq("employee_id", user.id).gte("work_date", "2026-06-01"),
    sb.from("leave_requests").select("*").eq("employee_id", user.id).order("from_date", { ascending: false }),
    sb.from("holidays").select("on_date,name"),
    sb.from("attendance_corrections").select("*").eq("employee_id", user.id).order("created_at", { ascending: false }),
    sb.from("policy").select("*").maybeSingle(),
  ]);
  const recs: Record<string, Rec> = {};
  for (const r of att.data ?? []) recs[r.work_date] = { time_in: t5(r.time_in), time_out: t5(r.time_out), note: r.note || null };
  const h: Record<string, string> = {};
  for (const x of hols.data ?? []) h[x.on_date] = x.name;
  const pr = pol.data;
  return {
    today, hiredOn: me.hired_on, shift, recs, hols: h,
    policy: pr ? {
      annual: Number(pr.annual_allowance_days), bonus: Number(pr.monthly_bonus_days), lateMin: pr.lateness_forfeit_minutes,
      consec: pr.consecutive_late_forfeit_days, includes: !!pr.allowance_includes_bonus,
    } : DEFAULT_POLICY,
    leaves: (leaves.data ?? []).map((r): Leave => ({
      id: r.id, leave_type: r.type, from_date: r.from_date, to_date: r.to_date, status: r.status,
      reason: r.reason, remarks: r.hr_remarks, created_at: r.created_at,
    })),
    fixes: (fixes.data ?? []).map((r): Fix => ({
      id: r.id, work_date: r.work_date, type: r.type, requested_time: t5(r.requested_time), reason: r.reason,
      status: r.status, remarks: r.hr_remarks, reviewed_at: r.reviewed_at, created_at: r.created_at,
    })),
  };
}

export async function loadAnnouncements(p: Portal) {
  const { data } = await p.sb.from("announcements").select("*").order("posted_on", { ascending: false });
  return (data ?? []).map((a) => ({ ...a, created_at: a.posted_on as string }))
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
}

export async function loadNotifications(p: Portal, limit = 30) {
  const { data } = await p.sb.from("notifications").select("*").eq("employee_id", p.user.id)
    .order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as { id: string | number; kind: string; title: string; body: string; link: string | null; read: boolean; created_at: string }[];
}

export async function loadUpcoming(p: Portal) {
  const { data } = await p.sb.from("holidays").select("on_date,name").gte("on_date", p.today).order("on_date").limit(5);
  return (data ?? []).map((x) => ({ d: x.on_date as string, t: x.name as string, k: "hol", s: "Non-working holiday" }));
}

/** Payslip maths for this employee: approved overtime (hr_requests) + HR edits (pay_adjustments, visible once the run is Processed). */
export async function loadPayroll(p: Portal) {
  const [ot, adj] = await Promise.all([
    p.sb.from("hr_requests").select("request_date, overtime_hours").eq("employee_id", p.user.id).eq("status", "Approved").ilike("type", "overtime"),
    p.sb.from("pay_adjustments").select("*").eq("employee_id", p.user.id),
  ]);
  const salary = Number(p.me.salary ?? 0);
  return (per: Period) => {
    const otHrs = (ot.data ?? []).filter((r) => r.request_date >= per.from && r.request_date <= per.to)
      .reduce((a, r) => a + Number(r.overtime_hours ?? 0), 0);
    const a = (adj.data ?? []).find((r) => r.period_from === per.from) as PayAdj & { period_from?: string } | undefined;
    return computePay(salary, { ic: p.me.is_ic, otHrs, adj: a ?? null });
  };
}