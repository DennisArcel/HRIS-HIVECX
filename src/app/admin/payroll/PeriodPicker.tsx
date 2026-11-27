"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type P = { from: string; label: string };

/** Pay period dropdown: switches period as soon as one is picked (no View button). */
export function PeriodPicker({ periods, current }: { periods: P[]; current: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [val, setVal] = useState(current);
  useEffect(() => setVal(current), [current]);

  return (
    <div className="row" style={{ alignItems: "center", marginBottom: 14 }}>
      <label htmlFor="pp" className="mut" style={{ margin: 0 }}>Pay period</label>
      <select
        id="pp"
        value={val}
        disabled={pending}
        style={{ width: "auto" }}
        onChange={(e) => {
          const v = e.target.value;
          setVal(v);
          start(() => router.push(`/admin/payroll?p=${v}`));
        }}
      >
        {periods.map((x) => <option key={x.from} value={x.from}>{x.label}</option>)}
      </select>
      {pending && <span className="mut" style={{ fontSize: 12.5 }}>Loading…</span>}
    </div>
  );
}
