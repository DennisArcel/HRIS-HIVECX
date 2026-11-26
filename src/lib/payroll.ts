import { round2 } from "./dates";

// BIR withholding tax (TRAIN), semi-monthly column: [over, base tax, rate on the excess]
export const WHT: ReadonlyArray<readonly [number, number, number]> = [
  [333333, 91770.7, 0.35], [83333, 16770.7, 0.3], [33333, 4270.7, 0.25], [16667, 937.5, 0.2], [10417, 0, 0.15],
];
// Flat demo rates carried over from the prototype. TODO: replace with the official SSS / PhilHealth / Pag-IBIG tables.
export const RATES = { sss: 0.05, ph: 0.025, pg: 0.02 } as const;

export const whtSemi = (t: number) => {
  for (const [over, base, rate] of WHT) if (t > over) return round2(base + (t - over) * rate);
  return 0;
};

type Contrib = { on: boolean; amt: number };
export type Adj = { sss?: Contrib; ph?: Contrib; pg?: Contrib; extra?: { label: string; amt: number }[] };
export type PayInput = { salarySemi: number; workerType: "Employee" | "Independent contractor"; overtimeHours: number };

export function computePay(e: PayInput, adj?: Adj | null) {
  const half = e.salarySemi, allow = Math.round(half * 0.04);
  const ot = Math.round(e.overtimeHours * (half / 22 / 8) * 1.25);
  const extras = adj?.extra ?? [];
  const extra = extras.reduce((a, x) => a + (+x.amt || 0), 0);
  const g = half + allow + ot + extra;
  const ic = e.workerType === "Independent contractor";
  const def = { sss: round2(half * RATES.sss), ph: round2(half * RATES.ph), pg: round2(half * RATES.pg) };
  const c = (k: "sss" | "ph" | "pg") => (adj?.[k] ? (adj[k]!.on ? Math.max(0, +adj[k]!.amt || 0) : 0) : ic ? 0 : def[k]);
  const sss = c("sss"), ph = c("ph"), pg = c("pg");
  const taxable = Math.max(0, g - allow - sss - ph - pg);   // tax is computed after contributions and non-taxable allowance
  const tx = whtSemi(taxable), ded = sss + ph + pg + tx;
  return { half, allow, ot, extras, extra, g, sss, ph, pg, taxable, tx, ded, net: g - ded, edited: !!adj };
}

/** Pay periods up to today, newest first (16–end, then 1–15), covering `months` calendar months. */
export function periods(todayKey: string, months = 4) {
  const [y0, m0] = todayKey.split("-").map(Number);
  const out: { label: string; from: string; to: string }[] = [];
  const mon = (y: number, m: number) => new Date(Date.UTC(y, m, 1)).toLocaleDateString("en-PH", { month: "short", timeZone: "UTC" });
  const p = (n: number) => String(n).padStart(2, "0");
  for (let i = 0; i < months; i++) {
    let y = y0, m = m0 - 1 - i;
    while (m < 0) { m += 12; y--; }
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    for (const [d1, d2] of [[16, last], [1, 15]] as const) {
      const from = `${y}-${p(m + 1)}-${p(d1)}`, to = `${y}-${p(m + 1)}-${p(d2)}`;
      if (from <= todayKey) out.push({ label: `${mon(y, m)} ${d1}–${d2}, ${y}`, from, to });
    }
  }
  return out;
}
