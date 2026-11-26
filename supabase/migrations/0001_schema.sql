-- Hive HRIS · schema + Row Level Security
-- Run in the Supabase SQL editor (or `supabase db push`).

create type app_role      as enum ('employee','admin');
create type worker_type   as enum ('Employee','Independent contractor');
create type req_status    as enum ('Pending','Approved','Rejected');
create type leave_type    as enum ('Vacation','Sick','Emergency');
create type bonus_status  as enum ('Qualified','Voided','Pending Evaluation');

-- ───────── reference data ─────────
create table shifts (
  id text primary key, name text not null,
  start_time time not null, end_time time not null,
  rest_days int[] not null default '{0,6}'         -- 0 = Sunday
);
insert into shifts values ('day','Day Shift','09:00','18:00','{0,6}'),
                          ('mid','Mid Shift','12:00','21:00','{0,6}');

create table holidays (on_date date primary key, name text not null);

-- one row: replaces the POLICY object (editable by HR)
create table policy (
  id boolean primary key default true check (id),
  annual_allowance_days numeric(4,1) not null default 15,
  monthly_bonus_days numeric(3,1) not null default 1.5,
  lateness_forfeit_minutes int not null default 15,
  consecutive_late_forfeit_days int not null default 3,
  allowance_includes_bonus boolean not null default false
);
insert into policy default values;

-- ───────── people ─────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_code text unique not null,               -- HV-001
  full_name text not null,
  username text unique not null,
  email text unique not null,
  role app_role not null default 'employee',
  position text, department text,
  salary_semi numeric(12,2) not null default 0,     -- pay per cutoff
  worker_type worker_type not null default 'Employee',
  employment_status text not null default 'Probationary',
  shift_id text references shifts(id) not null default 'day',
  hired_on date not null,
  birthday date, phone text, address text, emergency_contact text,
  profile_complete boolean not null default false,  -- replaces the prototype's `pend`
  twofa_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create function is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;

-- employees may edit only their own contact fields; everything else needs admin
create function guard_profile_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if is_admin() or auth.uid() is null then return new; end if;
  if (new.role, new.salary_semi, new.worker_type, new.employment_status, new.shift_id, new.hired_on,
      new.full_name, new.employee_code, new.position, new.department, new.username)
     is distinct from
     (old.role, old.salary_semi, old.worker_type, old.employment_status, old.shift_id, old.hired_on,
      old.full_name, old.employee_code, old.position, old.department, old.username)
  then raise exception 'These fields are managed by HR'; end if;
  return new;
end $$;
create trigger trg_guard_profile before update on profiles for each row execute function guard_profile_update();

