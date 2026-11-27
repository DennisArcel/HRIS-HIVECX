"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";

const schema = z.object({
  to: z.string().min(1, "Choose an employee to message."),
  title: z.string().trim().min(1, "Enter a subject.").max(80, "The subject is too long (80 characters max)."),
  body: z.string().trim().min(1, "Write a message.").max(1000, "The message is too long (1000 characters max)."),
});

/**
 * Admin -> one employee (direct message). It is stored as a notification of kind "hr",
 * so it shows in that employee's bell with an unread count.
 */
export async function sendMessage(fd: FormData): Promise<{ error: string } | { ok: true }> {
  const admin = await requireAdmin();
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  if (!/^[0-9a-f-]{36}$/i.test(v.to)) return { error: "Bad employee id." };
  const db = supabaseAdmin();

  const { data: emp } = await db
    .from("profiles").select("id, full_name, employee_code").eq("id", v.to).eq("role", "employee").maybeSingle();
  if (!emp) return { error: "Employee not found." };

  const { error } = await db
    .from("notifications")
    .insert({ employee_id: emp.id, kind: "hr", title: v.title, body: v.body, link: null, read: false });
  if (error) return { error: "Couldn't send the message: " + error.message };

  await db.from("audit_log").insert({
    actor: admin.id,
    actor_name: admin.name,
    action: "Message sent",
    detail: `${emp.full_name} · ${emp.employee_code} · ${v.title}`,
  });
  revalidatePath("/admin/employees");
  return { ok: true };
}
/** Admin opened a conversation: mark that employee's replies as read (drives the unread badge and the employee's ✓✓). */
export async function markRepliesRead(employeeId: string): Promise<void> {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(employeeId)) return;
  await supabaseAdmin().from("hr_replies").update({ read: true }).eq("employee_id", employeeId).eq("read", false);
  revalidatePath("/admin/messages");
}