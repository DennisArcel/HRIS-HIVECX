"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { randomInt } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import type { Creds } from "@/lib/fmt";

type Result = { error: string } | { ok: true; creds: Creds };

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Enter the Employee ID.")
    .regex(/^[A-Za-z0-9._-]{1,20}$/, "Employee ID can only use letters, numbers, dots, dashes or underscores."),
  n: z.string().trim().min(1, "Enter the employee's full name."),
  email: z.string().trim().toLowerCase().email("Enter a valid work email address."),
  user: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,}$/, "Username needs at least 3 characters: letters, numbers, dots, dashes or underscores only."),
  r: z.string().trim().min(1, "Enter a position."),
  s: z.coerce.number().positive("Enter a valid monthly salary."),
  ty: z.enum(["Employee", "Independent contractor"]),
  j: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date hired."),
  pw: z.string().min(6, "Enter a temporary password (at least 6 characters) or click Generate."),
});

const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const genTemp = () => Array.from({ length: 10 }, () => CHARS[randomInt(CHARS.length)]).join("");

async function audit(admin: { id: string; name: string }, action: string, detail: string) {
  await supabaseAdmin().from("audit_log").insert({ actor: admin.id, actor_name: admin.name, action, detail });
}

export async function createEmployee(fd: FormData): Promise<Result> {
  const admin = await requireAdmin();
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const db = supabaseAdmin();

  // Employee ID is typed in by HR
  const code = v.code;
  const { data: dupe } = await db.from("profiles").select("id").eq("employee_code", code).maybeSingle();
  if (dupe) return { error: "That Employee ID is already assigned to another employee." };

  const { data: created, error: authErr } = await db.auth.admin.createUser({
    email: v.email,
    password: v.pw,
    email_confirm: true,
  });
  if (authErr || !created?.user) {
    console.error("[createEmployee] auth error:", authErr);
    const errCode = (authErr as { code?: string } | null)?.code;
    const dup = errCode === "email_exists" || /already been registered/i.test(authErr?.message ?? "");
    return {
      error: dup
        ? "That email is already linked to another account."
        : `Couldn't create the account: ${authErr?.message ?? "unknown error"}`,
    };
  }

  const { error: profErr } = await db.from("profiles").insert({
    id: created.user.id,
    employee_code: code,
    full_name: v.n,
    username: v.user,
    email: v.email,
    role: "employee",
    position: v.r,
    salary_semi: Math.round((v.s / 2) * 100) / 100, // HR enters monthly; stored per cutoff
    worker_type: v.ty,
    hired_on: v.j,
    profile_complete: false,
  });
  if (profErr) {
    await db.auth.admin.deleteUser(created.user.id); // roll back so the email isn't left half-registered
    return {
      error:
        profErr.code === "23505"
          ? /employee_code/.test(profErr.message)
            ? "That Employee ID is already assigned to another employee."
            : "That username is already used. Pick another one."
          : "Couldn't save the profile: " + profErr.message,
    };
  }

  await audit(admin, "Employee account created", `${v.n} · ${code} · username ${v.user}`);
  revalidatePath("/admin/employees");
  revalidatePath("/admin/dashboard");
  return { ok: true, creds: { id: code, name: v.n, user: v.user, pw: v.pw } };
}

export async function setWorkerType(id: string, ty: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  const type = ty === "Independent contractor" ? "Independent contractor" : "Employee";
  const { data, error } = await supabaseAdmin()
    .from("profiles")
    .update({ worker_type: type })
    .eq("id", id)
    .select("full_name")
    .single();
  if (error) return { error: error.message };
  await audit(admin, "Worker type changed", `${data.full_name} → ${type}`);
  revalidatePath("/admin/employees");
  return {};
}

export async function removeEmployee(id: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (id === admin.id) return { error: "You can't remove your own account." };
  const db = supabaseAdmin();
  const { data: p } = await db.from("profiles").select("full_name, employee_code").eq("id", id).single();
  const { error } = await db.auth.admin.deleteUser(id); // profile and records cascade
  if (error) return { error: error.message };
  await audit(admin, "Employee removed", p ? `${p.full_name} · ${p.employee_code}` : id);
  revalidatePath("/admin/employees");
  revalidatePath("/admin/dashboard");
  return {};
}

/** Supabase stores only a hash, so a lost temporary password can't be read back; issue a new one. */
export async function resetTempPassword(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const db = supabaseAdmin();
  const { data: p } = await db
    .from("profiles")
    .select("full_name, employee_code, username, profile_complete")
    .eq("id", id)
    .single();
  if (!p) return { error: "Employee not found." };
  if (p.profile_complete) return { error: "This employee already set their own password." };
  const pw = genTemp();
  const { error } = await db.auth.admin.updateUserById(id, { password: pw });
  if (error) return { error: error.message };
  await audit(admin, "Temporary password reset", `${p.full_name} · ${p.employee_code}`);
  return { ok: true, creds: { id: p.employee_code, name: p.full_name, user: p.username, pw } };
}