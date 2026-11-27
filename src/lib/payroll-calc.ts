/**
 * Payroll maths.
 *
 * PAY MODEL (hourly, from the clock):
 *   hourly rate = monthly salary ÷ 20 working days ÷ 8 hours
 *   basic pay   = paid hours in the cutoff × hourly rate   (paid hours come from clock in / clock out, see pay-hours.ts)
 *   A cutoff never pays more than 80 hours (10 days), so full attendance never exceeds the agreed monthly salary.
 *
 * SSS / PhilHealth / Pag-IBIG follow the 2026 tables (employee shares, half per payslip) and are based on the
 * full monthly salary, not on the hours worked. Verify against the official circulars before real payroll use.
 *
 * Employees receive a PAYSLIP. Independent contractors receive a SETTLEMENT (same maths, different name).
 */
export type Contrib = { on: boolean; amt: number };
export type Extra = { label: string; amt: number; hd?: string };
export type Adj = { sss?: Contrib; ph?: Contrib; pg?: Contrib; extras?: Extra[] } | null | undefined;
export type PayInput = {
  salary_semi?: number | string | null; // legacy: pay per cutoff
  salary_monthly?: number | string | null; // preferred
  worker_type: string;
};
/** Attendance summary for one cutoff (built by computeHours in pay-hours.ts). */
export type PayHours = { hours: number; days: number; leaveDays: number; absent: number; missingOut: number };

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const PHP = (n: number) =>
  "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const WHT_MONTHLY_FREE = 20833;

export const WORK_DAYS = 20; // working days per month
export const HOURS_PER_DAY = 8; // paid hours per day
export const MAX_CUTOFF_HOURS = (WORK_DAYS / 2) * HOURS_PER_DAY; // 80
export const hourlyRate = (monthly: number) => round2((Number(monthly) || 0) / WORK_DAYS / HOURS_PER_DAY);
export const dailyRate = (monthly: number) => Math.round((Number(monthly) || 0) / WORK_DAYS);
export const monthlyOf = (e: PayInput) =>
  e.salary_monthly != null ? Number(e.salary_monthly) || 0 : (Number(e.salary_semi) || 0) * 2;

export const isIC = (e: { worker_type: string }) => e.worker_type === "Independent contractor";
/** Employees get a Payslip; independent contractors get a Settlement. */
export const docName = (workerType: string) => (workerType === "Independent contractor" ? "Settlement" : "Payslip");

/** BIR TRAIN withholding table, semi-monthly column: [over, base tax, rate on the excess] */
const WHT: [number, number, number][] = [
  [333333, 91770.7, 0.35],
  [83333, 16770.7, 0.3],
  [33333, 4270.7, 0.25],
  [16667, 937.5, 0.2],
  [10417, 0, 0.15],
];
export const whtSemi = (t: number) => {
  for (const [over, base, rate] of WHT) if (t > over) return round2(base + (t - over) * rate);
  return 0;
};

export function contribMonthly(monthly: number) {
  const sal = Math.max(0, Number(monthly) || 0);
  if (sal <= 0) return { sss: 0, ph: 0, pg: 0 };
  const msc = Math.min(35000, Math.max(5000, Math.round(sal / 500) * 500));
  return {
    sss: msc * 0.05,
    ph: Math.min(100000, Math.max(10000, sal)) * 0.025,
    pg: Math.min(10000, sal) * 0.02,
  };
}
/** Standard per-payslip contributions for a per-cutoff salary (= monthly ÷ 2). */
export function contribFor(semi: number) {
  const m = contribMonthly((Number(semi) || 0) * 2);
  return { sss: round2(m.sss / 2), ph: round2(m.ph / 2), pg: round2(m.pg / 2) };
}

/**
 * @param hrs  attendance for the cutoff. When given, basic pay = hours × hourly rate.
 *             When omitted (older callers) basic pay falls back to the fixed half-month salary.
 */
export function computePay(e: PayInput, adj: Adj, otHours = 0, hrs?: PayHours | null) {
  const monthly = monthlyOf(e);
  const semi = round2(monthly / 2);
  const rate = hourlyRate(monthly);
  const hoursPaid = hrs ? Math.min(hrs.hours, MAX_CUTOFF_HOURS) : null;
  const basic = hoursPaid == null ? semi : round2(hoursPaid * rate);
  const allow = Math.round(basic * 0.04); // non-taxable transport & COLA, 4% of the basic pay earned
  const ot = round2(otHours * rate * 1.25);
  const extras = adj?.extras ?? [];
  const extra = extras.reduce((a, x) => a + (+x.amt || 0), 0);
  const g = basic + allow + ot + extra;
  const def = contribFor(semi);
  const c = (k: "sss" | "ph" | "pg") => {
    const a = adj?.[k];
    return a ? (a.on ? Math.max(0, +a.amt || 0) : 0) : isIC(e) ? 0 : def[k];
  };
  const sss = c("sss"), ph = c("ph"), pg = c("pg");
  const taxable = Math.max(0, g - allow - sss - ph - pg);
  const tx = whtSemi(taxable);
  const ded = sss + ph + pg + tx;
  return {
    half: basic, // kept for older callers: basic pay for this cutoff
    basic, monthly, semi, rate, hoursPaid, capped: !!hrs && hrs.hours > MAX_CUTOFF_HOURS, hours: hrs ?? null,
    allow, otHrs: otHours, ot, extras, extra, g, sss, ph, pg, taxable, tx, ded, net: g - ded, def, edited: !!adj,
  };
}

/* ---- pay periods: 1–15 and 16–end of month ---- */
const pad = (n: number) => String(n).padStart(2, "0");
export function periodOf(from: string) {
  const [y, m, d] = from.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const d2 = d === 1 ? 15 : last;
  const mon = new Date(y, m - 1, 1).toLocaleDateString("en-PH", { month: "short" });
  return { from, to: `${y}-${pad(m)}-${pad(d2)}`, label: `${mon} ${d}–${d2}, ${y}` };
}
/** Most recent periods that have started, newest first. */
export function periodList(today: string, n = 8) {
  const out: ReturnType<typeof periodOf>[] = [];
  let [y, m] = today.split("-").map(Number);
  while (out.length < n) {
    for (const d of [16, 1]) {
      const from = `${y}-${pad(m)}-${pad(d)}`;
      if (from <= today && out.length < n) out.push(periodOf(from));
    }
    m--;
    if (m === 0) { m = 12; y--; }
  }
  return out;
}
