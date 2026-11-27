# Attendance & monthly-bonus test plan  (path: docs/ATTENDANCE-BONUS-TEST-PLAN.md)

Everything touches ONLY `TEST-001` and `TEST-002`. Name them **"TEST One"** and **"TEST Two"** in the admin form
(the cleanup script finds their QR audit lines by name).

## Order of work
1. Admin → Employees → create **TEST-001** (hired 2026-06-01) and **TEST-002** (hired 2026-07-15), Day Shift.
2. Supabase SQL editor: `select * from policy;` → expected `15 / 1.5 / 15 / 3 / false`. (If different, the expected results change; 02a/02b read the table, so they still stay correct.)
3. Run `supabase/test/01_seed_test_employees.sql`. (Holiday is OFF by default, see "The one global row".)
4. Run `02a_expected_bonus.sql` and `02b_expected_balance.sql`. These are the numbers the app must show.
5. Open the app pages below and compare. Both the real date (2026-11-27) and the fake date (2026-12-01) are listed.
6. When finished: `03_cleanup_test_data.sql` (preview first), then remove `DEV_FAKE_NOW` from `.env.local` and restart `npm run dev`.

## Test plan (verified on a scratch copy of your schema: the SQL result and your real `src/lib/leave.ts` agree on all 28 rows)
| # | Person · month | Seeded data | Expected (today = 2026-11-27) | Expected (fake today = 2026-12-01) |
|---|---|---|---|---|
| 1 | TEST-001 · June | every workday 08:58 → 18:05 | **Qualified**, 1.5 days, "All conditions met" | same |
| 2 | TEST-001 · July | late Jul 7 (7 min) and Jul 21 (7 min) = 14 min, not consecutive | **Qualified**, 1.5 | same |
| 3 | TEST-001 · August | late Aug 4 (8) and Aug 18 (7) = exactly 15 min | **Voided**, "15-minute lateness threshold reached" | same |
| 4 | TEST-001 · September | Sep 8, 9, 10 each 3 min late (total 9) | **Voided**, "3 consecutive late days" | same |
| 5 | TEST-001 · October | Oct 15 has time-in, no time-out; Oct 12 = holiday, no row | **Pending Evaluation**, "Attendance records are incomplete" (only Oct 15 is incomplete; Oct 12 is not missing when the holiday is on) | same |
| 6 | TEST-001 · November | Nov 4 no row + APPROVED leave; Nov 11 no row + PENDING leave | **Pending Evaluation**, "Month in progress" | **Pending Evaluation**, "Attendance records are incomplete" (Nov 11 is absent: pending leave does not count; Nov 4 counts as resolved) |
| 7 | TEST-002 · July (hired 07-15) | perfect from 07-15; a very late row on 07-08, before hire | **Qualified**: days before hire (including that late row) are ignored | same |
| 8 | TEST-002 · August | perfect, plus one PENDING correction (Aug 20) | **Pending Evaluation**, "Unresolved attendance issue" | same |
| 9 | TEST-002 · September | Sep 16 no row + APPROVED leave | **Qualified** (approved leave = resolved) | same |
| 10 | TEST-002 · October | perfect | **Qualified** | same |
| 11 | TEST-002 · November | perfect | **Pending Evaluation**, "Month in progress" | **Qualified** |

### Expected leave balance (from `02b_expected_balance.sql`)
| Person | Today | Earned | Bonus earned | Forfeited | Used | Pending | Remaining |
|---|---|---|---|---|---|---|---|
| TEST-001 | 2026-11-27 | 6.25 | 3 | 3 | 1 | 1 | **7.25** |
| TEST-001 | 2026-12-01 | 7.5 | 3 | 3 | 1 | 1 | **8.5** |
| TEST-002 | 2026-11-27 | 5 | 4.5 | 0 | 1 | 0 | **8.5** |
| TEST-002 | 2026-12-01 | 6.25 | 6 | 0 | 1 | 0 | **11.25** |

### Where to look
| What | Page |
|---|---|
| bonus status per month, leave balance | Employee → **Leave** (sign in as the test person) |
| each day's state (on time / late / absent / incomplete / leave / rest / holiday) | Employee → **Attendance** |
| clock-ins, the Pending correction | Admin → **Attendance** |
| the Approved and Pending leave rows | Admin → **Leave** |

## The one global row
`holidays` applies to EVERYONE. The seed script therefore skips the SEED holiday unless you set
`allow_global_holiday := true`. With it OFF, 2026-10-12 is simply an absent day for TEST-001 and row 5 is still
"Pending Evaluation / incomplete". Turn it ON only to prove that a holiday is not counted as missing (October's workdays drop 22 → 21).
It also changes October for real employees who had no record that day, so prefer a staging project for that one check. The cleanup deletes it.

## Differences found between the written rules and `src/lib/leave.ts`
None in the outcomes. Behaviours worth knowing (all verified):
1. Rest days and holidays do NOT break a late streak: late Friday + late Monday + late Tuesday = 3 consecutive.
2. An absent, incomplete, on-time or leave day DOES reset the streak.
3. An APPROVED leave day wins over an attendance record on the same day (lateness that day is ignored).
4. A late day without a clock-out counts as "incomplete", not "late": its late minutes are not added to the 15-minute total.
5. Voided is checked BEFORE "incomplete": a month with 15+ late minutes is Voided even if records are also incomplete.
6. A month with zero workdays is "incomplete", never "Qualified". (Check that the app does not list months before the hire date.)
7. Leave `earned` counts the hire month in full and stops BEFORE the current month: hired Jun 1, on Nov 27 → 5 months → 6.25 days. No part-month proration.
8. Today with no record yet is neither absent nor resolved; it only matters for a month that has not ended.

## QR scanner (needs the DEV_FAKE_NOW change: see the notes at the end)
Use dates with NO seeded rows (December), and change `DEV_FAKE_NOW` + restart `npm run dev` between groups.
| # | Fake time | Action | Expected |
|---|---|---|---|
| a | 2026-12-02T08:50 (Wed) | scan TEST-001 | "clocked IN at 08:5x · on time"; notification "On time"; admin Attendance shows the row; employee Attendance shows today as in progress |
| b | same | scan TEST-001 again after a few minutes | "clocked OUT at … · Xh Ym worked"; row complete; third scan → "already completed today (hh:mm–hh:mm)" |
| c | 2026-12-03T09:07 (Thu) | scan TEST-002 | "clocked IN at 09:07 · late by 7 min"; notification "Late by 7 min"; the day shows as late |
| d | 2026-12-04T09:00 (Fri) | scan TEST-001 twice within the same minute | **Current code:** the second scan is accepted as a clock-OUT at the same minute (0h 0m worked). There is no 60-second guard on the server. The 3rd scan says "already completed today". |
| e | 2026-12-05T10:00 (Sat) | scan TEST-001 | accepted, "· rest day work", late = 0, note "QR clock in · rest day work"; the day still shows as REST for bonus purposes |
| f | 2026-10-12T09:00 (Mon, needs the SEED holiday ON) | scan TEST-001 | accepted, "· holiday work", late = 0. (TEST-002 already has a row that day → "already completed") |
| g | any date inside leave | scan TEST-001 on 2026-11-04 | "is on approved leave today", nothing written |
| h | date before the hire date | scan TEST-002 on 2026-07-01 | "has not started yet" |
