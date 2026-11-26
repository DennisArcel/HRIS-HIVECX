import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { REQUIRED_TYPES, labelFor } from "@/lib/doc-types";

export const dynamic = "force-dynamic";

export default async function AdminDocumentsPage() {
  await requireAdmin();
  const sb = await supabaseServer();
  const [people, docs] = await Promise.all([
    sb.from("profiles").select("id, full_name, role").order("full_name"),
    sb.from("employee_documents").select("employee_id, doc_type"),
  ]);

  const byEmp = new Map<string, string[]>();
  for (const d of docs.data ?? []) byEmp.set(d.employee_id, [...(byEmp.get(d.employee_id) ?? []), d.doc_type]);
  const staff = (people.data ?? []).filter((e) => e.role !== "admin");
  const err = people.error?.message ?? docs.error?.message;

  return (
    <div style={{ maxWidth: 820 }}>
      <div className="fig">HR ADMIN / DOCUMENTS</div>
      <h1 style={{ margin: "8px 0 8px" }}>Employee documents</h1>
      <p className="mut" style={{ marginBottom: 20 }}>
        Resumes, IDs and other files. Open an employee to view, upload or delete their documents.
      </p>
      {err && <p style={{ color: "var(--bad)" }}>Couldn&apos;t load documents: {err}</p>}
      <div className="card">
        {staff.map((e) => {
          const types = byEmp.get(e.id) ?? [];
          const missing = REQUIRED_TYPES.filter((k) => !types.includes(k));
          return (
            <div
              key={e.id}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 0", borderBottom: "1px solid var(--bd, #2a2a2a)" }}
            >
              <span>
                <b>{e.full_name}</b> <span className="mut">· {types.length} file{types.length === 1 ? "" : "s"}</span>
                {missing.length > 0 && (
                  <span className="tag wait" style={{ marginLeft: 10 }}>Missing: {missing.map(labelFor).join(", ")}</span>
                )}
              </span>
              <Link
                href={`/admin/documents/${e.id}`}
                style={{ border: "1px solid var(--bd, #333)", color: "var(--tx)", padding: "8px 16px", borderRadius: 999, textDecoration: "none", fontSize: 14 }}
              >
                Manage documents
              </Link>
            </div>
          );
        })}
        {!err && staff.length === 0 && <p className="mut">No employees found.</p>}
      </div>
    </div>
  );
}