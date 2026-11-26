"use server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";

type R = { error?: string };
type Emb = { full_name: string } | { full_name: string }[] | null;
const nameOf = (p: unknown) => {
  const x = (Array.isArray(p) ? p[0] : p) as { full_name?: string } | null;
  return x?.full_name ?? "Employee";
};
const fdate = (s: string) =>
  new Date(s + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

export async function decideFix(id: number, ok: boolean, remarks: string): Promise<R> {
  const admin = await requireAdmin();
  const db = supabaseAdmin();
  const { data: f } = await db
    .from("attendance_corrections")
    .select("id, employee_id, work_date, type, requested_time, status, profiles!employee_id(full_name)")
    .eq("id", id)
    .single();
  if (!f) return { error: "Request not found." };
  if (f.status !== "Pending") return { error: "This request was already decided." };

  const status = ok ? "Approved" : "Rejected";
  const rm = remarks.trim() || (ok ? "Approved by HR" : "Rejected by HR");
  const { error } = await db
    .from("attendance_corrections")
    .update({ status, hr_remarks: rm, reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "Pending");
  if (error) return { error: error.message };

  if (ok) {
    const isIn = f.type === "Forgot to Clock In" || f.type === "Incorrect Clock In";
    const { error: e2 } = await db.from("attendance").upsert(
      {
        employee_id: f.employee_id,
        work_date: f.work_date,
        [isIn ? "time_in" : "time_out"]: f.requested_time,
        note: "Corrected from request #" + id,
      },
      { onConflict: "employee_id,work_date" },
    );
    if (e2) return { error: e2.message };
  }

  const who = nameOf(f.profiles as Emb);
  await db.from("audit_log").insert({
    actor: admin.id,
    actor_name: admin.name,
    action: ok ? "Attendance corrected" : "Correction rejected",
    detail: `${who} · ${f.work_date} · ${f.type}${ok ? " → " + String(f.requested_time).slice(0, 5) : ""}`,
  });
  await db.from("notifications").insert({
    employee_id: f.employee_id,
    kind: "correction",
    title: ok ? "Attendance correction approved" : "Attendance correction rejected",
    body: `${fdate(f.work_date)} · ${f.type} — ${rm}`,
    link: "/employee/attendance",
  });
  revalidatePath("/admin/attendance");
  revalidatePath("/admin/dashboard");
  return {};
}

export async function decideReq(id: number, ok: boolean): Promise<R> {
  const admin = await requireAdmin();
  const db = supabaseAdmin();
  const { data: r } = await db
    .from("hr_requests")
    .select("id, employee_id, type, request_date, status, profiles!employee_id(full_name)")
    .eq("id", id)
    .single();
  if (!r) return { error: "Request not found." };
  if (r.status !== "Pending") return { error: "This request was already decided." };

  const status = ok ? "Approved" : "Rejected";
  const { error } = await db.from("hr_requests").update({ status }).eq("id", id).eq("status", "Pending");
  if (error) return { error: error.message };

  await db.from("audit_log").insert({
    actor: admin.id,
    actor_name: admin.name,
    action: "Request " + status.toLowerCase(),
    detail: `${nameOf(r.profiles as Emb)} · ${r.type} · ${fdate(r.request_date)}`,
  });
  await db.from("notifications").insert({
    employee_id: r.employee_id,
    kind: "hr",
    title: `Your ${r.type} request was ${status.toLowerCase()}`,
    body: fdate(r.request_date),
    link: "/employee/home",
  });
  revalidatePath("/admin/attendance");
  revalidatePath("/admin/dashboard");
  return {};
}