"use server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { manilaNow } from "@/lib/dates";
import { contribFor, docName, isIC, periodOf, round2, type Contrib, type Extra } from "@/lib/payroll-calc";

type R = { error?: string };
const today = () => manilaNow().date;
const okNum = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0;
const peso = (n: number) => "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: 2 });
const done = () => {
  revalidatePath("/admin/payroll");
  revalidatePath("/admin/dashboard");
};

export async function savePayslip(input: {
  employeeId: string;
  periodFrom: string;
  salary: number; // monthly salary
  sss: Contrib;
  ph: Contrib;
  pg: Contrib;
  extras: Extra[];
}): Promise<R> {
  const admin = await requireAdmin();
  const db = supabaseAdmin();
  const { employeeId, periodFrom } = input;
  if (!(input.salary > 0)) return { error: "Enter a salary greater than 0." };
  for (const c of [input.sss, input.ph, input.pg]) if (!okNum(c.amt)) return { error: "Contribution amounts must be 0 or more." };
  if (input.extras.some((x) => !okNum(x.amt))) return { error: "Additional pay amounts must be 0 or more." };

  const per = periodOf(periodFrom);
  const { data: run } = await db.from("payroll_runs").select("status").eq("period_from", periodFrom).maybeSingle();
  if (run?.status === "Processed") return { error: "This payslip is locked. Payroll is already processed." };
  const { data: e } = await db.from("profiles").select("full_name, salary_monthly, worker_type").eq("id", employeeId).single();
  if (!e) return { error: "Employee not found." };

  await db.from("payroll_runs").upsert({ period_from: periodFrom, period_to: per.to }, { onConflict: "period_from", ignoreDuplicates: true });

  const newSal = round2(input.salary);
  const oldSal = Number(e.salary_monthly) || 0;
  if (newSal !== oldSal) {
    const { error } = await db.from("profiles").update({ salary_monthly: newSal }).eq("id", employeeId);
    if (error) return { error: error.message };
    await db.from("audit_log").insert({
      actor: admin.id, actor_name: admin.name, action: "Salary updated",
      detail: `${e.full_name} · ${peso(oldSal)} → ${peso(newSal)} per month`,
    });
  }

  const extras = input.extras
    .filter((x) => x.amt > 0)
    .map((x) => ({ label: (x.label || "").trim() || "Additional pay", amt: round2(x.amt), ...(x.hd ? { hd: x.hd } : {}) }));
  const fix = (c: Contrib) => ({ on: !!c.on, amt: round2(c.amt) });
  const sss = fix(input.sss), ph = fix(input.ph), pg = fix(input.pg);
  const def = contribFor(newSal / 2); // contributions are based on the monthly salary, half per cutoff
  const ic = isIC(e);
  const standard =
    (["sss", "ph", "pg"] as const).every((k) => {
      const c = { sss, ph, pg }[k];
      return ic ? !c.on : c.on && Math.abs(c.amt - def[k]) < 0.005;
    }) && extras.length === 0;

  const { error } = standard
    ? await db.from("pay_adjustments").delete().eq("employee_id", employeeId).eq("period_from", periodFrom)
    : await db.from("pay_adjustments").upsert({ employee_id: employeeId, period_from: periodFrom, sss, ph, pg, extras }, { onConflict: "employee_id,period_from" });
  if (error) return { error: error.message };

  await db.from("audit_log").insert({ actor: admin.id, actor_name: admin.name, action: `${docName(e.worker_type)} edited`, detail: `${e.full_name} · ${per.label}` });
  done();
  return {};
}

export async function resetPayslip(employeeId: string, periodFrom: string): Promise<R> {
  const admin = await requireAdmin();
  const db = supabaseAdmin();
  const { data: run } = await db.from("payroll_runs").select("status").eq("period_from", periodFrom).maybeSingle();
  if (run?.status === "Processed") return { error: "This payslip is locked. Payroll is already processed." };
  const { data: e } = await db.from("profiles").select("full_name, worker_type").eq("id", employeeId).single();
  const { error } = await db.from("pay_adjustments").delete().eq("employee_id", employeeId).eq("period_from", periodFrom);
  if (error) return { error: error.message };
  await db.from("audit_log").insert({ actor: admin.id, actor_name: admin.name, action: `${docName(e?.worker_type ?? "")} reset`, detail: `${e?.full_name ?? employeeId} · ${periodOf(periodFrom).label}` });
  done();
  return {};
}

export async function runPayroll(periodFrom: string): Promise<R> {
  const admin = await requireAdmin();
  const db = supabaseAdmin();
  if (periodFrom > today()) return { error: "This pay period hasn't started yet." };
  const per = periodOf(periodFrom);
  const { data: run } = await db.from("payroll_runs").select("status, runs, reopened").eq("period_from", periodFrom).maybeSingle();
  if (run?.status === "Processed") return { error: "Payroll is already processed." };
  const again = (run?.runs ?? 0) > 0;

  const { error } = await db.from("payroll_runs").upsert(
    { period_from: periodFrom, period_to: per.to, status: "Processed", runs: (run?.runs ?? 0) + 1, reopened: run?.reopened ?? 0, processed_at: new Date().toISOString() },
    { onConflict: "period_from" },
  );
  if (error) return { error: error.message };

  const { data: emps } = await db.from("profiles").select("id, worker_type").eq("role", "employee").or(`hired_on.is.null,hired_on.lte.${per.to}`);
  if (emps?.length) {
    await db.from("notifications").insert(
      emps.map((e) => ({
        employee_id: e.id,
        kind: "payslip",
        title: again ? `Corrected ${docName(e.worker_type).toLowerCase()} for ${per.label} is available` : `${docName(e.worker_type)} for ${per.label} is available`,
        body: again ? "HR corrected this and re-ran payroll. Please review the updated amounts." : "Your pay has been calculated from your clock in and clock out.",
        link: "/employee/payslips",
      })),
    );
  }
  await db.from("audit_log").insert({ actor: admin.id, actor_name: admin.name, action: again ? "Payroll run again" : "Payroll run", detail: per.label });
  done();
  return {};
}

export async function reopenPayroll(periodFrom: string): Promise<R> {
  const admin = await requireAdmin();
  const db = supabaseAdmin();
  const { data: run } = await db.from("payroll_runs").select("status, reopened").eq("period_from", periodFrom).maybeSingle();
  if (run?.status !== "Processed") return { error: "This payroll isn't processed." };
  const { error } = await db.from("payroll_runs").update({ status: "Draft", reopened: (run.reopened ?? 0) + 1 }).eq("period_from", periodFrom);
  if (error) return { error: error.message };
  await db.from("audit_log").insert({ actor: admin.id, actor_name: admin.name, action: "Payroll re-opened", detail: `${periodOf(periodFrom).label} · unlocked for corrections` });
  done();
  return {};
}