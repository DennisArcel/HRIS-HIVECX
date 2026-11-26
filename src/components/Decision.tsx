"use client";
import { useState, useTransition } from "react";
import { Modal } from "./ui";

type Action = (id: number, ok: boolean, remarks: string) => Promise<{ error?: string }>;

/** Approve / Reject buttons with an optional remarks box and a confirm dialog. */
export function Decision({
  id,
  label,
  action,
  withRemarks,
}: {
  id: number;
  label: string;
  action: Action;
  withRemarks?: boolean;
}) {
  const [pending, start] = useTransition();
  const [remarks, setRemarks] = useState("");
  const [ask, setAsk] = useState<null | boolean>(null);
  const [err, setErr] = useState("");

  const go = (ok: boolean) => {
    setAsk(null);
    start(async () => {
      const r = await action(id, ok, remarks);
      setErr(r.error ?? "");
    });
  };

  return (
    <div style={{ opacity: pending ? 0.6 : 1 }}>
      {withRemarks && (
        <textarea
          rows={1}
          placeholder="Remarks (optional)"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          style={{ minWidth: 160, marginBottom: 6 }}
        />
      )}
      <div>
        <button className="sm pri" disabled={pending} onClick={() => setAsk(true)}>Approve</button>{" "}
        <button className="sm dngr" disabled={pending} onClick={() => setAsk(false)}>Reject</button>
      </div>
      {err && <p className="err-box"><span>{err}</span></p>}
      {ask !== null && (
        <Modal>
          <div className="fig">PLEASE CONFIRM</div>
          <h3 style={{ marginTop: 10 }}>{ask ? "Approve" : "Reject"} {label}?</h3>
          <div className="mact">
            <button onClick={() => setAsk(null)}>Cancel</button>
            <button className="pri" onClick={() => go(ask)}>Confirm</button>
          </div>
        </Modal>
      )}
    </div>
  );
}