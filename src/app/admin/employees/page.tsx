import { supabaseServer } from "@/lib/supabase/server";
import { CreateEmployeeForm, EmployeeTable } from "./EmployeeTools";
import type { Row } from "@/lib/fmt";
import { nextEmployeeCode } from "@/lib/employee-code";

export const dynamic = "force-dynamic";

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("profiles")
    .select(
      "id, employee_code, full_name, username, email, position, department, worker_type, profile_complete, hired_on, salary_semi, salary_monthly, birthday, phone, address, emergency_contact, shift_id, employment_status",
    )
    .eq("role", "employee")
    .order("employee_code");
  if (error) console.error("[employees page] profiles query failed:", error);

  // shift id → "09:00–18:00", for the Shift column and the profile window
  const { data: sh } = await sb.from("shifts").select("id, start_time, end_time");
  const shifts: Record<string, string> = Object.fromEntries(
    (sh ?? []).map((s) => [s.id as string, `${String(s.start_time).slice(0, 5)}–${String(s.end_time).slice(0, 5)}`]),
  );

  const nextCode = await nextEmployeeCode();

  const all = (data ?? []) as Row[];
  const needle = q.trim().toLowerCase();
  const rows = needle
    ? all.filter((e) =>
        [e.full_name, e.position, e.employee_code, e.username].join(" ").toLowerCase().includes(needle),
      )
    : all;
  const npend = all.filter((e) => !e.profile_complete).length;

  return (
    <>
      <div className="eyebrow">HR Admin / Employees</div>
      <h1>
        Every employee,
        <br />
        <em>one directory.</em>
      </h1>
      <p className="lead">
        Create accounts, share the sign-in details, and let each employee fill in their own personal info on first
        login.
      </p>

      <CreateEmployeeForm nextCode={nextCode} />

      {error && (
        <p className="err-box" style={{ marginTop: 16 }}>
          <span>Couldn&apos;t load the employee list: {error.message}</span>
        </p>
      )}

      <form method="get" className="row mt" style={{ alignItems: "center" }}>
        <input
          name="q"
          defaultValue={q}
          placeholder="Search employees… (press Enter)"
          aria-label="Search employees"
          style={{ maxWidth: 320 }}
        />
        <span className="mut">
          {rows.length} shown{npend ? ` · ${npend} waiting to complete their profile` : ""}
        </span>
      </form>

      <div className="mt">
        <EmployeeTable rows={rows} shifts={shifts} />
      </div>
    </>
  );
}