import { dow, eachDay, mins, round2, pad2 } from "./dates";

export type Policy = { annualAllowanceDays: number; monthlyBonusDays: number; latenessForfeitMinutes: number;
  consecutiveLateForfeitDays: number; allowanceIncludesBonus: boolean };
export type Shift = { start: string; end: string; rest: number[] };
export type Ctx = {
  today: string; hiredOn: string; shift: Shift; holidays: Set<string>;
  leaves: { from: string; to: string; status: string }[];
  attendance: Map<string, { in: string | null; out: string | null }>;
  hasPendingFix: (ym: string) => boolean;
};
export const isRest = (k: string, s: Shift) => s.rest.includes(dow(k));

/** Working days only: rest days and holidays are not deducted. */
export function leaveDays(from: string, to: string, shift: Shift, holidays: Set<string>) {
  if (!from || !to || to < from) return 0;
  let n = 0;
  for (const k of eachDay(from, to)) if (!isRest(k, shift) && !holidays.has(k)) n++;
  return n;
}

export type DayState = { st: "none" | "hol" | "rest" | "leave" | "absent" | "future" | "inc" | "late" | "on"; late?: number };
export function dayState(k: string, c: Ctx): DayState {
  if (k < c.hiredOn) return { st: "none" };
  if (c.holidays.has(k)) return { st: "hol" };
  if (isRest(k, c.shift)) return { st: "rest" };
  if (k <= c.today && c.leaves.some((l) => l.status === "Approved" && k >= l.from && k <= l.to)) return { st: "leave" };
  const r = c.attendance.get(k);
  if (!r) return k === c.today ? { st: "none" } : k < c.today ? { st: "absent" } : { st: "future" };
  if (r.in == null || r.out == null) return { st: "inc" };
  const late = Math.max(0, mins(r.in) - mins(c.shift.start));
  return { st: late > 0 ? "late" : "on", late };
}

export function monthFacts(y: number, m0: number, c: Ctx) {
  const last = new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate(), ym = `${y}-${pad2(m0 + 1)}`;
  let on = 0, late = 0, lateMin = 0, absent = 0, inc = 0, leave = 0, consec = 0, maxConsec = 0, total = 0;
  for (let d = 1; d <= last; d++) {
    const k = `${ym}-${pad2(d)}`;
    if (isRest(k, c.shift) || c.holidays.has(k) || k > c.today || k < c.hiredOn) continue;
    total++;
    const s = dayState(k, c);
    if (s.st === "on") { on++; consec = 0; }
    else if (s.st === "late") { late++; lateMin += s.late!; consec++; maxConsec = Math.max(maxConsec, consec); }
    else if (s.st === "leave") { leave++; consec = 0; }
    else if (s.st === "absent") { absent++; consec = 0; }
    else if (s.st === "inc") { inc++; consec = 0; }
  }
  const resolved = on + late + leave;
  return { on, late, lateMin, absent, inc, leave, total, resolved, complete: total > 0 && resolved === total, maxConsec, pendingFix: c.hasPendingFix(ym) };
}

/** Automatic monthly bonus evaluation: never hand-assigned. */
export function evalMonth(y: number, m0: number, c: Ctx, p: Policy) {
  const f = monthFacts(y, m0, c), t = c.today.split("-").map(Number);
  const ended = y < t[0] || (y === t[0] && m0 < t[1] - 1);
  let status: "Qualified" | "Voided" | "Pending Evaluation", reason: string;
  if (!ended) { status = "Pending Evaluation"; reason = "Month in progress"; }
  else if (f.lateMin >= p.latenessForfeitMinutes) { status = "Voided"; reason = `Voided — ${p.latenessForfeitMinutes}-minute lateness threshold reached`; }
  else if (f.maxConsec >= p.consecutiveLateForfeitDays) { status = "Voided"; reason = `Voided — ${p.consecutiveLateForfeitDays} consecutive late days`; }
  else if (!f.complete) { status = "Pending Evaluation"; reason = "Attendance records are incomplete"; }
  else if (f.pendingFix) { status = "Pending Evaluation"; reason = "Unresolved attendance issue"; }
  else { status = "Qualified"; reason = "All conditions met"; }
  return { ym: `${y}-${pad2(m0 + 1)}`, status, reason, amount: status === "Qualified" ? p.monthlyBonusDays : 0, facts: f };
}

export function balance(a: { today: string; hiredOn: string; year: number; used: number; pending: number;
  bonus: { ym: string; status: string; amount: number }[] }, p: Policy) {
  const tm = +a.today.slice(5, 7) - 1;
  const startM = +a.hiredOn.slice(0, 4) === a.year ? +a.hiredOn.slice(5, 7) - 1 : 0;
  const earned = round2((p.annualAllowanceDays * Math.max(0, tm - startM)) / 12);
  let bonusEarned = 0, forfeited = 0;
  for (const r of a.bonus) {
    if (!r.ym.startsWith(String(a.year))) continue;
    if (r.status === "Qualified") bonusEarned += r.amount;
    else if (r.status === "Voided") forfeited += p.monthlyBonusDays;
  }
  let entitled = earned + bonusEarned;
  if (p.allowanceIncludesBonus) entitled = Math.min(entitled, p.annualAllowanceDays);
  return { allowance: p.annualAllowanceDays, earned, used: a.used, pending: a.pending, bonusEarned: round2(bonusEarned),
    forfeited: round2(forfeited), entitled: round2(entitled), remaining: Math.max(0, round2(entitled - a.used - a.pending)) };
}
