import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Next Employee ID: HIVE-001, HIVE-002, ... It always uses the LOWEST number not currently taken,
 * so when HIVE-001 is removed, the next new employee gets HIVE-001 again.
 * IDs in other formats (for example HV-001 or TEST-001) are ignored.
 * Used by the create form (to show the upcoming ID) and by createEmployee (to assign it).
 */
export async function nextEmployeeCode(): Promise<string> {
  const { data } = await supabaseAdmin().from("profiles").select("employee_code").ilike("employee_code", "HIVE-%");
  const used = new Set<number>();
  for (const r of data ?? []) {
    const m = /^HIVE-(\d+)$/i.exec(String(r.employee_code ?? ""));
    if (m) used.add(Number(m[1]));
  }
  let n = 1;
  while (used.has(n)) n++;
  return "HIVE-" + String(n).padStart(3, "0");
}