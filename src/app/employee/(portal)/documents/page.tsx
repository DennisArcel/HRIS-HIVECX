import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { PageHead } from "@/components/employee-ui";
import { DocumentsPanel, type DocRow } from "@/components/DocumentsPanel";

export const dynamic = "force-dynamic";

export default async function EmployeeDocuments() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/signin");

  const { data: rows, error } = await sb
    .from("employee_documents")
    .select("id, doc_type, file_name, size_bytes, created_at, uploaded_by")
    .eq("employee_id", user.id)
    .order("created_at", { ascending: false });

  const docs: DocRow[] = (rows ?? []).map((r) => ({
    id: r.id,
    doc_type: r.doc_type,
    file_name: r.file_name,
    size_bytes: r.size_bytes,
    date: new Date(r.created_at).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric" }),
    by: r.uploaded_by === user.id ? "you" : "HR",
  }));

  return (
    <>
      <PageHead
        eyebrow="Employee / Documents"
        title={<>Your<br /><em>documents.</em></>}
        lead="Upload your resume and other requirements. HR can see everything you add here."
      />
      {error && <p style={{ color: "var(--bad)" }}>Couldn&apos;t load documents: {error.message}</p>}
      <DocumentsPanel employeeId={user.id} docs={docs} />
    </>
  );
}