/**
 * Pure employee-side calculations (no Supabase, no server imports) so both server pages and
 * client components can use them. Ported 1:1 from the prototype core.js (attendance, bonus, leave, payroll).
 * If lib/leave.ts / lib/payroll.ts already export equivalents, swap them in here: this is the only
 * place the employee pages get their numbers from.
 */

/** HR-editable rules come from the `policy` table (see loadCtx); only the data window is fixed here. */
export const POLICY = { dataStart: "2026-06-01", minMonth: "2026-06", maxMonth: "2026-12" };
export type Policy = { annual: number; bonus: number; lateMin: number; consec: number; includes: boolean };
export const DEFAULT_POLICY: Policy = { annual: 15, bonus: 1.5, lateMin: 15, consec: 3, includes: false };

export type Shift = { name: string; start: string; end: string; rest: number[] };
export type Rec = { time_in: string | null; time_out: string | null; note: string | null };
export type Leave = {
  id: string | number; leave_type: string; from_date: string; to_date: string;
  status: string; reason: string | null; remarks: string | null; created_at: string;
};
export type Fix = {
  id: string | number; work_date: string; type: string; requested_time: string | null; reason: string;
  status: string; remarks: string | null; reviewed_at: string | null; created_at: string;
};
export type Ctx = {
  today: string; hiredOn: string; shift: Shift;
  recs: Record<string, Rec>; leaves: Leave[]; hols: Record<string, string>; fixes: Fix[]; policy: Policy;
};

