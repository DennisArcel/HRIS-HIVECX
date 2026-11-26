"use client";
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui";
import { reopenPayroll, runPayroll } from "./actions";

export function RunControls({ from, label, processed, runs }: { from: string; label: string; processed: boolean; runs: number }) {
  const [pending, start] = useTransition();
  const [ask, setAsk] = useState(false);
  const [err, setErr] = useState("");

  const run = (fn: () => Promise<{ error?: string }>) => start(async () => setErr((await fn()).error ?? ""));

  return (
    <>
      {processed ? (
        <button className="pri" style={{ marginTop: 14 }} disabled={pending} onClick={() => setAsk(true)}>Re-open payroll</button>
      ) : (
        <button className="pri" style={{ marginTop: 14 }} disabled={pending} onClick={() => run(() => runPayroll(from))}>
          {pending ? (runs ? "Re-processing…" : "Processing…") : "Run payroll"}
        </button>
      )}
      <small className="mut" style={{ display: "block", marginTop: 8, fontSize: 11.5, lineHeight: 1.4 }}>
        {processed
          ? "Found an error? Re-open to unlock the payslips, fix them, then run payroll again."
          : runs
            ? "Releases the corrected payslips to employees again."
            : "Finalises this period: locks the payslips and releases them to employees."}
      </small>
      {err && <p className="err-box"><span>{err}</span></p>}
      {ask && (
        <Modal>
          <div className="fig">PLEASE CONFIRM</div>
          <h3 style={{ marginTop: 10 }}>
            Re-open payroll for {label}? Payslips will be unlocked for editing and hidden from employees until you run payroll again.
          </h3>
          <div className="mact">
            <button onClick={() => setAsk(false)}>Cancel</button>
            <button className="pri" onClick={() => { setAsk(false); run(() => reopenPayroll(from)); }}>Re-open</button>
          </div>
        </Modal>
      )}
    </>
  );
}