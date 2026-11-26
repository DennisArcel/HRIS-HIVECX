"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPortal, loadCtx } from "@/lib/employee-data";
import { bal, leaveDays, POLICY } from "@/lib/employee-calc";
import { supabaseServer } from "@/lib/supabase/server";

export type Result = { ok: boolean; msg: string };
const fail = (msg: string): Result => ({ ok: false, msg });
const done = (msg: string, path?: string): Result => { if (path) revalidatePath(path); return { ok: true, msg }; };
const digits = (s: string) => s.replace(/\D/g, "");
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Every action re-reads the user from the session. The employee id is NEVER taken from the form. */

/* ---------------- leave ---------------- */
export async function submitLeave(f: FormData): Promise<Result> {
  const p = await getPortal();
  const type = str(f, "t"), from = str(f, "f"), to = str(f, "to"), why = str(f, "why").slice(0, 500);
  if (!["Vacation", "Sick", "Emergency"].includes(type)) return fail("Choose a leave type.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return fail("Choose your start and end dates.");
  if (from < p.today) return fail("The start date can't be in the past.");
  if (to < from) return fail("The end date can't be before the start date.");
  const ctx = await loadCtx(p);
  const days = leaveDays(from, to, ctx.shift, ctx.hols);
  if (days < 1) return fail("Those dates are all rest days or holidays — nothing to file.");
  const overlap = ctx.leaves.some((l) => ["Pending", "Approved"].includes(l.status) && from <= l.to_date && l.from_date <= to);
  if (overlap) return fail("You already have a leave request covering some of these dates.");
  const b = bal(ctx);
  if (type === "Vacation" && days > b.remaining) return fail(`You only have ${b.remaining} day(s) available; this request needs ${days}.`);
  const { error } = await p.sb.from("leave_requests").insert({
    employee_id: p.user.id, type, from_date: from, to_date: to, reason: why || null, status: "Pending",
  });
  if (error) return fail("Could not submit the request. Please try again.");
  await p.sb.from("audit_log").insert({ actor: p.user.id, actor_name: p.me.full_name, action: "Leave requested", detail: `${type} · ${from} → ${to} · ${days} day(s)` });
  return done(`Leave request submitted (${days} day${days === 1 ? "" : "s"}) — waiting on HR.`, "/employee/leave");
}

/* ---------------- attendance correction ---------------- */
const FIX_TYPES = ["Forgot to Clock In", "Forgot to Clock Out", "Incorrect Clock In", "Incorrect Clock Out"];
export async function submitFix(f: FormData): Promise<Result> {
  const p = await getPortal();
  const d = str(f, "d"), ty = str(f, "ty"), time = str(f, "time"), why = str(f, "why").slice(0, 500);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return fail("Choose the date of the attendance record.");
  if (d > p.today) return fail("The attendance date can't be in the future.");
  if (d < POLICY.dataStart) return fail("Attendance records start from June 1, 2026.");
  if (d < p.me.hired_on) return fail("That date is before your hire date.");
  if (!FIX_TYPES.includes(ty)) return fail("Choose a correction type.");
  if (!/^\d{2}:\d{2}$/.test(time)) return fail("Enter the requested time.");
  if (why.length < 5) return fail("Please give a short reason (at least 5 characters).");
  const { data: dup } = await p.sb.from("attendance_corrections").select("id").eq("employee_id", p.user.id).eq("work_date", d).eq("status", "Pending").limit(1);
  if (dup?.length) return fail("You already have a pending correction for that date.");
  const { error } = await p.sb.from("attendance_corrections").insert({
    employee_id: p.user.id, work_date: d, type: ty, requested_time: time, reason: why, status: "Pending",
  });
  if (error) return fail("Could not submit the request. Please try again.");
  await p.sb.from("audit_log").insert({ actor: p.user.id, actor_name: p.me.full_name, action: "Correction requested", detail: `${ty} · ${d} · ${time}` });
  return done("Correction request sent to HR.", "/employee/attendance");
}

/* ---------------- profile ---------------- */
export async function updateContact(f: FormData): Promise<Result> {
  const p = await getPortal();
  const phone = str(f, "ph"), email = str(f, "email"), addr = str(f, "addr"), ec = str(f, "ec");
  if (!phone) return fail("Contact number is required.");
  if (!z.string().email().safeParse(email).success) return fail("Enter a valid email address.");
  if (!addr) return fail("Address is required.");
  if (!ec) return fail("Emergency contact is required.");
  const { error } = await p.sb.from("profiles").update({ phone, address: addr, emergency_contact: ec }).eq("id", p.user.id);
  if (error) return fail("Could not save your details.");
  if (email !== p.me.email) {
    const r = await p.sb.auth.updateUser({ email });
    if (r.error) return fail("Details saved, but the email could not be changed: " + r.error.message);
    await p.sb.from("profiles").update({ email }).eq("id", p.user.id);
  }
  return done("Contact details updated.", "/employee/profile");
}

const pwRules = (pw: string) =>
  pw.length < 8 ? "The new password must be at least 8 characters."
  : !/[a-zA-Z]/.test(pw) || !/\d/.test(pw) ? "Include at least one letter and one number."
  : null;

export async function changePassword(f: FormData): Promise<Result> {
  const p = await getPortal();
  const cur = String(f.get("cur") ?? ""), next = String(f.get("new") ?? ""), rep = String(f.get("rep") ?? "");
  if (!cur) return fail("Enter your current password.");
  const rule = pwRules(next); if (rule) return fail(rule);
  if (next !== rep) return fail("The new passwords don't match.");
  if (next === cur) return fail("Choose a password different from your current one.");
  const sb = await supabaseServer();
  const chk = await sb.auth.signInWithPassword({ email: p.user.email!, password: cur });
  if (chk.error) return fail("Your current password is incorrect.");
  const up = await sb.auth.updateUser({ password: next });
  if (up.error) return fail(up.error.message);
  return done("Password updated successfully.", "/employee/profile");
}

export async function signOutOthers(): Promise<Result> {
  const sb = await supabaseServer();
  const { error } = await sb.auth.signOut({ scope: "others" });
  return error ? fail("Could not sign out other sessions.") : done("Other sessions signed out.");
}

export async function signOut() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/signin");
}

