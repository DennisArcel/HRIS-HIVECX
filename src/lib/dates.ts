// Dates are plain 'YYYY-MM-DD' strings in Philippine time. Never pass JS Date objects across the server/client boundary.
export const TZ = "Asia/Manila";
export const pad2 = (n: number) => String(n).padStart(2, "0");
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const mins = (s: string) => { const [a, b] = s.split(":").map(Number); return a * 60 + (b || 0); };
export const hm = (m: number) => pad2(Math.floor(m / 60)) + ":" + pad2(m % 60);
export const pdate = (k: string) => new Date(k + "T00:00:00Z");   // UTC-anchored: no zone drift
export const dkey = (d: Date) => d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate());
export const dow = (k: string) => pdate(k).getUTCDay();
export function manilaNow() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour")}:${g("minute")}` };
}
export function* eachDay(from: string, to: string) {
  for (const d = pdate(from); d <= pdate(to); d.setUTCDate(d.getUTCDate() + 1)) yield dkey(d);
}
