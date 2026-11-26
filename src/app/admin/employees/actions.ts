"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { manilaNow } from "@/lib/dates";

const schema = z.object({
  name: z.string().trim().min(1, "Enter the employee's full name."),
  email: z.string().trim().email("Enter a valid work email address."),
  username: z.string().trim().regex(/^[a-zA-Z0-9._-]{3,}$/, "Username needs 3+ characters: letters, numbers, dots, dashes or underscores."),
  position: z.string().trim().min(1, "Enter a position."),
  department: z.string().trim().min(1),
  salarySemi: z.coerce.number().positive("Enter a valid semi-monthly salary."),
  workerType: z.enum(["Employee", "Independent contractor"]),
  hiredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date hired."),
  tempPassword: z.string().min(8, "The temporary password must be at least 8 characters."),
});

export async function createEmployee(_: unknown, fd: FormData): Promise<{ error?: string; created?: { code: string; username: string } }> {
  // 1. verify the CALLER is an admin (never trust the form or the page that rendered it)
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: me } = user ? await sb.from("profiles").select("role, full_name").eq("id", user.id).single() : { data: null };
  if (me?.role !== "admin") return { error: "Only HR admins can create accounts." };

  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const v = p.data;
  if (v.hiredOn < manilaNow().date) return { error: "Date hired can't be in the past: attendance and leave start counting from this date." };

  // 2. service-role from here: create the auth user + profile
  const db = supabaseAdmin();
  const { data: last } = await db.from("profiles").select("employee_code").like("employee_code", "HV-%").order("employee_code", { ascending: false }).limit(1);
  const code = "HV-" + String((parseInt(last?.[0]?.employee_code.slice(3) ?? "0", 10) || 0) + 1).padStart(3, "0");

  const { data: created, error } = await db.auth.admin.createUser({ email: v.email, password: v.tempPassword, email_confirm: true });
  if (error || !created.user) return { error: /already/i.test(error?.message ?? "") ? "That email is already linked to another account." : "Could not create the account." };

  const { error: pe } = await db.from("profiles").insert({
    id: created.user.id, employee_code: code, full_name: v.name, username: v.username, email: v.email, role: "employee",
    position: v.position, department: v.department, salary_semi: v.salarySemi, worker_type: v.workerType,
    hired_on: v.hiredOn, profile_complete: false,
  });
  if (pe) {
    await db.auth.admin.deleteUser(created.user.id);                       // roll back: no orphaned login
    return { error: /username/.test(pe.message) ? "That username is already used: pick another one." : "Could not save the employee record." };
  }
  await db.from("audit_log").insert({ actor: user!.id, actor_name: me.full_name, action: "Employee account created", detail: `${v.name} · ${code} · username ${v.username}` });
  revalidatePath("/admin/employees");
  return { created: { code, username: v.username } };
}
