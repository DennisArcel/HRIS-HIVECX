import { getPortal, loadNotifications } from "@/lib/employee-data";
import { signPaths } from "@/lib/documents";
import { MessagesList, type Reply } from "./MessagesList";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const p = await getPortal();
  const [all, rep, prof] = await Promise.all([
    loadNotifications(p, 100),
    p.sb.from("hr_replies").select("id, body, read, created_at").eq("employee_id", p.user.id)
      .order("created_at", { ascending: false }).limit(200),
    p.sb.from("profiles").select("avatar_path").eq("id", p.user.id).single(),
  ]);
  const path = prof.data?.avatar_path as string | null | undefined;
  const photo = path ? ((await signPaths(p.sb, [path])) as Record<string, string | undefined>)[path] ?? null : null;
  const msgs = all.filter((n) => n.kind === "hr"); // direct messages sent by HR
  const replies: Reply[] = (rep.data ?? []).map((r) => ({
    id: String(r.id), body: r.body as string, read: !!r.read, created_at: r.created_at as string,
  }));

  return (
    <>
      <div className="eyebrow">My workspace / Messages</div>
      <h1>
        Messages
        <br />
        <em>from HR.</em>
      </h1>
      <p className="lead">Chat with HR here. Their messages also show in the bell at the top.</p>
      <MessagesList
        msgs={msgs}
        replies={replies}
        me={{ name: p.me.full_name, avatar: photo }}
      />
    </>
  );
}