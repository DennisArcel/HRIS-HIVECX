"use client";
import { useState } from "react";
import { Payslip, type SlipData } from "@/components/Payslip";
import { PHP } from "@/lib/payroll-calc";

export type SlipRow = {
  from: string;
  to: string;
  label: string;
  status: string;
  released: boolean;
  gross: number;
  net: number;
  adj: SlipData["adj"];
  otHours: number;
};

const cls = (s: string) => (s === "Paid" || s === "Processed" ? "ok" : "wait");

export function PayslipTable({ rows, me }: { rows: SlipRow[]; me: Omit<SlipData, "adj" | "otHours"> }) {
  const [open, setOpen] = useState<{ row: SlipRow; print: boolean } | null>(null);
  return (
    <>
      <div className="card flat wrap" style={{ padding: 8 }}>
        <table>
          <thead><tr>{["Pay period", "Gross pay", "Net pay", "Status", ""].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td className="mut" colSpan={5}>No payslips yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.from}>
                <td>{r.label}</td>
                <td>{r.released ? PHP(r.gross) : <span className="mut">—</span>}</td>
                <td>{r.released ? <b>{PHP(r.net)}</b> : <span className="mut">—</span>}</td>
                <td><span className={"tag " + cls(r.status)}>{r.status}</span></td>
                <td>
                  {r.released ? (
                    <>
                      <button className="sm" onClick={() => setOpen({ row: r, print: false })}>View</button>{" "}
                      <button className="sm" onClick={() => setOpen({ row: r, print: true })}>PDF</button>
                    </>
                  ) : (
                    <span className="mut">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <Payslip
          key={open.row.from + open.print}
          r={{ ...me, adj: open.row.adj, otHours: open.row.otHours }}
          period={open.row}
          autoPrint={open.print}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}