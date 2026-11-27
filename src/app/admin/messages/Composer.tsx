"use client";
import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendMessage } from "../employees/messages";

export function Composer({ employees }: { employees: { id: string; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const who = employees.find((x) => x.id === fd.get("to"))?.label ?? "the employee";
    setErr("");
    setOk("");
    start(async () => {
      const r = await sendMessage(fd);
      if ("error" in r) return setErr(r.error);
      setOk(`Message sent to ${who}.`);
      form.reset();
      router.refresh();
    });
  }

  return (
    <div className="card">
      <h3>New message</h3>
      <p className="mut" style={{ fontSize: 13, margin: 0 }}>
        Sent to one employee. It appears in their Messages tab and in their notification bell.
      </p>
      <form onSubmit={onSubmit} noValidate>
        {err && <p className="err-box"><span>{err}</span></p>}
        {ok && <p className="hintbox full">{ok}</p>}
        <div className="full">
          <label htmlFor="mgTo">To <span className="req">*</span></label>
          <select id="mgTo" name="to" required defaultValue="">
            <option value="" disabled>Choose an employee…</option>
            {employees.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </div>
        <div className="full">
          <label htmlFor="mgT">Subject <span className="req">*</span></label>
          <input id="mgT" name="title" required maxLength={80} autoComplete="off" />
        </div>
        <div className="full">
          <label htmlFor="mgB">Message <span className="req">*</span></label>
          <textarea id="mgB" name="body" required maxLength={1000} rows={5} style={{ width: "100%" }} />
        </div>
        <div>
          <button className="pri wide" type="submit" disabled={pending}>{pending ? "Sending…" : "Send message"}</button>
        </div>
      </form>
    </div>
  );
}
