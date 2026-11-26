"use client";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { leaveDays, type Shift } from "@/lib/employee-calc";
import {
  changePassword, completeSetup, signOutOthers, submitFix, submitLeave, updateContact, type Result,
} from "@/app/employee/actions";

/** <form> that runs a server action, shows its message, and optionally resets / refreshes on success. */
function ActionForm({
  action, children, submit, reset = true, onOk, className,
}: {
  action: (f: FormData) => Promise<Result | void>; children: ReactNode; submit: string;
  reset?: boolean; onOk?: () => void; className?: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [res, setRes] = useState<Result | null>(null);
  return (
    <form ref={ref} className={className} noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setRes(null);
        start(async () => {
          const r = await action(fd);       // setup redirects on success, so r may never arrive
          if (!r) return;
          setRes(r);
          if (r.ok) { if (reset) ref.current?.reset(); router.refresh(); onOk?.(); }
        });
      }}>
      {children}
      {res && (
        <div className={"full " + (res.ok ? "hintbox" : "err-box")} role={res.ok ? "status" : "alert"}
          style={res.ok ? { color: "var(--ok)" } : { color: "var(--bad)" }}>{res.msg}</div>
      )}
      <div className="full"><button className="pri wide" type="submit" disabled={pending}>{pending ? "Working…" : submit}</button></div>
    </form>
  );
}

function PwField({ id, name, label, auto }: { id: string; name: string; label: string; auto: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id}>{label} <span className="req">*</span></label>
      <div className="pw">
        <input id={id} name={name} type={show ? "text" : "password"} autoComplete={auto} required />
        <button type="button" onClick={() => setShow((s) => !s)}>{show ? "Hide" : "Show"}</button>
      </div>
    </div>
  );
}

/* ---------------- leave ---------------- */
export function LeaveForm({ today, shift, hols, remaining }: { today: string; shift: Shift; hols: Record<string, string>; remaining: number }) {
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const n = from && to ? leaveDays(from, to, shift, hols) : null;
  return (
    <ActionForm action={submitLeave} submit="Submit request" onOk={() => { setFrom(""); setTo(""); }}>
      <div><label htmlFor="lvT">Leave type <span className="req">*</span></label>
        <select id="lvT" name="t"><option>Vacation</option><option>Sick</option><option>Emergency</option></select></div>
      <div><label htmlFor="lvF">Start date <span className="req">*</span></label>
        <input id="lvF" type="date" name="f" min={today} value={from} onChange={(e) => setFrom(e.target.value)} required /></div>
      <div><label htmlFor="lvTo">End date <span className="req">*</span></label>
        <input id="lvTo" type="date" name="to" min={from || today} value={to} onChange={(e) => setTo(e.target.value)} required /></div>
      <div className="hintbox" aria-live="polite">
        {n === null
          ? "Pick your dates — the number of leave days is calculated automatically (rest days and holidays are excluded)."
          : <><b style={{ color: "var(--tx)" }}>{n} leave day{n === 1 ? "" : "s"}</b> — rest days and holidays are excluded. Available right now: <b style={{ color: "var(--tx)" }}>{remaining} days</b>.</>}
      </div>
      <div className="full"><label htmlFor="lvR">Reason</label>
        <textarea id="lvR" name="why" rows={2} maxLength={500} placeholder="Optional context for HR" /></div>
    </ActionForm>
  );
}

/* ---------------- attendance correction ---------------- */
export function FixForm({ today }: { today: string }) {
  return (
    <ActionForm action={submitFix} submit="Submit request">
      <div><label htmlFor="fxD">Date of attendance <span className="req">*</span></label>
        <input id="fxD" type="date" name="d" max={today} required /></div>
      <div><label htmlFor="fxT">Correction type <span className="req">*</span></label>
        <select id="fxT" name="ty"><option>Forgot to Clock In</option><option>Forgot to Clock Out</option><option>Incorrect Clock In</option><option>Incorrect Clock Out</option></select></div>
      <div><label htmlFor="fxTime">Requested time <span className="req">*</span></label>
        <input id="fxTime" type="time" name="time" required /></div>
      <div className="full"><label htmlFor="fxW">Reason for correction <span className="req">*</span></label>
        <textarea id="fxW" name="why" rows={2} maxLength={500} placeholder="e.g. I left the office in an emergency and forgot to clock out." required /></div>
    </ActionForm>
  );
}

