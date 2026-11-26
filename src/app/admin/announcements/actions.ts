"use server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";

export async function postAnnouncement(fd: FormData): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  const title = String(fd.get("t") ?? "").trim();
  const body = String(fd.get("b") ?? "").trim();
  const pri = String(fd.get("pri") ?? "Normal");
  const priority = ["Normal", "High", "Urgent"].includes(pri) ? pri : "Normal";
  if (!title) return { error: "Enter a title." };
  if (!body) return { error: "Write the announcement message." };

  const db = supabaseAdmin();
  const { error } = await db
    .from("announcements")
    .insert({ title, body, priority, pinned: fd.get("pin") === "on", posted_by: admin.id });
  if (error) return { error: error.message };

  const { data: emps } = await db.from("profiles").select("id").eq("role", "employee");
  if (emps?.length) {
    await db.from("notifications").insert(
      emps.map((e) => ({
        employee_id: e.id,
        kind: "announcement",
        title: "New announcement: " + title,
        body: body.slice(0, 90),
        link: "/employee/home",
      })),
    );
  }
  revalidatePath("/admin/announcements");
  revalidatePath("/employee/home");
  return {};
}