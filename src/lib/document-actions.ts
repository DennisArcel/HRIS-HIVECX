"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { ALLOWED_EXT, BUCKET, MAX_BYTES, isDocType } from "./doc-types";

type Res = { ok: true } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

async function caller() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).single();
  return { sb, id: user.id, admin: me?.role === "admin" };
}

/** Employees can upload to their own record; admins can upload for anyone. */
export async function uploadDocument(fd: FormData): Promise<Res> {
  try {
    const me = await caller();
    if (!me) return fail("Not signed in");

    const employeeId = String(fd.get("employeeId") ?? "");
    const docType = String(fd.get("docType") ?? "");
    const file = fd.get("file") as File | null;

    if (!/^[0-9a-f-]{36}$/i.test(employeeId)) return fail("Bad employee");
    if (!me.admin && employeeId !== me.id) return fail("Not allowed");
    if (!isDocType(docType)) return fail("Choose a document type");
    if (!file || typeof file !== "object" || !("arrayBuffer" in file) || file.size === 0) return fail("Choose a file to upload");
    if (file.size > MAX_BYTES) return fail("That file is over 5 MB");

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXT.includes(ext)) return fail("Allowed files: PDF, Word, JPG or PNG");

    const safe = file.name.replace(/[^\w.\- ]+/g, "_").slice(-100);
    const path = `${employeeId}/${randomUUID()}-${safe}`;

    const { error: upErr } = await me.sb.storage
      .from(BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type || "application/octet-stream" });
    if (upErr) return fail(upErr.message);

    const { error: dbErr } = await me.sb.from("employee_documents").insert({
      employee_id: employeeId,
      doc_type: docType,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: me.id,
    });
    if (dbErr) {
      await me.sb.storage.from(BUCKET).remove([path]);
      return fail(dbErr.message);
    }

    revalidatePath("/admin/documents");
    revalidatePath(`/admin/documents/${employeeId}`);
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Upload failed");
  }
}

/** Admin only. */
export async function deleteDocument(id: string): Promise<Res> {
  try {
    const me = await caller();
    if (!me?.admin) return fail("Admins only");

    const { data: row, error } = await me.sb.from("employee_documents").select("storage_path, employee_id").eq("id", id).single();
    if (error || !row) return fail("Document not found");

    const { error: sErr } = await me.sb.storage.from(BUCKET).remove([row.storage_path]);
    if (sErr) return fail(sErr.message);
    const { error: dErr } = await me.sb.from("employee_documents").delete().eq("id", id);
    if (dErr) return fail(dErr.message);

    revalidatePath("/admin/documents");
    revalidatePath(`/admin/documents/${row.employee_id}`);
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Delete failed");
  }
}

/** A link that works for 60 seconds. Admins can open any document; employees only their own. */
export async function documentUrl(id: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const me = await caller();
    if (!me) return fail("Not signed in");

    const { data: row, error } = await me.sb.from("employee_documents").select("storage_path, employee_id").eq("id", id).single();
    if (error || !row) return fail("Document not found");
    if (!me.admin && row.employee_id !== me.id) return fail("Not allowed");

    const { data, error: uErr } = await me.sb.storage.from(BUCKET).createSignedUrl(row.storage_path, 60);
    if (uErr || !data) return fail(uErr?.message ?? "Couldn't open the file");
    return { ok: true, url: data.signedUrl };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn't open the file");
  }
}