/* ---------------- profile ---------------- */
export function ContactForm({ ph, email, addr, ec }: { ph: string; email: string; addr: string; ec: string }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button className="pri" onClick={() => setOpen(true)}><Icon name="edit" /> Edit contact details</button>;
  return (
    <div className="card" style={{ width: "100%", marginTop: 14 }}>
      <div className="fig">EDIT CONTACT DETAILS</div>
      <p className="mut" style={{ fontSize: 13, margin: "6px 0 0" }}>Name, position, department, salary and shift are managed by HR.</p>
      <ActionForm action={updateContact} submit="Save changes" reset={false} onOk={() => setOpen(false)}>
        <div><label htmlFor="epP">Contact number <span className="req">*</span></label><input id="epP" name="ph" defaultValue={ph} required /></div>
        <div><label htmlFor="epE">Email address <span className="req">*</span></label><input id="epE" name="email" type="email" defaultValue={email} required /></div>
        <div className="full"><label htmlFor="epA">Address <span className="req">*</span></label><input id="epA" name="addr" defaultValue={addr} required /></div>
        <div className="full"><label htmlFor="epC">Emergency contact <span className="req">*</span></label><input id="epC" name="ec" defaultValue={ec} placeholder="Name · phone number" required /></div>
      </ActionForm>
      <button className="sm" style={{ marginTop: 10 }} onClick={() => setOpen(false)}>Cancel</button>
    </div>
  );
}

export function PasswordForm() {
  return (
    <ActionForm action={changePassword} submit="Update password">
      <div className="full"><PwField id="pwC" name="cur" label="Current password" auto="current-password" /></div>
      <PwField id="pwN" name="new" label="New password" auto="new-password" />
      <PwField id="pwR" name="rep" label="Confirm new password" auto="new-password" />
      <div className="hintbox">Use at least 8 characters, mixing letters and numbers.</div>
    </ActionForm>
  );
}

export function SignOutOthersButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <>
      <button className="sm dngr" disabled={pending} onClick={() => { if (confirm("Sign out all other sessions and devices?")) start(async () => setMsg((await signOutOthers()).msg)); }}>
        Sign out other sessions
      </button>
      {msg && <span className="mut" style={{ fontSize: 12.5 }}>{msg}</span>}
    </>
  );
}

/* ---------------- first-login setup ---------------- */
export function SetupForm({ today, children }: { today: string; children: ReactNode }) {
  return (
    <ActionForm action={completeSetup} submit="Save and continue" reset={false} className="setupform">
      {children}
      <div className="card">
        <div className="fig">STEP 2 · FILLED IN BY YOU</div><h3 style={{ marginTop: 4 }}>About you</h3>
        <div className="fgrid">
          <div><label htmlFor="suB">Birthday <span className="req">*</span></label><input id="suB" name="bd" type="date" min="1940-01-01" max={today} required /></div>
          <div><label htmlFor="suP">Contact number <span className="req">*</span></label><input id="suP" name="ph" type="tel" placeholder="0917 123 4567" autoComplete="tel" required /></div>
          <div className="full"><label htmlFor="suA">Home address <span className="req">*</span></label><input id="suA" name="addr" autoComplete="street-address" placeholder="House no., street, barangay, city" required /></div>
          <div><label htmlFor="suEn">Emergency contact name <span className="req">*</span></label><input id="suEn" name="ecn" placeholder="e.g. Ana Santos" required /></div>
          <div><label htmlFor="suEp">Emergency contact number <span className="req">*</span></label><input id="suEp" name="ecp" type="tel" placeholder="0917 000 0000" required /></div>
        </div>
      </div>
      <div className="card">
        <div className="fig">STEP 3 · SECURITY</div><h3 style={{ marginTop: 4 }}>Choose your own password</h3>
        <div className="fgrid">
          <PwField id="suN" name="new" label="New password" auto="new-password" />
          <PwField id="suR" name="rep" label="Confirm new password" auto="new-password" />
          <div className="hintbox full">At least 8 characters, mixing letters and numbers, and different from the temporary password HR gave you.</div>
        </div>
      </div>
    </ActionForm>
  );
}