-- ───────── attendance & requests ─────────
create table attendance (
  id bigint generated always as identity primary key,
  employee_id uuid not null references profiles(id) on delete cascade,
  work_date date not null, time_in time, time_out time, note text default '',
  unique (employee_id, work_date)
);
create table attendance_corrections (
  id bigint generated always as identity primary key,
  employee_id uuid not null references profiles(id) on delete cascade,
  work_date date not null,
  type text not null check (type in ('Forgot to Clock In','Forgot to Clock Out','Incorrect Clock In','Incorrect Clock Out')),
  requested_time time not null, reason text not null,
  status req_status not null default 'Pending', hr_remarks text,
  reviewed_by uuid references profiles(id), reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create table leave_requests (
  id bigint generated always as identity primary key,
  employee_id uuid not null references profiles(id) on delete cascade,
  type leave_type not null, from_date date not null, to_date date not null,
  reason text, status req_status not null default 'Pending', hr_remarks text,
  reviewed_by uuid references profiles(id), reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (to_date >= from_date)
);
create table hr_requests (            -- overtime / document requests
  id bigint generated always as identity primary key,
  employee_id uuid not null references profiles(id) on delete cascade,
  type text not null, request_date date not null,
  overtime_hours numeric(4,1),        -- feeds payroll instead of the prototype's fake OT
  status req_status not null default 'Pending'
);
create table bonus_evaluations (
  employee_id uuid references profiles(id) on delete cascade,
  ym text not null,                   -- '2026-10'
  status bonus_status not null, reason text, amount numeric(3,1) not null default 0,
  facts jsonb not null default '{}', evaluated_at timestamptz not null default now(),
  primary key (employee_id, ym)
);

-- ───────── comms & audit ─────────
create table announcements (
  id bigint generated always as identity primary key,
  title text not null, body text not null,
  priority text not null default 'Normal' check (priority in ('Normal','High','Urgent')),
  pinned boolean not null default false,
  posted_by uuid references profiles(id), posted_on date not null default current_date
);
create table notifications (
  id bigint generated always as identity primary key,
  employee_id uuid not null references profiles(id) on delete cascade,
  kind text not null, title text not null, body text, link text,
  read boolean not null default false, created_at timestamptz not null default now()
);
create table audit_log (
  id bigint generated always as identity primary key,
  actor uuid references profiles(id), actor_name text, action text not null, detail text,
  created_at timestamptz not null default now()
);

-- ───────── payroll ─────────
create table payroll_runs (
  period_from date primary key, period_to date not null,
  status text not null default 'Draft' check (status in ('Draft','Processed')),
  runs int not null default 0, reopened int not null default 0, processed_at timestamptz
);
create table pay_adjustments (        -- HR edits to a single payslip
  employee_id uuid references profiles(id) on delete cascade,
  period_from date references payroll_runs(period_from),
  sss jsonb, ph jsonb, pg jsonb,                    -- {on:boolean, amt:number}
  extras jsonb not null default '[]',               -- [{label, amt}]
  primary key (employee_id, period_from)
);

-- ═════════ ROW LEVEL SECURITY ═════════
alter table shifts                 enable row level security;
alter table holidays               enable row level security;
alter table policy                 enable row level security;
alter table profiles               enable row level security;
alter table attendance             enable row level security;
alter table attendance_corrections enable row level security;
alter table leave_requests         enable row level security;
alter table hr_requests            enable row level security;
alter table bonus_evaluations      enable row level security;
alter table announcements          enable row level security;
alter table notifications          enable row level security;
alter table audit_log              enable row level security;
alter table payroll_runs           enable row level security;
alter table pay_adjustments        enable row level security;

create policy ref_read   on shifts   for select to authenticated using (true);
create policy hol_read   on holidays for select to authenticated using (true);
create policy hol_admin  on holidays for all    to authenticated using (is_admin()) with check (is_admin());
create policy pol_read   on policy   for select to authenticated using (true);
create policy pol_admin  on policy   for update to authenticated using (is_admin()) with check (is_admin());

-- NOTE: employees only see their own profile row. Coworker names (e.g. calendar initials) must come from a view
-- or server action that exposes name only, never salary or contact data.
create policy prof_self  on profiles for select to authenticated using (id = auth.uid() or is_admin());
create policy prof_upd   on profiles for update to authenticated using (id = auth.uid() or is_admin());
create policy prof_adm   on profiles for insert to authenticated with check (is_admin());
create policy prof_del   on profiles for delete to authenticated using (is_admin());

create policy att_read   on attendance for select to authenticated using (employee_id = auth.uid() or is_admin());
create policy att_admin  on attendance for all    to authenticated using (is_admin()) with check (is_admin());

create policy fix_read   on attendance_corrections for select to authenticated using (employee_id = auth.uid() or is_admin());
create policy fix_new    on attendance_corrections for insert to authenticated with check (employee_id = auth.uid() and status = 'Pending');
create policy fix_admin  on attendance_corrections for update to authenticated using (is_admin());

create policy lv_read    on leave_requests for select to authenticated using (employee_id = auth.uid() or is_admin());
create policy lv_new     on leave_requests for insert to authenticated with check ((employee_id = auth.uid() and status = 'Pending') or is_admin());
create policy lv_admin   on leave_requests for update to authenticated using (is_admin());

create policy hr_read    on hr_requests for select to authenticated using (employee_id = auth.uid() or is_admin());
create policy hr_admin   on hr_requests for all    to authenticated using (is_admin()) with check (is_admin());

create policy bon_read   on bonus_evaluations for select to authenticated using (employee_id = auth.uid() or is_admin());
create policy bon_admin  on bonus_evaluations for all    to authenticated using (is_admin()) with check (is_admin());

create policy ann_read   on announcements for select to authenticated using (true);
create policy ann_admin  on announcements for all    to authenticated using (is_admin()) with check (is_admin());

create policy noti_read  on notifications for select to authenticated using (employee_id = auth.uid());
create policy noti_upd   on notifications for update to authenticated using (employee_id = auth.uid());
create policy noti_admin on notifications for insert to authenticated with check (is_admin());

create policy aud_admin  on audit_log for select to authenticated using (is_admin());

create policy run_read   on payroll_runs for select to authenticated using (true);
create policy run_admin  on payroll_runs for all    to authenticated using (is_admin()) with check (is_admin());

-- employees see their own adjustment only once the period is Processed
create policy adj_read   on pay_adjustments for select to authenticated using (
  is_admin() or (employee_id = auth.uid() and exists
    (select 1 from payroll_runs r where r.period_from = pay_adjustments.period_from and r.status = 'Processed')));
create policy adj_admin  on pay_adjustments for all to authenticated using (is_admin()) with check (is_admin());

create policy aud_insert on audit_log for insert to authenticated with check (is_admin());