export const pad2 = (n: number) => String(n).padStart(2, "0");
export const round2 = (n: number) => Math.round(n * 100) / 100;
export const mins = (s: string) => { const [a, b] = String(s).split(":").map(Number); return a * 60 + (b || 0); };
export const t5 = (s: string | null | undefined) => (s ? String(s).slice(0, 5) : null);
export const PHP = (n: number) => "₱" + Math.round(n).toLocaleString("en-PH");
const utc = (k: string) => new Date(k + "T00:00:00Z");
export const dowOf = (k: string) => utc(k).getUTCDay();
export const shortDate = (k: string) => utc(k).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
export const longDate = (k: string) => utc(k).toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
export const monthLabel = (ym: string) => utc(ym + "-01").toLocaleDateString("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });
export const initials = (n: string) => String(n).split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
export const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  if (s < 604800) return Math.floor(s / 86400) + "d ago";
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
};
export const isRestDay = (k: string, sh: Shift) => sh.rest.includes(dowOf(k));
const eachDay = (a: string, b: string) => {
  const out: string[] = [];
  for (const d = utc(a); d <= utc(b); d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
};

/** Working days only: rest days and holidays are never deducted. */
export function leaveDays(from: string, to: string, shift: Shift, hols: Record<string, string>) {
  if (!from || !to || to < from) return 0;
  return eachDay(from, to).filter((k) => !isRestDay(k, shift) && !hols[k]).length;
}

/* ---------- attendance ---------- */
export type DaySt = "none" | "hol" | "rest" | "leave" | "absent" | "future" | "inc" | "late" | "on";
export function dayState(k: string, c: Ctx): { st: DaySt; late: number; rec?: Rec } {
  const approved = (d: string) => c.leaves.some((l) => l.status === "Approved" && d >= l.from_date && d <= l.to_date);
  if (k < c.hiredOn) return { st: "none", late: 0 };
  if (c.hols[k]) return { st: "hol", late: 0 };
  if (isRestDay(k, c.shift)) return { st: "rest", late: 0 };
  if (k <= c.today && approved(k)) return { st: "leave", late: 0 };
  const r = c.recs[k];
  if (!r) return { st: k === c.today ? "none" : k < c.today ? "absent" : "future", late: 0 };
  if (!r.time_in || !r.time_out) return { st: "inc", late: 0, rec: r };
  const late = Math.max(0, mins(r.time_in) - mins(c.shift.start));
  return { st: late > 0 ? "late" : "on", late, rec: r };
}
export function workdaysOfMonth(ym: string, c: Ctx) {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out: string[] = [];
  for (let d = 1; d <= last; d++) {
    const k = `${ym}-${pad2(d)}`;
    if (!isRestDay(k, c.shift) && !c.hols[k]) out.push(k);
  }
  return out;
}
export function monthFacts(ym: string, c: Ctx) {
  const days = workdaysOfMonth(ym, c).filter((k) => k <= c.today && k >= c.hiredOn);
  let on = 0, late = 0, lateMin = 0, absent = 0, inc = 0, leave = 0, consec = 0, maxConsec = 0;
  for (const k of days) {
    const s = dayState(k, c);
    if (s.st === "on") { on++; consec = 0; }
    else if (s.st === "late") { late++; lateMin += s.late; consec++; if (consec > maxConsec) maxConsec = consec; }
    else if (s.st === "leave") { leave++; consec = 0; }
    else if (s.st === "absent") { absent++; consec = 0; }
    else if (s.st === "inc") { inc++; consec = 0; }
  }
  const total = days.length, resolved = on + late + leave;
  return {
    on, late, lateMin, absent, inc, leave, total, resolved, maxConsec,
    complete: total > 0 && resolved === total,
    pendingFix: c.fixes.some((f) => f.status === "Pending" && f.work_date.slice(0, 7) === ym),
  };
}

/* ---------- monthly bonus (automatic, rule-driven) ---------- */
export type BonusRow = ReturnType<typeof evalMonth>;
export function evalMonth(ym: string, c: Ctx) {
  const f = monthFacts(ym, c);
  const ended = ym < c.today.slice(0, 7);
  let status = "Qualified", reason = "All conditions met";
  if (!ended) { status = "Pending Evaluation"; reason = "Month in progress"; }
  else if (f.lateMin >= c.policy.lateMin) { status = "Voided"; reason = `Voided — ${c.policy.lateMin}-minute lateness threshold reached`; }
  else if (f.maxConsec >= c.policy.consec) { status = "Voided"; reason = `Voided — ${c.policy.consec} consecutive late days`; }
  else if (!f.complete) { status = "Pending Evaluation"; reason = "Attendance records are incomplete"; }
  else if (f.pendingFix) { status = "Pending Evaluation"; reason = "Unresolved attendance issue"; }
  return { ym, status, reason, amount: status === "Qualified" ? c.policy.bonus : 0, ...f };
}
export function bonusRows(c: Ctx): BonusRow[] {
  const out: BonusRow[] = [];
  const first = c.hiredOn.slice(0, 7) > POLICY.minMonth ? c.hiredOn.slice(0, 7) : POLICY.minMonth;
  let [y, m] = first.split("-").map(Number);
  const [y1, m1] = c.today.slice(0, 7).split("-").map(Number);
  while (y < y1 || (y === y1 && m <= m1)) {
    out.push(evalMonth(`${y}-${pad2(m)}`, c));
    if (m === 12) { y++; m = 1; } else m++;
  }
  return out.reverse();
}

/* ---------- leave balance ---------- */
export function bal(c: Ctx) {
  const y = c.today.slice(0, 4);
  // The full annual allowance (15 days) is available from day one. It is NOT accrued monthly.
  // Only the monthly perfect-attendance bonus is earned over time.
  const earned = c.policy.annual;
  let used = 0, pending = 0;
  for (const l of c.leaves) {
    if (l.from_date.slice(0, 4) !== y) continue;
    const n = leaveDays(l.from_date, l.to_date, c.shift, c.hols);
    if (l.status === "Approved") used += n; else if (l.status === "Pending") pending += n;
  }
  let bonusEarned = 0, forfeited = 0;
  for (const r of bonusRows(c)) {
    if (r.ym.slice(0, 4) !== y) continue;
    if (r.status === "Qualified") bonusEarned += r.amount; else if (r.status === "Voided") forfeited += c.policy.bonus;
  }
  let entitled = earned + bonusEarned;
  if (c.policy.includes) entitled = Math.min(entitled, c.policy.annual);
  return {
    allowance: c.policy.annual, earned, used, pending,
    bonusEarned: round2(bonusEarned), forfeited: round2(forfeited), entitled: round2(entitled),
    remaining: Math.max(0, round2(entitled - used - pending)), includesBonus: c.policy.includes,
  };
}

/* ---------- payroll (semi-monthly) ---------- */
const WHT: [number, number, number][] = [[333333, 91770.7, 0.35], [83333, 16770.7, 0.3], [33333, 4270.7, 0.25], [16667, 937.5, 0.2], [10417, 0, 0.15]];
export const RATES = { sss: 0.05, ph: 0.025, pg: 0.02 };
const whtSemi = (t: number) => { for (const r of WHT) if (t > r[0]) return round2(r[1] + (t - r[0]) * r[2]); return 0; };
type Adj = { on?: boolean; amt?: number } | null | undefined;
export type PayAdj = { sss?: Adj; ph?: Adj; pg?: Adj; extras?: { label?: string; amt?: number }[] | null } | null;
/** Same formula as the prototype's payWith(): overtime from approved hr_requests, HR edits from pay_adjustments. */
export function computePay(semi: number, o: { ic?: boolean; otHrs?: number; adj?: PayAdj } = {}) {
  const adj = o.adj ?? null, half = semi, allow = Math.round(semi * 0.04);
  const otHrs = o.otHrs ?? 0, ot = Math.round(otHrs * (semi / 22 / 8) * 1.25);
  const extras = (adj?.extras ?? []).filter((x) => +(x.amt ?? 0) > 0).map((x) => ({ label: x.label || "Additional pay", amt: +(x.amt ?? 0) }));
  const g = half + allow + ot + extras.reduce((a, x) => a + x.amt, 0);
  const def = { sss: round2(semi * RATES.sss), ph: round2(semi * RATES.ph), pg: round2(semi * RATES.pg) };
  const c = (k: "sss" | "ph" | "pg") => (adj?.[k] ? (adj[k]!.on ? Math.max(0, +(adj[k]!.amt ?? 0)) : 0) : o.ic ? 0 : def[k]);
  const sss = c("sss"), ph = c("ph"), pg = c("pg");
  const taxable = Math.max(0, g - allow - sss - ph - pg), tx = whtSemi(taxable), ded = sss + ph + pg + tx;
  return { half, allow, otHrs, ot, extras, g, sss, ph, pg, taxable, tx, ded, net: g - ded };
}
export type Period = { slug: string; label: string; from: string; to: string; st: "Paid" | "Upcoming" };
export function periods(today: string): Period[] {
  const out: Period[] = [];
  const y0 = +today.slice(0, 4), m0 = +today.slice(5, 7) - 1;
  for (let i = 0; i < 8; i++) {
    let y = y0, m = m0 - Math.floor(i / 2);
    while (m < 0) { m += 12; y--; }
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const mon = new Date(Date.UTC(y, m, 1)).toLocaleDateString("en-PH", { month: "short", timeZone: "UTC" });
    for (const h of [{ d1: 16, d2: last }, { d1: 1, d2: 15 }]) {
      const from = `${y}-${pad2(m + 1)}-${pad2(h.d1)}`, to = `${y}-${pad2(m + 1)}-${pad2(h.d2)}`;
      if (from > today) continue;
      out.push({ slug: `${from}_${to}`, label: `${mon} ${h.d1}–${h.d2}, ${y}`, from, to, st: to < today ? "Paid" : "Upcoming" });
    }
  }
  return out;
}