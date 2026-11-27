import { HOURS_PER_DAY, round2, type PayHours } from "./payroll-calc";

/**
 * Paid hours for one cutoff, built from the attendance table (clock in / clock out).
 *
 * Rules
 *  - Hours are counted from the clock, but only inside the employee's shift: arriving early or leaving late does
 *    not add pay (extra time is paid only through an approved overtime request).
 *  - The unpaid break (shift length − 8 hrs, i.e. 1 hr) is taken out of any day longer than 5 hours.
 *  - A day pays at most 8 hours. Late arrival and early leaving therefore reduce pay automatically.
 *  - Approved leave on a working day counts as 8 paid hours (not for independent contractors).
 *  - Work on a rest day or holiday is paid for the hours worked at the normal rate (HR can add premium pay as extra).
 *  - A clock-in with no clock-out on a past day pays 0 hours until HR fixes it in Attendance; it is flagged as missingOut.
 *  - Days before the hire date and days after today are not counted.
 */
export type ShiftInfo = { start_time: string; end_time: string; rest_days: number[] };
export type AttRow = { work_date: string; time_in: string | null; time_out: string | null };
export type LeaveRow = { from_date: string; to_date: string };

const toMin = (t: string) => {
  const [h, m] = t.split(":");
  return (Number(h) || 0) * 60 + (Number(m) || 0);
};
const dowOf = (k: string) => new Date(`${k}T00:00:00Z`).getUTCDay();
function eachDay(from: string, to: string) {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** Paid minutes for one day's clock in / out. `clamp` limits the span to the shift window (working days). */
export function dayMinutes(timeIn: string, timeOut: string, shift: ShiftInfo, clamp: boolean) {
  const s = toMin(shift.start_time), e = toMin(shift.end_time);
  const a = clamp ? Math.max(toMin(timeIn), s) : toMin(timeIn);
  const b = clamp ? Math.min(toMin(timeOut), e) : toMin(timeOut);
  const span = Math.max(0, b - a);
  const brk = Math.max(0, e - s - HOURS_PER_DAY * 60); // unpaid break built into the shift
  return Math.min(span > 300 ? span - brk : span, HOURS_PER_DAY * 60);
}

export function computeHours(a: {
  from: string;
  to: string;
  today: string;
  hiredOn: string | null;
  shift: ShiftInfo;
  holidays: Set<string>;
  attendance: AttRow[];
  leaves: LeaveRow[];
  paidLeave: boolean;
}): PayHours {
  const start = a.hiredOn && a.hiredOn > a.from ? a.hiredOn : a.from;
  const end = a.to < a.today ? a.to : a.today;
  const att = new Map(a.attendance.map((r) => [r.work_date, r]));
  let minutes = 0, days = 0, leaveDays = 0, absent = 0, missingOut = 0;
  if (start > end) return { hours: 0, days, leaveDays, absent, missingOut };

  for (const k of eachDay(start, end)) {
    const off = a.shift.rest_days.includes(dowOf(k)) || a.holidays.has(k);
    const onLeave = a.leaves.some((l) => k >= l.from_date && k <= l.to_date);
    if (!off && onLeave && a.paidLeave) {
      minutes += HOURS_PER_DAY * 60;
      leaveDays++;
      continue;
    }
    const r = att.get(k);
    if (r?.time_in && r?.time_out) {
      minutes += dayMinutes(r.time_in, r.time_out, a.shift, !off);
      days++;
    } else if (r?.time_in) {
      if (k < a.today) missingOut++; // today's open shift is simply still running
    } else if (!off && !onLeave && k < a.today) {
      absent++;
    }
  }
  return { hours: round2(minutes / 60), days, leaveDays, absent, missingOut };
}
