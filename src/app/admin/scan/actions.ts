"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { makeToken } from "@/lib/qr";

/** Test helper for the "Simulate a scan" box: returns a fresh signed code for the chosen employee. Admin-only. */
export async function simulateToken(employeeId: string): Promise<{ ok: boolean; text?: string; msg?: string }> {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, msg: "Unauthorized" };
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return { ok: false, msg: "Forbidden" };
  const { data: emp } = await sb.from("profiles").select("id").eq("id", employeeId).eq("role", "employee").maybeSingle();
  if (!emp) return { ok: false, msg: "Unknown employee" };
  return { ok: true, text: makeToken(emp.id) };
}
