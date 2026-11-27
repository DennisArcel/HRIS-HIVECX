"use client";
import { FormEvent, useState, useTransition } from "react";
import { Modal } from "@/components/ui";
import { fmtDate, initials, type Creds, type Row } from "@/lib/fmt";
import { PHP, hourlyRate } from "@/lib/payroll-calc";
import { createEmployee, removeEmployee, resetTempPassword, updateEmployee } from "./manage";

const genTemp = () => {
  const c = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const a = new Uint32Array(10);
  crypto.getRandomValues(a);
  return Array.from(a, (n) => c[n % c.length]).join("");
};
const slug = (n: string) =>
  n.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean).join(".");

function CredsModal({ c, created, onClose }: { c: Creds; created: boolean; onClose: () => void }) {
  const text = `Hive HRIS sign-in\nName: ${c.name}\nUsername: ${c.user}\nTemporary password: ${c.pw}\nYou'll be asked to complete your profile and choose a new password on your first sign-in.`;
  const [copied, setCopied] = useState(false);
  return (
    <Modal>
      <div className="fig">{created ? "ACCOUNT CREATED" : "NEW TEMPORARY PASSWORD"}</div>
      <h3 style={{ margin: "6px 0 4px" }}>{c.name}</h3>
      <p className="mut" style={{ fontSize: 13, margin: "0 0 6px" }}>
        Give these to the employee now. The password can&apos;t be shown again after you close this window. If it&apos;s
        lost, issue a new one.
      </p>
      <div className="docgrid">
        <div className="k">Employee ID</div>
        <div className="v">{c.id}</div>
        <div className="k">Username</div>
        <div className="v cred">{c.user}</div>
        <div className="k">Temporary password</div>
        <div className="v cred">{c.pw}</div>
      </div>
      <div className="mact">
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true))}
        >
          {copied ? "Copied" : "Copy details"}
        </button>
        <button className="pri" type="button" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}

