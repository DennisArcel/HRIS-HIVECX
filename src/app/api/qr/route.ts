import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { supabaseServer } from "@/lib/supabase/server";
import { makeBadgeToken } from "@/lib/qr";

export const dynamic = "force-dynamic";

/** Admin only. Returns { svg } for one employee's badge QR (GET /api/qr?id=<employee uuid>). Errors come back as { error }. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Bad employee id" }, { status: 400 });

  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again" }, { status: 401 });
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { data: emp, error } = await sb.from("profiles").select("id, role, qr_version").eq("id", id).single();
  if (error || !emp) return NextResponse.json({ error: error?.message ?? "Employee not found" }, { status: 404 });
  if (emp.role === "admin") return NextResponse.json({ error: "Admins don't use QR badges" }, { status: 400 });

  try {
    const svg = await QRCode.toString(makeBadgeToken(emp.id as string, emp.qr_version ?? 0), { type: "svg", margin: 1 });
    return NextResponse.json({ svg });
  } catch (e) {
    // most likely QR_SECRET is missing or shorter than 32 characters in .env.local
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not build the QR" }, { status: 500 });
  }
}