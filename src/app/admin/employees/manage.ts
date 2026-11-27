"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { randomInt } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { nextEmployeeCode } from "@/lib/employee-code";
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
  ss: z.string().regex(/^\d{2}:\d{2}$/, "Choose the time the shift starts."),
  se: z.string().regex(/^\d{2}:\d{2}$/, "Choose the time the shift ends."),
  pw: z.string().min(6, "Enter a temporary password (at least 6 characters) or click Generate."),
});

// New accounts get their Employee ID automatically, so the create form has no "code" field.
const createSchema = schema.omit({ code: true });

const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const genTemp = () => Array.from({ length: 10 }, () => CHARS[randomInt(CHARS.length)]).join("");

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const PAID_MIN = 8 * 60; // 8 paid hours a day; anything longer in the shift is the unpaid break

/**
 * Finds the shift with these start/end times (Mon–Fri, rest days Sat + Sun) or creates it.
 * Existing shifts ('day' 09:00–18:00, 'mid' 12:00–21:00) are reused, so nothing else in the app changes.
 */
async function shiftIdFor(start: string, end: string): Promise<{ id: string } | { error: string }> {
  const db = supabaseAdmin();
  const { data: found } = await db.from("shifts").select("id, rest_days").eq("start_time", start).eq("end_time", end);
  const same = (found ?? []).find((s) => JSON.stringify([...(s.rest_days ?? [])].sort()) === "[0,6]");
  if (same) return { id: same.id as string };
  const id = `s${start.replace(":", "")}_${end.replace(":", "")}`;
  const { error } = await db
    .from("shifts")
    .upsert({ id, name: `${start}–${end}`, start_time: start, end_time: end, rest_days: [0, 6] }, { onConflict: "id", ignoreDuplicates: true });
  if (error) return { error: "Couldn't save the shift: " + error.message };
  return { id };
}

async function audit(admin: { id: string; name: string }, action: string, detail: string) {
  await supabaseAdmin().from("audit_log").insert({ actor: admin.id, actor_name: admin.name, action, detail });
}

export async function createEmployee(fd: FormData): Promise<Result> {
  const admin = await requireAdmin();
  const parsed = createSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const db = supabaseAdmin();

  // shift: starts at / ends at
  const len = toMin(v.se) - toMin(v.ss);
  if (len <= 0) return { error: "The shift must end later in the same day than it starts. Overnight shifts aren't supported yet." };
  if (len < PAID_MIN) return { error: "A shift must be at least 8 hours long (8 paid hours plus any break)." };
  const shift = await shiftIdFor(v.ss, v.se);
  if ("error" in shift) return { error: shift.error };

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

  // Assign the next free Employee ID. If two accounts are created at the same moment and collide,
  // the unique constraint rejects one of them and we simply pick the next free number and retry.
  let code = "";
  let profErr: { code?: string; message: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    code = await nextEmployeeCode();
    const { error } = await db.from("profiles").insert({
      id: created.user.id,
      employee_code: code,
      full_name: v.n,
      username: v.user,
      email: v.email,
      role: "employee",
      position: v.r,
      salary_monthly: v.s, // HR enters the monthly salary. Hourly rate = monthly ÷ 20 days ÷ 8 hrs
      worker_type: v.ty,
      hired_on: v.j,
      shift_id: shift.id,
      profile_complete: false,
    });
    profErr = error;
    if (!error || !(error.code === "23505" && /employee_code/.test(error.message))) break;
  }
  if (profErr) {
    await db.auth.admin.deleteUser(created.user.id); // roll back so the email isn't left half-registered
    return {
      error:
        profErr.code === "23505"
          ? /employee_code/.test(profErr.message)
            ? "Couldn't assign an Employee ID. Please try again."
            : "That username is already used. Pick another one."
          : "Couldn't save the profile: " + profErr.message,
    };
  }

  await audit(admin, "Employee account created", `${v.n} · ${code} · username ${v.user} · shift ${v.ss}–${v.se}`);
  revalidatePath("/admin/employees");
  revalidatePath("/admin/dashboard");
  return { ok: true, creds: { id: code, name: v.n, user: v.user, pw: v.pw } };
}