export function CreateEmployeeForm() {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [created, setCreated] = useState<Creds | null>(null);
  const [name, setName] = useState("");
  const [user, setUser] = useState("");
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState({ user: false, email: false });
  const [pw, setPw] = useState("");

  function onName(v: string) {
    setName(v);
    const s = slug(v);
    if (!touched.user) setUser(s);
    if (!touched.email) setEmail(s ? s + "@hive.com" : "");
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr("");
    start(async () => {
      const r = await createEmployee(fd);
      if ("error" in r) return setErr(r.error);
      setCreated(r.creds);
      setName("");
      setUser("");
      setEmail("");
      setTouched({ user: false, email: false });
      setPw("");
      (e.target as HTMLFormElement)?.reset?.();
    });
  }

  return (
    <div className="card">
      <h3>Create employee account</h3>
      <p className="mut" style={{ fontSize: 13, margin: 0 }}>
        Enter only what HR knows. The employee adds their birthday, contact number, address and emergency contact on
        first sign-in, and replaces the temporary password.
      </p>
      <form onSubmit={onSubmit} noValidate>
        {err && (
          <p className="err-box">
            <span>{err}</span>
          </p>
        )}

        <div>
          <label htmlFor="aeC">Employee ID <span className="req">*</span></label>
          <input id="aeC" name="code" required autoComplete="off" placeholder="e.g. HV-001" />
        </div>
        <div>
          <label htmlFor="aeN">Full name <span className="req">*</span></label>
          <input id="aeN" name="n" required autoComplete="off" value={name} onChange={(e) => onName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="aeM">Work email <span className="req">*</span></label>
          <input
            id="aeM" name="email" type="email" required autoComplete="off" value={email}
            onChange={(e) => { setEmail(e.target.value); setTouched((t) => ({ ...t, email: true })); }}
          />
        </div>
        <div>
          <label htmlFor="aeU">Username <span className="req">*</span></label>
          <input
            id="aeU" name="user" required autoComplete="off" placeholder="e.g. juan.delacruz" value={user}
            onChange={(e) => { setUser(e.target.value); setTouched((t) => ({ ...t, user: true })); }}
          />
        </div>

        <div>
          <label htmlFor="aeR">Position <span className="req">*</span></label>
          <input id="aeR" name="r" required />
        </div>
        <div>
          <label htmlFor="aeS">Monthly salary (₱ per month) <span className="req">*</span></label>
          <input id="aeS" name="s" type="number" min="0" required />
        </div>
        <div>
          <label htmlFor="aeT">Worker type</label>
          <select id="aeT" name="ty">
            <option>Employee</option>
            <option>Independent contractor</option>
          </select>
        </div>
        <div>
          <label htmlFor="aeJ">Date hired <span className="req">*</span></label>
          <input id="aeJ" name="j" type="date" required defaultValue={new Date().toLocaleDateString("en-CA")} />
        </div>

        <div>
          <label htmlFor="aeSS">Shift starts at <span className="req">*</span></label>
          <input id="aeSS" name="ss" type="time" required defaultValue="09:00" />
        </div>
        <div>
          <label htmlFor="aeSE">Shift ends at <span className="req">*</span></label>
          <input id="aeSE" name="se" type="time" required defaultValue="18:00" />
        </div>
        <div className="hintbox full">
          Paid time is 8 hours a day. Anything longer in the shift is the unpaid break, so 09:00–18:00 has a 1-hour break. Rest days are Saturday and Sunday. The shift must start and end on the same day.
        </div>

        <div className="full">
          <label htmlFor="aeW">Temporary password <span className="req">*</span></label>
          <div className="pw">
            <input
              id="aeW" name="pw" required autoComplete="off" placeholder="Type one, or click Generate" value={pw} onChange={(e) => setPw(e.target.value)}
              style={{ paddingRight: 96, fontFamily: "ui-monospace,Menlo,monospace" }}
            />
            <button type="button" onClick={() => setPw(genTemp())}>Generate</button>
          </div>
        </div>
        <div className="hintbox">
          The employee signs in with the username and this temporary password, then completes their profile and sets
          their own password.
        </div>
        <div>
          <button className="pri wide" type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create account"}
          </button>
        </div>
      </form>
      {created && <CredsModal c={created} created onClose={() => setCreated(null)} />}
    </div>
  );
}

type SalaryRow = Row & { salary_monthly?: number | string | null };

/** Admin-only edit form for one employee. Worker type is shown but locked: it is set when the account is created. */
function EditEmployeeModal({ e, shifts, onClose }: { e: Row; shifts: Record<string, string>; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [ss, se] = (shifts[e.shift_id] ?? "09:00–18:00").split("–");
  const salary = Number((e as SalaryRow).salary_monthly ?? 0);

  function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    setErr("");
    start(async () => {
      const r = await updateEmployee(e.id, fd);
      if (r.error) return setErr(r.error);
      onClose();
    });
  }

  return (
    <Modal onClose={onClose}>
      <div className="fig">EDIT EMPLOYEE</div>
      <h3 style={{ margin: "6px 0 4px" }}>{e.full_name}</h3>
      <p className="mut" style={{ fontSize: 13, margin: 0 }}>
        Changes are saved to the employee&apos;s record and logged in the audit trail.
      </p>
      <form onSubmit={onSubmit} noValidate>
        {err && <p className="err-box"><span>{err}</span></p>}
        <div>
          <label htmlFor="eeC">Employee ID <span className="req">*</span></label>
          <input id="eeC" name="code" required autoComplete="off" defaultValue={e.employee_code ?? ""} />
        </div>
        <div>
          <label htmlFor="eeN">Full name <span className="req">*</span></label>
          <input id="eeN" name="n" required autoComplete="off" defaultValue={e.full_name} />
        </div>
        <div>
          <label htmlFor="eeM">Work email <span className="req">*</span></label>
          <input id="eeM" name="email" type="email" required autoComplete="off" defaultValue={e.email ?? ""} />
        </div>
        <div>
          <label htmlFor="eeU">Username <span className="req">*</span></label>
          <input id="eeU" name="user" required autoComplete="off" defaultValue={e.username ?? ""} />
        </div>
        <div>
          <label htmlFor="eeR">Position <span className="req">*</span></label>
          <input id="eeR" name="r" required defaultValue={e.position ?? ""} />
        </div>
        <div>
          <label htmlFor="eeS">Monthly salary (₱ per month) <span className="req">*</span></label>
          <input id="eeS" name="s" type="number" min="0" step="any" required defaultValue={salary || ""} />
        </div>
        <div>
          <label htmlFor="eeW">Worker type</label>
          <input id="eeW" value={e.worker_type ?? ""} readOnly disabled aria-describedby="eeWh" />
        </div>
        <div>
          <label htmlFor="eeJ">Date hired <span className="req">*</span></label>
          <input id="eeJ" name="j" type="date" required defaultValue={e.hired_on ?? ""} />
        </div>
        <div>
          <label htmlFor="eeSS">Shift starts at <span className="req">*</span></label>
          <input id="eeSS" name="ss" type="time" required defaultValue={ss} />
        </div>
        <div>
          <label htmlFor="eeSE">Shift ends at <span className="req">*</span></label>
          <input id="eeSE" name="se" type="time" required defaultValue={se} />
        </div>
        <div className="hintbox full" id="eeWh">
          Worker type is set when the account is created and can&apos;t be changed. Shifts must be at least 8 hours long, Monday to Friday. Changing the hire date changes when attendance and leave start counting.
        </div>
        <div>
          <label htmlFor="eeB">Birthday</label>
          <input id="eeB" name="bd" type="date" defaultValue={e.birthday ?? ""} max={new Date().toLocaleDateString("en-CA")} />
        </div>
        <div>
          <label htmlFor="eeP">Contact number</label>
          <input id="eeP" name="ph" type="tel" autoComplete="off" defaultValue={e.phone ?? ""} />
        </div>
        <div className="full">
          <label htmlFor="eeA">Home address</label>
          <input id="eeA" name="addr" autoComplete="off" defaultValue={e.address ?? ""} />
        </div>
        <div className="full">
          <label htmlFor="eeE">Emergency contact</label>
          <input id="eeE" name="ec" autoComplete="off" placeholder="Name · phone number" defaultValue={e.emergency_contact ?? ""} />
        </div>
        <div className="full mact" style={{ margin: 0 }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="pri" type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
        </div>
      </form>
    </Modal>
  );
}

export function EmployeeTable({ rows, shifts }: { rows: Row[]; shifts: Record<string, string> }) {
  const [pending, start] = useTransition();
  const [profile, setProfile] = useState<Row | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [confirm, setConfirm] = useState<Row | null>(null);
  const [creds, setCreds] = useState<Creds | null>(null);
  const [msg, setMsg] = useState("");
  const [menu, setMenu] = useState<string | null>(null); // which row's "more" menu is open

  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.error ?? "");
    });

  return (
    <>
      {msg && (
        <p className="err-box" style={{ marginTop: 12 }}>
          <span>{msg}</span>
        </p>
      )}
      <style>{`
        .emptbl{width:100%;border-collapse:collapse}
        .emptbl th{white-space:nowrap;text-align:left;padding:14px 18px;font-weight:500}
        .emptbl td{padding:18px;vertical-align:middle;border-top:1px solid var(--line, #2a2a2a)}
        .emptbl tr:first-child td{border-top:0}
        .emptbl .who{display:flex;align-items:center;gap:14px;min-width:230px}
        .emptbl .sub{color:var(--mut, #9a9a9a);font-size:12.5px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:210px}
        .emptbl .nw{white-space:nowrap}
        .emptbl select.quiet{width:auto;padding:7px 12px;font-size:13px;background:transparent}
        .emptbl .end{text-align:right;white-space:nowrap}
        .emptbl .pop{position:absolute;right:0;top:calc(100% + 6px);z-index:30;min-width:190px;padding:6px;border-radius:12px;
          background:var(--panel, #181818);border:1px solid var(--line, #2a2a2a);box-shadow:0 12px 32px rgba(0,0,0,.35);text-align:left}
        .emptbl .pop button{display:block;width:100%;text-align:left;border:0;background:transparent;color:var(--tx, inherit);
          padding:10px 12px;border-radius:8px;font:inherit;font-size:13.5px;cursor:pointer}
        .emptbl .pop button:hover{background:rgba(255,255,255,.06)}
        .emptbl .pop button.bad{color:var(--bad, #ff6b6b)}
        @media (max-width: 900px){ .emptbl .hide-sm{display:none} }
      `}</style>
      {menu && <div onClick={() => setMenu(null)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />}
      <div className="card flat wrap" style={{ padding: 8, opacity: pending ? 0.7 : 1, overflowX: "auto" }}>
        <table className="emptbl">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Position</th>
              <th className="hide-sm">Worker type</th>
              <th>Status</th>
              <th className="hide-sm">Hired</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td className="mut" colSpan={6}>No employees yet.</td></tr>
            )}
            {rows.map((e) => (
              <tr key={e.id}>
                <td>
                  <div className="who">
                    <span className="av" style={{ flex: "none" }}>{initials(e.full_name)}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{e.full_name}</div>
                      <div className="sub" title={`${e.employee_code} · ${e.username}`}>{e.employee_code} · {e.username}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div>{e.position}</div>
                  <div className="sub">{shifts[e.shift_id] ?? e.shift_id}</div>
                </td>
                <td className="hide-sm">
                  <span>{e.worker_type}</span>
                </td>
                <td className="nw">
                  {e.profile_complete ? <span className="tag ok">Active</span> : <span className="tag wait">Pending profile</span>}
                </td>
                <td className="nw hide-sm">{fmtDate(e.hired_on)}</td>
                <td className="end">
                  <div style={{ display: "inline-flex", gap: 8, alignItems: "center", position: "relative", zIndex: menu === e.id ? 25 : 1 }}>
                    <button className="sm" onClick={() => setProfile(e)}>Profile</button>
                    <button
                      className="sm"
                      aria-label={`More actions for ${e.full_name}`}
                      aria-haspopup="menu"
                      aria-expanded={menu === e.id}
                      onClick={() => setMenu(menu === e.id ? null : e.id)}
                    >
                      •••
                    </button>
                    {menu === e.id && (
                      <div className="pop" role="menu">
                        {!e.profile_complete && (
                          <button
                            role="menuitem"
                            onClick={() => {
                              setMenu(null);
                              start(async () => {
                                const r = await resetTempPassword(e.id);
                                if ("error" in r) setMsg(r.error);
                                else { setMsg(""); setCreds(r.creds); }
                              });
                            }}
                          >
                            New temp password
                          </button>
                        )}
                        <button role="menuitem" className="bad" onClick={() => { setMenu(null); setConfirm(e); }}>
                          Remove employee
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {profile && (
        <Modal onClose={() => setProfile(null)}>
          <div className="fig">{profile.employee_code}</div>
          <h3 style={{ margin: "6px 0 12px" }}>
            {profile.full_name}{" "}
            {!profile.profile_complete && <span className="tag wait" style={{ verticalAlign: "middle" }}>Pending profile</span>}
          </h3>
          {([
            ["Position", profile.position],
            ["Worker type", profile.worker_type],
            ["Date hired", fmtDate(profile.hired_on)],
            ["Username", profile.username],
            ["Birthday", profile.birthday ? fmtDate(profile.birthday) : "—"],
            ["Monthly salary", PHP(Number((profile as Row & { salary_monthly?: number | string | null }).salary_monthly ?? 0))],
            ["Hourly rate (monthly ÷ 20 days ÷ 8 hrs)", PHP(hourlyRate(Number((profile as Row & { salary_monthly?: number | string | null }).salary_monthly ?? 0)))],
            ["Email", profile.email],
            ["Contact", profile.phone || "—"],
            ["Address", profile.address || "—"],
            ["Emergency contact", profile.emergency_contact || "—"],
            ["Assigned shift", shifts[profile.shift_id] ?? profile.shift_id],
          ] as [string, string | null][]).map(([k, v]) => (
            <div className="ls" key={k}>
              <span className="mut">{k}</span><br />{v}
            </div>
          ))}
          {!profile.profile_complete && (
            <p className="mut" style={{ fontSize: 12.5 }}>
              Personal details stay empty until the employee completes their profile on first sign-in.
            </p>
          )}
          <div className="mact">
            <button onClick={() => setProfile(null)}>Close</button>
            <button className="pri" onClick={() => { setEditing(profile); setProfile(null); }}>{"Edit information"}</button>
          </div>
        </Modal>
      )}

      {editing && <EditEmployeeModal key={editing.id} e={editing} shifts={shifts} onClose={() => setEditing(null)} />}

      {confirm && (
        <Modal>
          <div className="fig">PLEASE CONFIRM</div>
          <h3 style={{ marginTop: 10 }}>
            Remove {confirm.full_name}? Their account and all their records will be deleted.
          </h3>
          <div className="mact">
            <button onClick={() => setConfirm(null)}>Cancel</button>
            <button className="pri" onClick={() => { const id = confirm.id; setConfirm(null); run(() => removeEmployee(id)); }}>
              Remove
            </button>
          </div>
        </Modal>
      )}

      {creds && <CredsModal c={creds} created={false} onClose={() => setCreds(null)} />}
    </>
  );
}