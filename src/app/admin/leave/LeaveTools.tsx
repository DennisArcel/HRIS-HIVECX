"use client";
import { FormEvent, useState, useTransition } from "react";
import { fileLeave, toggleBonusRule } from "./actions";

export function PolicyToggle() {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  return (
    <>
      <button className="sm" disabled={pending} onClick={() => start(async () => setErr((await toggleBonusRule()).error ?? ""))}>
        {pending ? "Switching…" : "Switch bonus rule"}
      </button>
      {err && <p className="err-box"><span>{err}</span></p>}
    </>
  );
}

export function FileLeaveForm({ emps }: { emps: { id: string; full_name: string }[] }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const today = new Date().toLocaleDateString("en-CA");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setErr("");
    setOk(false);
    start(async () => {
      const r = await fileLeave(fd);
      if (r.error) return setErr(r.error);
      form.reset();
      setOk(true);
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {err && <p className="err-box"><span>{err}</span></p>}
      <div>
        <label htmlFor="lfE">Employee</label>
        <select id="lfE" name="e">
          {emps.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="lfT">Leave type</label>
        <select id="lfT" name="t"><option>Vacation</option><option>Sick</option><option>Emergency</option></select>
      </div>
      <div>
        <label htmlFor="lfF">Start date <span className="req">*</span></label>
        <input id="lfF" type="date" name="f" min={today} required />
      </div>
      <div>
        <label htmlFor="lfTo">End date <span className="req">*</span></label>
        <input id="lfTo" type="date" name="to" min={today} required />
      </div>
      <div className="full">
        <label htmlFor="lfR">Reason</label>
        <textarea id="lfR" name="why" rows={2} placeholder="Optional context" />
      </div>
      <div style={{ alignSelf: "end" }}>
        <button className="pri wide" type="submit" disabled={pending}>{pending ? "Adding…" : "Add leave"}</button>
        {ok && <span className="mut" style={{ marginLeft: 12 }}>Leave added and the employee was notified.</span>}
      </div>
    </form>
  );
}