const editSchema = schema.omit({ ty: true, pw: true }).extend({
  bd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid birthday.").or(z.literal("")),
  ph: z.string().trim().max(40, "Contact number is too long."),
  addr: z.string().trim().max(200, "Address is too long."),
  ec: z.string().trim().max(120, "Emergency contact is too long."),
});

/** Admin edits an employee's details. Worker type is deliberately not editable here (it is fixed when the account is created). */
export async function updateEmployee(id: string, fd: FormData): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Bad employee id." };
  const parsed = editSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const db = supabaseAdmin();

  const { data: old } = await db
    .from("profiles")
    .select("role, employee_code, full_name, username, email, position, salary_monthly, hired_on, shift_id, birthday, phone, address, emergency_contact")
    .eq("id", id)
    .single();
  if (!old) return { error: "Employee not found." };
  if (old.role !== "employee") return { error: "Only employee accounts can be edited here." };

  if (v.bd && v.bd > new Date().toLocaleDateString("en-CA")) return { error: "The birthday can't be in the future." };
  if (v.code !== old.employee_code) {
    const { data: dupe } = await db.from("profiles").select("id").eq("employee_code", v.code).neq("id", id).maybeSingle();
    if (dupe) return { error: "That Employee ID is already assigned to another employee." };
  }
  const len = toMin(v.se) - toMin(v.ss);
  if (len <= 0) return { error: "The shift must end later in the same day than it starts. Overnight shifts aren't supported yet." };
  if (len < PAID_MIN) return { error: "A shift must be at least 8 hours long (8 paid hours plus any break)." };
  const shift = await shiftIdFor(v.ss, v.se);
  if ("error" in shift) return { error: shift.error };

  const { error: pe } = await db
    .from("profiles")
    .update({
      employee_code: v.code, full_name: v.n, username: v.user, email: v.email, position: v.r,
      salary_monthly: v.s, hired_on: v.j, shift_id: shift.id,
      birthday: v.bd || null, phone: v.ph || null, address: v.addr || null, emergency_contact: v.ec || null,
    })
    .eq("id", id);
  if (pe) {
    return {
      error:
        pe.code === "23505"
          ? /employee_code/.test(pe.message) ? "That Employee ID is already assigned to another employee." : "That username is already used. Pick another one."
          : "Couldn't save the changes: " + pe.message,
    };
  }

  // the sign-in email lives in Supabase Auth too; keep both in step (and undo if Auth refuses)
  if (v.email !== old.email) {
    const { error: ae } = await db.auth.admin.updateUserById(id, { email: v.email, email_confirm: true });
    if (ae) {
      await db.from("profiles").update({ email: old.email }).eq("id", id);
      const dup = (ae as { code?: string }).code === "email_exists" || /already been registered/i.test(ae.message);
      return { error: dup ? "That email is already linked to another account." : `Couldn't change the email: ${ae.message}` };
    }
  }

  const changed = [
    v.code !== old.employee_code && "Employee ID", v.n !== old.full_name && "Name", v.user !== old.username && "Username",
    v.email !== old.email && "Email", v.r !== old.position && "Position", Number(old.salary_monthly ?? 0) !== v.s && "Monthly salary",
    v.j !== old.hired_on && "Date hired", shift.id !== old.shift_id && "Shift", (v.bd || null) !== (old.birthday ?? null) && "Birthday",
    (v.ph || null) !== (old.phone ?? null) && "Contact number", (v.addr || null) !== (old.address ?? null) && "Address",
    (v.ec || null) !== (old.emergency_contact ?? null) && "Emergency contact",
  ].filter(Boolean);
  if (changed.length) await audit(admin, "Employee details edited", `${v.n} · ${v.code} · ${changed.join(", ")}`);
  revalidatePath("/admin/employees");
  revalidatePath("/admin/dashboard");
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