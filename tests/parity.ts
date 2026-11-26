import fs from "node:fs";
import { computePay, periods } from "../src/lib/payroll";
import { leaveDays, evalMonth, balance, type Ctx, type Policy } from "../src/lib/leave";
import { round2 } from "../src/lib/dates";

// ---- original payroll, lifted verbatim from core.js ----
const src = fs.readFileSync("/mnt/user-data/uploads/core.js", "utf8").split(/\r?\n/);
const grab = (a: string, b: string) => src.slice(src.findIndex((l) => l.startsWith(a)), src.findIndex((l) => l.startsWith(b)));
const code = grab("const WHT=", "function pay(e,label)").join("\n");
const orig = new Function("round2", `${code}; return {payWith, isIC};`)(round2);

const emps = [16000, 12000, 19000, 11000, 10500, 22500, 13000].map((s, i) => ({ id: "HV-00" + (i + 1), s }));
let bad = 0;
for (const e of emps) for (const ty of ["Employee", "Independent contractor"] as const) for (const adj of [null, { extra: [{ label: "Holiday", amt: 1500 }] }, { sss: { on: false, amt: 0 }, ph: { on: true, amt: 300 } }]) {
  const o = orig.payWith({ ...e, ty }, adj), n = computePay({ salarySemi: e.s, workerType: ty, overtimeHours: (parseInt(e.id.slice(3)) % 3) * 2 }, adj as any);
  for (const k of ["half", "allow", "ot", "g", "sss", "ph", "pg", "taxable", "tx", "ded", "net"] as const)
    if (Math.abs(o[k] - (n as any)[k]) > 0.005) { bad++; console.log("MISMATCH", e.id, ty, k, o[k], (n as any)[k]); }
}
// high earner to exercise upper tax brackets
for (const s of [40000, 100000, 400000]) {
  const o = orig.payWith({ id: "HV-001", s, ty: "Employee" }, null), n = computePay({ salarySemi: s, workerType: "Employee", overtimeHours: 2 }, null);
  if (Math.abs(o.tx - n.tx) > 0.005) { bad++; console.log("TAX MISMATCH", s, o.tx, n.tx); }
}
console.log(bad ? `payroll: ${bad} mismatches` : "payroll: identical to core.js on 48 cases");

// ---- leave rules ----
const day = { start: "09:00", end: "18:00", rest: [0, 6] };
const hol = new Set(["2026-11-30"]);
console.log("leaveDays Nov 26–Dec 1 (Thu–Tue, Nov 30 holiday):", leaveDays("2026-11-26", "2026-12-01", day, hol), "(expect 3: Thu, Fri, Tue)");
const P: Policy = { annualAllowanceDays: 15, monthlyBonusDays: 1.5, latenessForfeitMinutes: 15, consecutiveLateForfeitDays: 3, allowanceIncludesBonus: false };
const mk = (over: Record<string, string>): Ctx => {
  const a = new Map<string, any>();
  for (let d = 1; d <= 31; d++) { const k = `2026-07-${String(d).padStart(2, "0")}`; const dw = new Date(k + "T00:00:00Z").getUTCDay(); if (dw && dw < 6) a.set(k, { in: over[k] ?? "08:50", out: "18:02" }); }
  return { today: "2026-11-23", hiredOn: "2023-02-14", shift: day, holidays: new Set(), leaves: [], attendance: a, hasPendingFix: () => false };
};
console.log("July, 3 consecutive 5-min-late days →", evalMonth(2026, 6, mk({ "2026-07-14": "09:04", "2026-07-15": "09:04", "2026-07-16": "09:04" }), P).reason, "(expect voided: 3 consecutive)");
console.log("July, all on time →", evalMonth(2026, 6, mk({}), P).status, "(expect Qualified)");
console.log("July, 16 min late once →", evalMonth(2026, 6, mk({ "2026-07-14": "09:16" }), P).reason);
console.log("balance:", balance({ today: "2026-11-23", hiredOn: "2023-02-14", year: 2026, used: 2, pending: 1, bonus: [{ ym: "2026-07", status: "Qualified", amount: 1.5 }] }, P));
console.log("periods:", periods("2026-11-23", 2).map((p) => p.label));
