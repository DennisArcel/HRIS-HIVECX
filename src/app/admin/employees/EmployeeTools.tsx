"use client";
import { FormEvent, useState, useTransition } from "react";
import { Modal } from "@/components/ui";
import { DEPARTMENTS, fmtDate, initials, type Creds, type Row } from "@/lib/fmt";
import { createEmployee, removeEmployee, resetTempPassword, setWorkerType } from "./manage";

const genTemp = () => {
  const c = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const a = new Uint32Array(10);
  crypto.getRandomValues(a);
  return Array.from(a, (n) => c[n % c.length]).join("");
};
const slug = (n: string) =>
  n.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean).join(".");
const SHIFTS: Record<string, string> = { day: "Day Shift · 09:00–18:00", mid: "Mid Shift · 12:00–21:00" };

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
          <label htmlFor="aeD">Department</label>
          <select id="aeD" name="d">
            {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="aeS">Semi-monthly salary (₱ per cutoff) <span className="req">*</span></label>
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

export function EmployeeTable({ rows }: { rows: Row[] }) {
  const [pending, start] = useTransition();
  const [profile, setProfile] = useState<Row | null>(null);
  const [confirm, setConfirm] = useState<Row | null>(null);
  const [creds, setCreds] = useState<Creds | null>(null);
  const [msg, setMsg] = useState("");

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
      <div className="card flat wrap" style={{ padding: 8, opacity: pending ? 0.7 : 1 }}>
        <table>
          <thead>
            <tr>
              {["Employee", "Position", "Department", "Worker type", "Account", "Hired", ""].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td className="mut" colSpan={7}>No employees yet.</td></tr>
            )}
            {rows.map((e) => (
              <tr key={e.id}>
                <td>
                  <span className="av">{initials(e.full_name)}</span>
                  {e.full_name}
                  <div className="fig" style={{ marginLeft: 38 }}>{e.employee_code} · {e.username}</div>
                </td>
                <td>{e.position}</td>
                <td><span className="tag">{e.department}</span></td>
                <td>
                  <select
                    value={e.worker_type}
                    aria-label={`Worker type for ${e.full_name}`}
                    style={{ width: "auto", padding: "6px 10px", fontSize: 13 }}
                    onChange={(ev) => run(() => setWorkerType(e.id, ev.target.value))}
                  >
                    <option>Employee</option>
                    <option>Independent contractor</option>
                  </select>
                </td>
                <td>
                  {e.profile_complete ? <span className="tag ok">Active</span> : <span className="tag wait">Pending profile</span>}
                </td>
                <td>{fmtDate(e.hired_on)}</td>
                <td>
                  <button className="sm" onClick={() => setProfile(e)}>Profile</button>{" "}
                  {!e.profile_complete && (
                    <>
                      <button
                        className="sm"
                        onClick={() =>
                          start(async () => {
                            const r = await resetTempPassword(e.id);
                            if ("error" in r) setMsg(r.error);
                            else { setMsg(""); setCreds(r.creds); }
                          })
                        }
                      >
                        New temp password
                      </button>{" "}
                    </>
                  )}
                  <button className="sm dngr" onClick={() => setConfirm(e)}>Remove</button>
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
            ["Department", profile.department],
            ["Date hired", fmtDate(profile.hired_on)],
            ["Username", profile.username],
            ["Birthday", profile.birthday ? fmtDate(profile.birthday) : "—"],
            ["Semi-monthly salary (per cutoff)", "₱" + Number(profile.salary_semi ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })],
            ["Email", profile.email],
            ["Contact", profile.phone || "—"],
            ["Address", profile.address || "—"],
            ["Emergency contact", profile.emergency_contact || "—"],
            ["Assigned shift", SHIFTS[profile.shift_id] ?? profile.shift_id],
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
          <div className="mact"><button onClick={() => setProfile(null)}>Close</button></div>
        </Modal>
      )}

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