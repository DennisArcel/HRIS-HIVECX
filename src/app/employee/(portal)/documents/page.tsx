import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { PageHead } from "@/components/employee-ui";
import { DocumentsPanel, type DocRow } from "@/components/DocumentsPanel";
import { previewUrls, signPaths } from "@/lib/documents";
import { AvatarUploader } from "@/components/AvatarUploader";

export const dynamic = "force-dynamic";

export default async function EmployeeDocuments() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/signin");

  const [{ data: prof }, { data: rows, error }] = await Promise.all([
    sb.from("profiles").select("worker_type, full_name, avatar_path").eq("id", user.id).single(),
    sb
      .from("employee_documents")
      .select("id, doc_type, file_name, size_bytes, created_at, uploaded_by, storage_path")
      .eq("employee_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const previews = await previewUrls(sb, rows ?? []);
  const avatar = prof?.avatar_path ? (await signPaths(sb, [prof.avatar_path]))[prof.avatar_path] : undefined;

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
        lead="Upload each requirement below. HR can see everything you add here."
      />
      <div style={{ margin: "0 0 20px" }}><AvatarUploader employeeId={user.id} name={prof?.full_name ?? ""} url={avatar} /></div>
      {error && <p style={{ color: "var(--bad)" }}>Couldn&apos;t load documents: {error.message}</p>}
      <DocumentsPanel employeeId={user.id} docs={docs} previews={previews} workerType={prof?.worker_type} />
    </>
  );
}