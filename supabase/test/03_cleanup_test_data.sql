-- ════════════════════════════════════════════════════════════════════════════
-- CLEAN-UP of every test row                    (path: supabase/test/03_cleanup_test_data.sql)
-- Run STEP 1 (preview) first. Only run STEP 2 when the preview lists nothing but test data.
-- Everything is limited to employee_code 'TEST-001' / 'TEST-002' and to rows tagged SEED.
-- ════════════════════════════════════════════════════════════════════════════

-- ───── STEP 1 · PREVIEW (read-only) ─────
select 'test employees' as what, count(*) as rows from profiles where employee_code in ('TEST-001','TEST-002')
union all select 'attendance (test people)',     count(*) from attendance             where employee_id in (select id from profiles where employee_code in ('TEST-001','TEST-002'))
union all select 'leave_requests (test people)', count(*) from leave_requests         where employee_id in (select id from profiles where employee_code in ('TEST-001','TEST-002'))
union all select 'corrections (test people)',    count(*) from attendance_corrections where employee_id in (select id from profiles where employee_code in ('TEST-001','TEST-002'))
union all select 'bonus_evaluations (test)',     count(*) from bonus_evaluations      where employee_id in (select id from profiles where employee_code in ('TEST-001','TEST-002'))
union all select 'notifications (test)',         count(*) from notifications          where employee_id in (select id from profiles where employee_code in ('TEST-001','TEST-002'))
union all select 'pay_adjustments (test)',       count(*) from pay_adjustments        where employee_id in (select id from profiles where employee_code in ('TEST-001','TEST-002'))
union all select 'SEED holidays (GLOBAL)',       count(*) from holidays               where name like 'SEED %'
union all select 'SEED-tagged rows of OTHER people (must be 0)',
       (select count(*) from attendance where note = 'SEED' and employee_id not in (select id from profiles where employee_code in ('TEST-001','TEST-002')))
     + (select count(*) from leave_requests where reason = 'SEED' and employee_id not in (select id from profiles where employee_code in ('TEST-001','TEST-002')));

-- audit_log rows written by QR scans of the test people (these carry the person's NAME, not a tag). Look, then decide:
select a.id, a.created_at, a.action, a.detail
from audit_log a
join profiles p on p.employee_code in ('TEST-001','TEST-002') and a.detail like p.full_name || '%'
order by a.id;

-- ───── STEP 2 · DELETE (run this block only after checking the preview) ─────
begin;

delete from holidays where name like 'SEED %';                        -- the only global rows we ever add

delete from audit_log a                                               -- QR / payroll audit lines about the test people
using profiles p
where p.employee_code in ('TEST-001','TEST-002') and a.detail like p.full_name || '%';

-- deleting the auth user removes the profile and, by cascade, attendance, leave, corrections, bonus rows,
-- notifications and pay adjustments of THAT person only.
delete from auth.users
where id in (select id from profiles where employee_code in ('TEST-001','TEST-002'));

commit;

-- ───── STEP 3 · verify (should all be 0) ─────
select count(*) as test_profiles_left from profiles where employee_code in ('TEST-001','TEST-002');
select count(*) as seed_holidays_left from holidays where name like 'SEED %';

-- afterwards: delete the DEV_FAKE_NOW line from .env.local and restart `npm run dev`.
