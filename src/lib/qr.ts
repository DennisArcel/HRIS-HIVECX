import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
// SERVER ONLY. QR_SECRET lives in .env.local and never reaches the browser.
const secret = () => {
  const s = process.env.QR_SECRET;
  if (!s || s.length < 32) throw new Error("QR_SECRET must be set (32+ chars)");
  return s;
};
export const QR_TTL = 30, QR_MAX_AGE = 90;
const sign = (id: string, ts: number) => createHmac("sha256", secret()).update(`${id}|${ts}`).digest("base64url");
// (QR_TTL and QR_MAX_AGE are no longer used: QR codes never expire now.)

// Badge QR: no expiry, signed on the server, tied to a version number.
// Bumping profiles.qr_version ("Generate new QR") makes every older badge QR out of date.
const badgeSig = (id: string, v: number) => sign(`badge:${id}:${v}`, 0);
// Short format (HB|id|version|sig) keeps the QR small, so it scans from farther away.
const BADGE_SIG_LEN = 12;
export const makeBadgeToken = (employeeId: string, version = 0) =>
  ["HB", employeeId, String(version), badgeSig(employeeId, version).slice(0, BADGE_SIG_LEN)].join("|");
// Kept so older imports still work: every code is a non-expiring badge code.
export const makeToken = (employeeId: string, version = 0) => makeBadgeToken(employeeId, version);

export function readToken(text: string): { id: string; v?: number } | { err: string } {
  const p = String(text).split("|");
  if (p[0] === "HB" && p.length === 4) {
    const v = Number(p[2]);
    if (!Number.isInteger(v) || v < 0) return { err: "Invalid QR code" };
    const w = Buffer.from(badgeSig(p[1], v).slice(0, BADGE_SIG_LEN)), g = Buffer.from(p[3]);
    if (w.length !== g.length || !timingSafeEqual(w, g)) return { err: "Invalid QR code" };
    return { id: p[1], v };
  }
  if (p[0] !== "HIVE" || p.length !== 4) return { err: "Not a Hive QR code" };
  if (p[2].startsWith("B")) {
    const v = Number(p[2].slice(1));
    if (!Number.isInteger(v) || v < 0) return { err: "Invalid QR code" };
    const w = Buffer.from(badgeSig(p[1], v)), g = Buffer.from(p[3]);
    if (w.length !== g.length || !timingSafeEqual(w, g)) return { err: "Invalid QR code" };
    return { id: p[1], v };
  }
  return { err: "This is an old QR code. Print a new badge from QR Badges." };
}