import { getPortal } from "@/lib/employee-data";
import { PHP, initials, shortDate } from "@/lib/employee-calc";
import { PageHead } from "@/components/employee-ui";
import { Icon } from "@/components/Icon";
import { ContactForm, PasswordForm, SignOutOthersButton } from "@/components/employee-forms";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

const Fld = ({ label, children, locked }: { label: string; children: ReactNode; locked?: boolean }) => (
  <div className="ls"><span className="mut">{label}{locked ? <> <Icon name="lock" /></> : null}</span><br />{children}</div>
);

export default async function EmployeeProfile() {
  const { me: e, shift, user } = await getPortal();
  const dash = (v: string | null | undefined) => v || "—";
  return (
    <>
      <PageHead eyebrow="Employee / My Profile" title={<>Your details,<br /><em>one record.</em></>}
        lead="Update your contact details yourself — job details are managed by HR." />
      <div className="card">
        <div className="welcome">
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <span className="av lg">{initials(e.full_name)}</span>
            <div><h2 style={{ fontSize: 24 }}>{e.full_name}</h2>
              <div className="mut" style={{ fontSize: 13.5 }}>{e.employee_no} · {e.position} · {e.department}</div>
              <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className="tag ok">{e.employment_status ?? "Active"}</span><span className="tag">{shift.name}</span></div></div>
          </div>
          <ContactForm ph={e.phone ?? ""} email={e.email ?? user.email ?? ""} addr={e.address ?? ""} ec={e.emergency_contact ?? ""} />
        </div>
      </div>
      <div className="grid g2 mt">
        <div className="card">
          <div className="fig">PERSONAL INFORMATION</div><h3 style={{ marginTop: 4 }}>About you</h3>
          <Fld label="Full name" locked>{e.full_name}</Fld>
          <Fld label="Employee ID" locked>{dash(e.employee_no)}</Fld>
          <Fld label="Birthday" locked>{e.birthday ? shortDate(e.birthday) : "—"}</Fld>
          <Fld label="Contact number">{dash(e.phone)}</Fld>
          <Fld label="Address">{dash(e.address)}</Fld>
          <Fld label="Emergency contact">{dash(e.emergency_contact)}</Fld>
        </div>
        <div className="card">
          <div className="fig">EMPLOYMENT INFORMATION</div><h3 style={{ marginTop: 4 }}>Your role</h3>
          <Fld label="Position" locked>{dash(e.position)}</Fld>
          <Fld label="Department" locked>{dash(e.department)}</Fld>
          <Fld label="Date hired" locked>{shortDate(e.hired_on)}</Fld>
          <Fld label="Employment status" locked>{dash(e.employment_status)}</Fld>
          <Fld label="Assigned shift" locked>{shift.name} · {shift.start}–{shift.end}</Fld>
          <Fld label="Semi-monthly salary (per cutoff)" locked>{PHP(Number(e.salary ?? 0))}</Fld>
          <p className="mut" style={{ fontSize: 12, margin: "12px 0 0" }}><Icon name="lock" /> Fields marked with a lock are changed by HR/Admin only.</p>
        </div>
      </div>
      <div className="grid g2 mt">
        <div className="card">
          <div className="fig">ACCOUNT INFORMATION</div><h3 style={{ marginTop: 4 }}>Sign-in</h3>
          <Fld label="Email address">{dash(e.email ?? user.email)}</Fld>
          <Fld label="Username">{e.username ?? e.employee_no ?? "—"}</Fld>
          <Fld label="Last sign-in">{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</Fld>
          <div className="row" style={{ margin: "14px 0 0" }}><SignOutOthersButton /></div>
        </div>
        <div className="card">
          <div className="fig">ACCOUNT SECURITY</div><h3 style={{ marginTop: 4 }}>Change password</h3>
          <PasswordForm />
        </div>
      </div>
    </>
  );
}