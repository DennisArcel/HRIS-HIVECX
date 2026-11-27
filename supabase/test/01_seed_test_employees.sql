-- ════════════════════════════════════════════════════════════════════════════
-- Hive HRIS · attendance + bonus TEST SEED     (path: supabase/test/01_seed_test_employees.sql)
--
-- SAFETY
--  • Touches ONLY the employees with employee_code 'TEST-001' and 'TEST-002'. Every UPDATE / DELETE below has a
--    WHERE limited to those two ids. Nothing of any real employee is read-for-write.
--  • Runs in one transaction: if anything fails, nothing is saved.
--  • Every row it creates is tagged:  attendance.note = 'SEED' · leave_requests.reason = 'SEED' ·
--    attendance_corrections.reason = 'SEED' · holidays.name starts with 'SEED '.
--  • THE HOLIDAYS TABLE IS GLOBAL (it applies to EVERYONE). That is the only seed row that can affect real
--    employees, so it is OFF by default. See `allow_global_holiday` below.
--
-- BEFORE YOU RUN
--  1. Create two employees from the admin page:
--       TEST-001  hired 2026-06-01        TEST-002  hired 2026-07-15      (shift: Day Shift, both)
--     TEST-002 is optional: if it does not exist, its part is skipped.
--  2. Run:  select * from policy;   (the expected results assume 15 / 1.5 / 15 / 3 / false)
--  3. Paste this whole file in the Supabase SQL editor and run it. Re-running it is safe (it re-seeds).
-- ════════════════════════════════════════════════════════════════════════════
begin;

do $seed$
declare
  allow_global_holiday boolean := false;   -- ← set to true ONLY if you accept a SEED holiday on 2026-10-12 for everyone
  t1 uuid;
  t2 uuid;
begin
  select id into t1 from profiles where employee_code = 'TEST-001' and role = 'employee';
  select id into t2 from profiles where employee_code = 'TEST-002' and role = 'employee';
  if t1 is null then
    raise exception 'TEST-001 not found. Create it from the admin page first (hired 2026-06-01).';
  end if;

  -- the two test people: fixed hire date + shift (WHERE limited to their ids)
  update profiles set hired_on = date '2026-06-01', shift_id = 'day' where id = t1;
  if t2 is not null then
    update profiles set hired_on = date '2026-07-15', shift_id = 'day' where id = t2;
  end if;

  -- clean slate for the test people only
  delete from attendance             where employee_id in (t1, coalesce(t2, t1));
  delete from leave_requests         where employee_id in (t1, coalesce(t2, t1));
  delete from attendance_corrections where employee_id in (t1, coalesce(t2, t1));
  delete from bonus_evaluations      where employee_id in (t1, coalesce(t2, t1));

  -- ───────────── TEST-001 (hired 2026-06-01) ─────────────
  -- every weekday Jun 1 → Nov 30: in 08:58, out 18:05 (on time)
  insert into attendance (employee_id, work_date, time_in, time_out, note)
  select t1, g.d::date, time '08:58', time '18:05', 'SEED'
  from generate_series(date '2026-06-01', date '2026-11-30', interval '1 day') as g(d)
  where extract(isodow from g.d) between 1 and 5;

  -- JULY: two non-consecutive late days, 7 + 7 = 14 minutes  → Qualified
  update attendance set time_in = time '09:07' where employee_id = t1 and work_date in (date '2026-07-07', date '2026-07-21');
  -- AUGUST: 8 + 7 = 15 minutes, not consecutive               → Voided (lateness threshold)
  update attendance set time_in = time '09:08' where employee_id = t1 and work_date = date '2026-08-04';
  update attendance set time_in = time '09:07' where employee_id = t1 and work_date = date '2026-08-18';
  -- SEPTEMBER: 3 consecutive workdays, 3 minutes late each (total 9) → Voided (consecutive)
  update attendance set time_in = time '09:03' where employee_id = t1 and work_date in (date '2026-09-08', date '2026-09-09', date '2026-09-10');
  -- OCTOBER: Oct 15 has a clock-in but NO clock-out           → Pending Evaluation (incomplete)
  update attendance set time_out = null where employee_id = t1 and work_date = date '2026-10-15';
  --          Oct 12 (Monday) = SEED holiday, no attendance row at all: must NOT count as missing
  delete from attendance where employee_id = t1 and work_date = date '2026-10-12';
  -- NOVEMBER (a): Nov 4 has no attendance row, covered by APPROVED leave → resolved
  delete from attendance where employee_id = t1 and work_date = date '2026-11-04';
  insert into leave_requests (employee_id, type, from_date, to_date, reason, status, hr_remarks)
    values (t1, 'Vacation', date '2026-11-04', date '2026-11-04', 'SEED', 'Approved', 'SEED');
  -- NOVEMBER (b): Nov 11 has no attendance row, leave only PENDING → NOT resolved
  delete from attendance where employee_id = t1 and work_date = date '2026-11-11';
  insert into leave_requests (employee_id, type, from_date, to_date, reason, status)
    values (t1, 'Vacation', date '2026-11-11', date '2026-11-11', 'SEED', 'Pending');

  -- ───────────── TEST-002 (hired 2026-07-15) ─────────────
  if t2 is not null then
    -- every weekday Jul 15 → Nov 30 on time
    insert into attendance (employee_id, work_date, time_in, time_out, note)
    select t2, g.d::date, time '08:58', time '18:05', 'SEED'
    from generate_series(date '2026-07-15', date '2026-11-30', interval '1 day') as g(d)
    where extract(isodow from g.d) between 1 and 5;
    -- trap: a very late row BEFORE the hire date. It must be ignored → July stays Qualified
    insert into attendance (employee_id, work_date, time_in, time_out, note)
      values (t2, date '2026-07-08', time '10:00', time '18:05', 'SEED');
    -- AUGUST: a PENDING correction on an otherwise perfect month → Pending Evaluation (unresolved issue)
    insert into attendance_corrections (employee_id, work_date, type, requested_time, reason, status)
      values (t2, date '2026-08-20', 'Incorrect Clock In', time '09:00', 'SEED', 'Pending');
    -- SEPTEMBER: Sep 16 has no attendance row but APPROVED leave → resolved → Qualified
    delete from attendance where employee_id = t2 and work_date = date '2026-09-16';
    insert into leave_requests (employee_id, type, from_date, to_date, reason, status, hr_remarks)
      values (t2, 'Sick', date '2026-09-16', date '2026-09-16', 'SEED', 'Approved', 'SEED');
  end if;

  -- ───────────── the one GLOBAL row ─────────────
  if allow_global_holiday then
    insert into holidays (on_date, name) values (date '2026-10-12', 'SEED Test Holiday') on conflict (on_date) do nothing;
  else
    raise notice 'SEED holiday SKIPPED (holidays are global). 2026-10-12 will count as an ABSENT day for the test people instead.';
  end if;
end
$seed$;

-- what was written (test people only)
select p.employee_code,
       (select count(*) from attendance a where a.employee_id = p.id)             as attendance_rows,
       (select count(*) from leave_requests l where l.employee_id = p.id)         as leave_rows,
       (select count(*) from attendance_corrections c where c.employee_id = p.id) as correction_rows
from profiles p where p.employee_code in ('TEST-001', 'TEST-002') order by 1;

commit;
