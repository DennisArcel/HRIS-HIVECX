import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { EmployeeQr } from "../employees/EmployeeQr";

export const dynamic = "force-dynamic";

export default async function AdminQrPage() {
  await requireAdmin();
  const sb = await supabaseServer();
  const { data, error } = await sb.from("profiles").select("id, full_name, role").order("full_name");

  return (
    <div style={{ maxWidth: 820 }}>
      <div className="fig">HR ADMIN / EMPLOYEE QR</div>
      <h1 style={{ margin: "8px 0 16px" }}>Employee QR badges</h1>
      <p className="mut" style={{ marginBottom: 16 }}>
        Only admins can see these. View one, replace a lost badge, or print every badge at once.
      </p>
      <p style={{ marginBottom: 20 }}>
        <Link
          href="/admin/qr/print"
          style={{
            display: "inline-block",
            background: "var(--ac)",
            color: "#111",
            fontWeight: 600,
            padding: "11px 20px",
            borderRadius: 999,
            textDecoration: "none",
          }}
        >
          Print all badges (PDF)
        </Link>
      </p>
      {error && <p style={{ color: "var(--bad)" }}>Couldn&apos;t load employees: {error.message}</p>}
      <div className="card">
        {(data ?? []).map((e) => (
          <div
            key={e.id}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--bd, #2a2a2a)" }}
          >
            <span>
              <b>{e.full_name}</b> <span className="mut">· {e.role}</span>
            </span>
            <EmployeeQr id={e.id} name={e.full_name} />
          </div>
        ))}
        {!error && (data ?? []).length === 0 && <p className="mut">No employees found.</p>}
      </div>
    </div>
  );
}