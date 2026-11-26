import Link from "next/link";
import QRCode from "qrcode";
import { requireAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { makeBadgeToken } from "@/lib/qr";
import { PrintBadges } from "./PrintBadges";

export const dynamic = "force-dynamic";

export default async function PrintQrPage() {
  await requireAdmin();
  const sb = await supabaseServer();
  const { data, error } = await sb.from("profiles").select("id, full_name, role, qr_version").order("full_name");

  // Admin accounts don't clock in with a badge, so they're left out.
  const people = (data ?? []).filter((e) => e.role !== "admin");
  const badges = await Promise.all(
    people.map(async (e) => ({
      id: e.id as string,
      name: ((e.full_name as string) ?? "").trim(),
      svg: await QRCode.toString(makeBadgeToken(e.id, e.qr_version ?? 0), { type: "svg", margin: 1 }),
    })),
  );

  return (
    <div>
      <p style={{ margin: "0 0 14px" }}>
        <Link
          href="/admin/qr"
          style={{
            display: "inline-block",
            border: "1px solid var(--bd, #333)",
            color: "var(--tx)",
            padding: "8px 16px",
            borderRadius: 999,
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          ← Back
        </Link>
      </p>
      <div className="fig">HR ADMIN / QR BADGES</div>
      <h1 style={{ margin: "8px 0 8px" }}>Print all QR badges</h1>
      <p className="mut" style={{ marginBottom: 16 }}>
        ID size (54 × 85.6 mm), 9 per page. In the print window choose <b>Save as PDF</b>, scale <b>100%</b>, and turn off <b>Headers and footers</b>.
      </p>
      {error && <p style={{ color: "var(--bad)" }}>Couldn&apos;t load employees: {error.message}</p>}
      <PrintBadges badges={badges} />
    </div>
  );
}