import "server-only";
import { BUCKET, PREVIEW_EXT, extOf, requirementsFor, labelFor } from "./doc-types";

/**
 * Labels of required documents the employee hasn't uploaded yet (empty array = all done).
 * Requirements depend on the person's worker_type (employee or contractor).
 * Call it from the setup "finish" action:  const missing = await missingRequiredDocs(sb, user.id);
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function missingRequiredDocs(sb: { from: (t: string) => any }, employeeId: string): Promise<string[]> {
  const [{ data: prof }, { data }] = await Promise.all([
    sb.from("profiles").select("worker_type").eq("id", employeeId).single(),
    sb.from("employee_documents").select("doc_type").eq("employee_id", employeeId),
  ]);
  const required = requirementsFor((prof as { worker_type?: string } | null)?.worker_type).required;
  const have = new Set<string>(((data ?? []) as { doc_type: string }[]).map((d) => d.doc_type));
  return required.filter((k) => !have.has(k)).map(labelFor);
}

/** Signed links (valid 10 minutes) for plain storage paths. Returns { [path]: url }. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function signPaths(sb: any, paths: string[]): Promise<Record<string, string>> {
  const list = [...new Set(paths.filter(Boolean))];
  if (list.length === 0) return {};
  const { data } = await sb.storage.from(BUCKET).createSignedUrls(list, 600);
  const out: Record<string, string> = {};
  for (const s of (data ?? []) as { path: string | null; signedUrl: string | null }[]) if (s.path && s.signedUrl) out[s.path] = s.signedUrl;
  return out;
}

/**
 * Signed preview links (valid 10 minutes) for the rows that are images or PDFs. Returns { [documentId]: url }.
 * Word files have no preview, so they are left out.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function previewUrls(sb: any, rows: { id: string; file_name: string; storage_path: string }[]): Promise<Record<string, string>> {
  const ok = rows.filter((r) => PREVIEW_EXT.includes(extOf(r.file_name)));
  if (ok.length === 0) return {};
  const { data } = await sb.storage.from(BUCKET).createSignedUrls(ok.map((r) => r.storage_path), 600);
  const byPath = new Map<string, string>();
  for (const s of (data ?? []) as { path: string | null; signedUrl: string | null }[]) if (s.path && s.signedUrl) byPath.set(s.path, s.signedUrl);
  const out: Record<string, string> = {};
  for (const r of ok) {
    const u = byPath.get(r.storage_path);
    if (u) out[r.id] = u;
  }
  return out;
}