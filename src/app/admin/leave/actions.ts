"use server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";

type R = { error?: string };
const nameOf = (p: unknown) => {
  const x = (Array.isArray(p) ? p[0] : p) as { full_name?: string } | null;
  return x?.full_name ?? "Employee";
};
const fdate = (s: string) =>
  new Date(s + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

export async function decideLeave(id: number, ok: boolean, remarks: string): Promise<R> {
  const admin = await requireAdmin();
  const db = supabaseAdmin();
  const { data: l } = await db
    .from("leave_requests")
    .select("id, employee_id, type, from_date, to_date, status, profiles!employee_id(full_name)")
    .eq("id", id)
    .single();
  if (!l) return { error: "Request not found." };
  if (l.status !== "Pending") return { error: "This request was already decided." };

  const status = ok ? "Approved" : "Rejected";
  const rm = remarks.trim() || (ok ? "Approved by HR" : "Rejected by HR");
  const { error } = await db
    .from("leave_requests")
    .update({ status, hr_remarks: rm, reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "Pending");
  if (error) return { error: error.message };

  const range = `${fdate(l.from_date)} → ${fdate(l.to_date)}`;
  await db.from("audit_log").insert({
    actor: admin.id,
    actor_name: admin.name,
    action: "Leave " + status.toLowerCase(),
    detail: `${nameOf(l.profiles)} · ${l.type} · ${range}`,
  });
  await db.from("notifications").insert({
    employee_id: l.employee_id,
    kind: "leave",
    title: "Leave request " + status.toLowerCase(),
    body: `${l.type} · ${range} — ${rm}`,
    link: "/employee/leave",
  });
  revalidatePath("/admin/leave");
  revalidatePath("/admin/dashboard");
  return {};
}

export async function toggleBonusRule(): Promise<R> {
  const admin = await requireAdmin();
  const db = supabaseAdmin();
  const { data: p } = await db.from("policy").select("allowance_includes_bonus").eq("id", true).single();
  if (!p) return { error: "Policy row not found." };
  const next = !p.allowance_includes_bonus;
  const { error } = await db.from("policy").update({ allowance_includes_bonus: next }).eq("id", true);
  if (error) return { error: error.message };
  await db.from("audit_log").insert({
    actor: admin.id,
    actor_name: admin.name,
    action: "Leave policy changed",
    detail: next ? "Bonus days now count inside the annual allowance" : "Bonus days are now additional to the annual allowance",
  });
  revalidatePath("/admin/leave");
  return {};
}

export async function fileLeave(fd: FormData): Promise<R> {
  const admin = await requireAdmin();
  const emp = String(fd.get("e") ?? "");
  const type = String(fd.get("t") ?? "Vacation");
  const from = String(fd.get("f") ?? "");
  const to = String(fd.get("to") ?? "");
  const why = String(fd.get("why") ?? "").trim();
  if (!emp) return { error: "Choose an employee." };
  if (!["Vacation", "Sick", "Emergency"].includes(type)) return { error: "Choose a leave type." };
  if (!from || !to) return { error: "Choose the start and end dates." };
  if (to < from) return { error: "The end date can't be before the start date." };

  const db = supabaseAdmin();
  const { data: p } = await db.from("profiles").select("full_name").eq("id", emp).single();
  if (!p) return { error: "Employee not found." };

  const { error } = await db.from("leave_requests").insert({
    employee_id: emp,
    type,
    from_date: from,
    to_date: to,
    reason: why || null,
    status: "Approved",
    hr_remarks: "Filed by HR",
    reviewed_by: admin.id,
    reviewed_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };

  const range = `${fdate(from)} → ${fdate(to)}`;
  await db.from("audit_log").insert({
    actor: admin.id,
    actor_name: admin.name,
    action: "Leave filed by HR",
    detail: `${p.full_name} · ${type} · ${range}`,
  });
  await db.from("notifications").insert({
    employee_id: emp,
    kind: "leave",
    title: "HR filed leave for you",
    body: `${type} · ${range}`,
    link: "/employee/leave",
  });
  revalidatePath("/admin/leave");
  revalidatePath("/admin/dashboard");
  return {};
}