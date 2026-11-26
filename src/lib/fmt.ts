export const DEPARTMENTS = ["Customer Support", "Sales Outreach", "Back Office", "IT & Data", "Admin"];

export const initials = (n: string) =>
  n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export const fmtDate = (s: string | null | undefined) =>
  s
    ? new Date(s + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
    : "—";

export type Creds = { id: string; name: string; user: string; pw: string };

export type Row = {
  id: string;
  employee_code: string;
  full_name: string;
  username: string;
  email: string;
  position: string | null;
  department: string | null;
  worker_type: string;
  profile_complete: boolean;
  hired_on: string;
  salary_semi: number | string | null;
  birthday: string | null;
  phone: string | null;
  address: string | null;
  emergency_contact: string | null;
  shift_id: string;
  employment_status: string;
};