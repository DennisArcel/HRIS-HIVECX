-- ════════════════════════════════════════════════════════════════════════════
-- EXPECTED bonus result per month for TEST-001 / TEST-002      (path: supabase/test/02a_expected_bonus.sql)
-- READ-ONLY (a single SELECT). Re-implemented from the written rules, NOT copied from src/lib/leave.ts.
-- It reads the real policy / holidays / shifts tables, so it stays correct if those are edited.
-- Two "todays" are evaluated: 2026-11-27 (real) and 2026-12-01 (the fake date for DEV_FAKE_NOW).
-- ════════════════════════════════════════════════════════════════════════════
with
pol as (select * from policy limit 1),
-- the two "todays" to evaluate: the REAL date, and the fake date you will use with DEV_FAKE_NOW
todays(today) as (values (date '2026-11-27'), (date '2026-12-01')),
emp as (
  select p.id, p.employee_code, p.hired_on, s.start_time, s.rest_days
  from profiles p join shifts s on s.id = p.shift_id
  where p.employee_code in ('TEST-001', 'TEST-002')
),
cal as (   -- every calendar day from the hire month up to "today"
  select e.id as emp_id, e.employee_code, e.hired_on, e.start_time, e.rest_days, t.today, g.d::date as d
  from emp e
  cross join todays t
  cross join lateral generate_series(date_trunc('month', e.hired_on)::date, t.today, interval '1 day') as g(d)
),
workdays as (   -- rest days, holidays, days before the hire date (and days after today) are ignored
  select c.*, to_char(c.d, 'YYYY-MM') as ym
  from cal c
  where c.d >= c.hired_on
    and not (extract(dow from c.d)::int = any (c.rest_days))
    and not exists (select 1 from holidays h where h.on_date = c.d)
),
classified as (
  select w.*,
    case
      when exists (select 1 from leave_requests l
                   where l.employee_id = w.emp_id and l.status = 'Approved' and w.d between l.from_date and l.to_date) then 'leave'
      when a.id is null then case when w.d = w.today then 'today' else 'absent' end
      when a.time_in is null or a.time_out is null then 'incomplete'
      when a.time_in > w.start_time then 'late'
      else 'on'
    end as cls,
    case when a.time_in > w.start_time
         then floor(extract(epoch from (a.time_in - w.start_time)) / 60)::int else 0 end as late_min
  from workdays w
  left join attendance a on a.employee_id = w.emp_id and a.work_date = w.d
),
runs as (   -- longest run of consecutive late workdays inside each month
  select emp_id, today, ym, max(n) as max_run
  from (
    select emp_id, today, ym, grp, count(*) as n
    from (
      select q.*, row_number() over (partition by emp_id, today, ym order by d)
                - row_number() over (partition by emp_id, today, ym, (cls = 'late') order by d) as grp
      from classified q
    ) z
    where cls = 'late'
    group by emp_id, today, ym, grp
  ) r
  group by emp_id, today, ym
),
facts as (
  select emp_id, employee_code, today, ym,
    count(*)                                          as workdays,
    count(*) filter (where cls = 'on')                as on_time,
    count(*) filter (where cls = 'late')              as late_days,
    coalesce(sum(late_min) filter (where cls = 'late'), 0) as late_min,
    count(*) filter (where cls = 'leave')             as leave_days,
    count(*) filter (where cls = 'absent')            as absent_days,
    count(*) filter (where cls = 'incomplete')        as incomplete_days
  from classified
  group by emp_id, employee_code, today, ym
),
months as (
  select f.*, coalesce(r.max_run, 0) as max_run,
    exists (select 1 from attendance_corrections k
            where k.employee_id = f.emp_id and k.status = 'Pending' and to_char(k.work_date, 'YYYY-MM') = f.ym) as pending_fix,
    (date_trunc('month', f.today)::date > to_date(f.ym || '-01', 'YYYY-MM-DD')) as ended
  from facts f
  left join runs r on r.emp_id = f.emp_id and r.today = f.today and r.ym = f.ym
),
judged as (
  select m.*,
    case
      when not m.ended                                                                   then 'Pending Evaluation'
      when m.late_min >= p.lateness_forfeit_minutes                                      then 'Voided'
      when m.max_run  >= p.consecutive_late_forfeit_days                                 then 'Voided'
      when not (m.workdays > 0 and m.on_time + m.late_days + m.leave_days = m.workdays)  then 'Pending Evaluation'
      when m.pending_fix                                                                 then 'Pending Evaluation'
      else 'Qualified'
    end as status,
    case
      when not m.ended                                                                   then 'Month in progress'
      when m.late_min >= p.lateness_forfeit_minutes                                      then 'Voided — ' || p.lateness_forfeit_minutes || '-minute lateness threshold reached'
      when m.max_run  >= p.consecutive_late_forfeit_days                                 then 'Voided — ' || p.consecutive_late_forfeit_days || ' consecutive late days'
      when not (m.workdays > 0 and m.on_time + m.late_days + m.leave_days = m.workdays)  then 'Attendance records are incomplete'
      when m.pending_fix                                                                 then 'Unresolved attendance issue'
      else 'All conditions met'
    end as reason
  from months m cross join pol p
),
result as (
  select j.*, case when j.status = 'Qualified' then p.monthly_bonus_days else 0 end as amount
  from judged j cross join pol p
)

select employee_code, today, ym, status, amount, reason,
       workdays, on_time, late_days, late_min, max_run as max_consecutive_late,
       leave_days, absent_days, incomplete_days, pending_fix
from result
order by employee_code, today, ym;
