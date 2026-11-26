import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
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
  return (
    <>
      <div className="eyebrow">HR Admin / Scan QR</div>
      <h1>Scan in,<br /><em>scan out.</em></h1>
      <p className="lead">Point the camera at an employee&apos;s QR code. Their first scan of the day clocks them in, the second clocks them out.</p>
      <ScanClient employees={employees} />
    </>
  );
}