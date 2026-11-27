import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { manilaNow } from "@/lib/dates";
import { ScanClient } from "./ScanClient";

export const dynamic = "force-dynamic";

export default async function AdminScan() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/signin");
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/employee/home");
  const { data } = await sb.from("profiles").select("id, full_name, employee_code").eq("role", "employee").order("full_name");
  const employees = (data ?? []).map((e) => ({ id: e.id as string, name: e.full_name as string, no: (e.employee_code ?? null) as string | null }));

  // Today's successful scans, rebuilt from the attendance table so the list survives leaving the tab or refreshing.
  const { date } = manilaNow();
  const nameOf = new Map(employees.map((e) => [e.id, e.name]));
  const { data: rows } = await sb.from("attendance").select("employee_id, time_in, time_out").eq("work_date", date);
  const initialLog = (rows ?? []).flatMap((r) => {
    const name = nameOf.get(r.employee_id as string);
    if (!name) return [];
    const out: { ok: boolean; msg: string; t: string }[] = [];
    if (r.time_in) out.push({ ok: true, msg: `${name} clocked IN at ${String(r.time_in).slice(0, 5)}`, t: String(r.time_in).slice(0, 5) });
    if (r.time_out) out.push({ ok: true, msg: `${name} clocked OUT at ${String(r.time_out).slice(0, 5)}`, t: String(r.time_out).slice(0, 5) });
    return out;
  }).sort((a, b) => (a.t < b.t ? 1 : -1)).slice(0, 50);

  return (
    <>
      <div className="eyebrow">HR Admin / Scan QR</div>
      <h1>Scan in,<br /><em>scan out.</em></h1>
      <p className="lead">Point the camera at an employee&apos;s QR code. Their first scan of the day clocks them in, the second clocks them out.</p>
      <ScanClient employees={employees} initialLog={initialLog} />
    </>
  );
}