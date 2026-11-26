import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { BUCKET, extOf } from "@/lib/doc-types";

export const dynamic = "force-dynamic";

// Only images and PDFs are shown inline. The type comes from the file extension, never from what the browser claimed.
const TYPES: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };

/** Preview for the cards and the document tiles. Admins can see any file, employees only their own. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Bad request", { status: 400 });

  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: row } = await sb.from("employee_documents").select("storage_path, employee_id, file_name").eq("id", id).single();
  if (!row) return new NextResponse("Not found", { status: 404 });

  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin" && row.employee_id !== user.id) return new NextResponse("Forbidden", { status: 403 });

  const type = TYPES[extOf(row.file_name)];
  if (!type) return new NextResponse("No preview for this file type", { status: 415 });

  const { data: blob, error } = await sb.storage.from(BUCKET).download(row.storage_path);
  if (error || !blob) return new NextResponse("File not found", { status: 404 });

  return new NextResponse(blob, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=120",
      "X-Content-Type-Options": "nosniff",
    },
  });
}