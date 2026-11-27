-- Hive HRIS · hourly pay
-- Run once in the Supabase SQL editor BEFORE deploying the new code.

-- 1. The real salary: monthly. (Hourly rate = monthly ÷ 20 days ÷ 8 hours.)
alter table profiles add column if not exists salary_monthly numeric(12,2) not null default 0;
update profiles set salary_monthly = salary_semi * 2 where salary_monthly = 0;

-- 2. Keep the old per-cutoff column in sync so any older code that still reads it stays correct.
create or replace function sync_salary_semi() returns trigger language plpgsql as $$
begin
  new.salary_semi := round(new.salary_monthly / 2, 2);
  return new;
end $$;
drop trigger if exists trg_sync_salary on profiles;
create trigger trg_sync_salary before insert or update on profiles
  for each row execute function sync_salary_semi();

-- 3. Employees may still not change their own pay: add the new column to the HR-only guard.
create or replace function guard_profile_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if is_admin() or auth.uid() is null then return new; end if;
  if (new.role, new.salary_semi, new.salary_monthly, new.worker_type, new.employment_status, new.shift_id, new.hired_on,
      new.full_name, new.employee_code, new.position, new.department, new.username)
     is distinct from
     (old.role, old.salary_semi, old.salary_monthly, old.worker_type, old.employment_status, old.shift_id, old.hired_on,
      old.full_name, old.employee_code, old.position, old.department, old.username)
  then raise exception 'These fields are managed by HR'; end if;
  return new;
end $$;
