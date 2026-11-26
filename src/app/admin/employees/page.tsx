import { supabaseServer } from "@/lib/supabase/server";
import { CreateEmployeeForm, EmployeeTable } from "./EmployeeTools";
import type { Row } from "@/lib/fmt";

export const dynamic = "force-dynamic";

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const sb = await supabaseServer();
  const { data } = await sb
    .from("profiles")
    .select(
      "id, employee_code, full_name, username, email, position, department, worker_type, profile_complete, hired_on, salary_semi, birthday, phone, address, emergency_contact, shift_id, employment_status",
    )
    .eq("role", "employee")
    .order("employee_code");

  const all = (data ?? []) as Row[];
  const needle = q.trim().toLowerCase();
  const rows = needle
    ? all.filter((e) =>
        [e.full_name, e.position, e.department, e.employee_code, e.username].join(" ").toLowerCase().includes(needle),
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

      <CreateEmployeeForm />

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
        <EmployeeTable rows={rows} />
      </div>
    </>
  );
}