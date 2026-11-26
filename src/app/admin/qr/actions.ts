"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

/** Admin only. Replaces an employee's badge QR (use when a badge is lost). The old QR stops matching. */
export async function regenerateQr(employeeId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    if (!/^[0-9a-f-]{36}$/i.test(employeeId)) return { ok: false, error: "Bad id" };
    const sb = await supabaseServer();
    const { data, error } = await sb.from("profiles").select("qr_version").eq("id", employeeId).single();
    if (error || !data) return { ok: false, error: error?.message ?? "Employee not found" };
    const { error: e2 } = await sb
      .from("profiles")
      .update({ qr_version: (data.qr_version ?? 0) + 1 })
      .eq("id", employeeId);
    if (e2) return { ok: false, error: e2.message };
    revalidatePath("/admin/qr");
    revalidatePath("/admin/qr/print");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
  }
}