import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signPaths } from "@/lib/documents";
import { Chat, type Emp, type Sent, type Reply } from "./Chat";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  await requireAdmin();
  const db = supabaseAdmin();

  const [{ data: emps }, { data: sent, error }, { data: reps }] = await Promise.all([
    db.from("profiles").select("*").eq("role", "employee").order("employee_code"),
    db.from("notifications").select("id, employee_id, title, body, read, created_at").eq("kind", "hr")
      .order("created_at", { ascending: false }).limit(500),
    db.from("hr_replies").select("id, employee_id, body, read, created_at")
      .order("created_at", { ascending: false }).limit(1000),
  ]);

  // profile photos: profiles.avatar_path -> signed URLs (same source as the employee's My Profile page)
  const paths = (emps ?? []).map((e) => e.avatar_path as string | null).filter((x): x is string => !!x);
  const urls = (paths.length ? await signPaths(db, paths) : {}) as Record<string, string | undefined>;

  const employees: Emp[] = (emps ?? []).map((e) => ({
    id: e.id as string,
    name: e.full_name as string,
    code: e.employee_code as string,
    avatar: e.avatar_path ? urls[e.avatar_path as string] ?? null : null,
  }));
  const messages: Sent[] = (sent ?? []).map((m) => ({
    id: String(m.id),
    employee_id: m.employee_id as string,
    title: (m.title as string) ?? "",
    body: m.body as string,
    read: !!m.read,
    created_at: m.created_at as string,
  }));
  const replies: Reply[] = (reps ?? []).map((r) => ({
    id: String(r.id),
    employee_id: r.employee_id as string,
    body: r.body as string,
    read: !!r.read,
    created_at: r.created_at as string,
  }));

  return (
    <>
      <div className="eyebrow">HR Admin / Messages</div>
      <h1>
        Direct messages,
        <br />
        <em>one employee at a time.</em>
      </h1>
      <p className="lead">Pick an employee, write a message, and see their replies and when it has been read.</p>

      {error && (
        <p className="err-box" style={{ marginTop: 16 }}>
          <span>Couldn&apos;t load sent messages: {error.message}</span>
        </p>
      )}

      <Chat employees={employees} sent={messages} replies={replies} />
    </>
  );
}