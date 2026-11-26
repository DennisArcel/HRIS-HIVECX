import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { makeBadgeToken } from "@/lib/qr";

export const dynamic = "force-dynamic";

/** Admin-only. Returns the current badge QR (SVG) for one employee: /api/qr?id=<employee uuid> */
export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const sb = await supabaseServer();
  const { data, error } = await sb.from("profiles").select("qr_version").eq("id", id).single();
  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const svg = await QRCode.toString(makeBadgeToken(id, data.qr_version ?? 0), { type: "svg", margin: 1 });
  return NextResponse.json({ svg });
}