/* ---------------- notifications ---------------- */
export async function markRead(id: string) {
  const p = await getPortal();
  await p.sb.from("notifications").update({ read: true }).eq("id", id).eq("employee_id", p.user.id);
  revalidatePath("/employee", "layout");
}
export async function markAllRead() {
  const p = await getPortal();
  await p.sb.from("notifications").update({ read: true }).eq("employee_id", p.user.id).eq("read", false);
  revalidatePath("/employee", "layout");
}

/* ---------------- first-login setup ---------------- */
export async function completeSetup(f: FormData): Promise<Result> {
  const p = await getPortal();
  if (p.me.profile_complete) redirect("/employee/home");
  if (!f.get("ok")) return fail("Please confirm that the details HR entered are correct.");
  const bd = str(f, "bd"), ph = str(f, "ph"), addr = str(f, "addr"), ecn = str(f, "ecn"), ecp = str(f, "ecp");
  const pw = String(f.get("new") ?? ""), rep = String(f.get("rep") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bd) || bd > p.today) return fail("Enter a valid birthday.");
  const age = +p.today.slice(0, 4) - +bd.slice(0, 4) - (p.today.slice(5) < bd.slice(5) ? 1 : 0);
  if (age < 15) return fail("That birthday doesn't look right — please check the date.");
  if (digits(ph).length < 10 || digits(ph).length > 13) return fail("Enter a valid contact number (10–13 digits).");
  if (addr.length < 5) return fail("Enter your home address.");
  if (ecn.length < 2) return fail("Enter your emergency contact's name.");
  if (digits(ecp).length < 7 || digits(ecp).length > 13) return fail("Enter a valid emergency contact number.");
  const rule = pwRules(pw); if (rule) return fail(rule);
  if (pw !== rep) return fail("The two passwords don't match.");
  // 1) save the personal details FIRST, so a bad column can never leave the password changed but the profile unsaved
  const det = await p.sb.from("profiles").update({
    birthday: bd, phone: ph, address: addr, emergency_contact: `${ecn} · ${ecp}`,
  }).eq("id", p.user.id);
  if (det.error) {
    console.error("[completeSetup] profile update failed:", det.error);
    return fail("Could not save your details" + (process.env.NODE_ENV !== "production" ? `: ${det.error.message}` : ". Please try again."));
  }
  // 2) password (a "same password" reply means an earlier attempt already set it, which is fine)
  const up = await p.sb.auth.updateUser({ password: pw });
  if (up.error && !/different|same/i.test(up.error.message)) return fail(up.error.message);
  // 3) mark complete (this is what the middleware checks), then best-effort timestamp
  const fin = await p.sb.from("profiles").update({ profile_complete: true }).eq("id", p.user.id);
  if (fin.error) {
    console.error("[completeSetup] profile_complete update failed:", fin.error);
    return fail("Could not finish setup" + (process.env.NODE_ENV !== "production" ? `: ${fin.error.message}` : ". Please try again."));
  }
  await p.sb.from("audit_log").insert({ actor: p.user.id, actor_name: p.me.full_name, action: "Profile completed", detail: `${p.me.employee_no ?? p.user.id} finished first sign-in setup` });
  await p.sb.from("notifications").insert({ employee_id: p.user.id, kind: "hr", title: `Welcome to Hive, ${p.me.full_name.split(" ")[0]}`, body: "Your profile is complete. Leave, attendance and payslips are now available.", link: "/employee/home" });
  redirect("/employee/home");
}