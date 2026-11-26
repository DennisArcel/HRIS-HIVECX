/** Working days in [from, to]: skips the shift's rest days (0 = Sunday) and holidays. Dates are YYYY-MM-DD. */
export function leaveDays(from: string, to: string, restDays: number[], holidays: Set<string>) {
  let n = 0;
  const end = new Date(to + "T00:00:00");
  for (let d = new Date(from + "T00:00:00"); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toLocaleDateString("en-CA");
    if (restDays.includes(d.getDay()) || holidays.has(key)) continue;
    n++;
  }
  return n;
}