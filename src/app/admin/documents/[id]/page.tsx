import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { DocumentsPanel, type DocRow } from "@/components/DocumentsPanel";

export const dynamic = "force-dynamic";

export default async function EmployeeDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const sb = await supabaseServer();

  const { data: emp } = await sb.from("profiles").select("id, full_name").eq("id", id).single();
  if (!emp) notFound();

  const { data: rows, error } = await sb
    .from("employee_documents")
    .select("id, doc_type, file_name, size_bytes, created_at, uploaded_by")
    .eq("employee_id", id)
    .order("created_at", { ascending: false });

  const docs: DocRow[] = (rows ?? []).map((r) => ({
    id: r.id,
    doc_type: r.doc_type,
    file_name: r.file_name,
    size_bytes: r.size_bytes,
    date: new Date(r.created_at).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric" }),
    by: r.uploaded_by === id ? "employee" : "HR",
  }));

  return (
    <div style={{ maxWidth: 820 }}>
      <p style={{ margin: "0 0 14px" }}>
        <Link
          href="/admin/documents"
          style={{ display: "inline-block", border: "1px solid var(--bd, #333)", color: "var(--tx)", padding: "8px 16px", borderRadius: 999, textDecoration: "none", fontSize: 14 }}
        >
          ← Back
        </Link>
      </p>
      <div className="fig">HR ADMIN / DOCUMENTS</div>
      <h1 style={{ margin: "8px 0 20px" }}>{emp.full_name}</h1>
      {error && <p style={{ color: "var(--bad)" }}>Couldn&apos;t load documents: {error.message}</p>}
      <DocumentsPanel employeeId={id} docs={docs} admin />
    </div>
  );
}