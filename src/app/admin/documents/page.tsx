import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { WORKER_LABEL, normalizeWorker } from "@/lib/doc-types";
import { signPaths } from "@/lib/documents";
import { DocStyles } from "@/components/DocStyles";

export const dynamic = "force-dynamic";

export default async function AdminDocumentsPage() {
  await requireAdmin();
  const sb = await supabaseServer();
  const [people, docs] = await Promise.all([
    sb.from("profiles").select("id, full_name, role, worker_type, avatar_path").order("full_name"),
    sb.from("employee_documents").select("employee_id"),
  ]);

  const count = new Map<string, number>();
  for (const d of docs.data ?? []) count.set(d.employee_id, (count.get(d.employee_id) ?? 0) + 1);
  const staff = (people.data ?? []).filter((e) => e.role !== "admin");
  const err = people.error?.message ?? docs.error?.message;

  const urls = await signPaths(sb, staff.map((e) => e.avatar_path as string).filter(Boolean));

  return (
    <div style={{ maxWidth: 1100 }}>
      <DocStyles />
      <div className="fig">HR ADMIN / DOCUMENTS</div>
      <h1 style={{ margin: "8px 0 8px" }}>Employee documents</h1>
      <p className="mut" style={{ marginBottom: 20 }}>Open an employee to view, upload or delete their documents.</p>
      {err && <p style={{ color: "var(--bad)" }}>Couldn&apos;t load documents: {err}</p>}

      <div className="dc-grid">
        {staff.map((e, i) => {
          const url = e.avatar_path ? urls[e.avatar_path] : undefined;
          const n = count.get(e.id) ?? 0;
          return (
            <div key={e.id} className="dc-card" style={{ animationDelay: `${i * 70}ms` }}>
              <div className="dc-prev sq dc-photo">
                {url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={url} alt={e.full_name} />}
                {!url && (
                  <div className="dc-empty">
                    <div className="dc-avatar">{(e.full_name ?? "?").trim().charAt(0).toUpperCase()}</div>
                    <span>No profile picture yet</span>
                  </div>
                )}
              </div>
              <div className="dc-body">
                <div className="dc-title">
                  <b style={{ fontSize: 16 }}>{e.full_name}</b>
                  <span className="tag">{WORKER_LABEL[normalizeWorker(e.worker_type)]}</span>
                </div>
                <span className="mut" style={{ fontSize: 13 }}>{n} file{n === 1 ? "" : "s"} uploaded</span>
                <Link href={`/admin/documents/${e.id}`} className="dc-btn">Manage documents</Link>
              </div>
            </div>
          );
        })}
      </div>
      {!err && staff.length === 0 && <p className="mut">No employees found.</p>}
    </div>
  );
}