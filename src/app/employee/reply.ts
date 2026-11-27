"use server";
import { revalidatePath } from "next/cache";
import { getPortal } from "@/lib/employee-data";

/** Employee -> HR reply. The employee id always comes from the session, never from the browser. */
export async function sendReply(body: string): Promise<{ error: string } | { ok: true }> {
  const p = await getPortal();
  const text = String(body ?? "").trim();
  if (!text) return { error: "Write a message." };
  if (text.length > 1000) return { error: "The message is too long (1000 characters max)." };
  const { error } = await p.sb.from("hr_replies").insert({ employee_id: p.user.id, body: text });
  if (error) return { error: "Couldn't send your reply: " + error.message };
  revalidatePath("/admin/messages");
  return { ok: true };
}
