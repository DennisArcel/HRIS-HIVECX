import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const COLORS = ["var(--ac)", "var(--tx)", "var(--ok)", "var(--mut)", "var(--bad)"];
const ini = (n: string) => n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const manilaToday = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }); // YYYY-MM-DD

function daysUntilBirthday(bday: string, today: string) {
  const t = new Date(today + "T00:00:00");
  const [, m, d] = bday.split("-").map(Number);
  let n = new Date(t.getFullYear(), m - 1, d);
  if (n < t) n = new Date(t.getFullYear() + 1, m - 1, d);
  return Math.round((+n - +t) / 864e5);
}
const fmt = (s: string, o: Intl.DateTimeFormatOptions) =>
  new Date(s + "T00:00:00").toLocaleDateString("en-PH", o);

function Who({ name }: { name: string }) {
  return (
    <>
      <span className="av">{ini(name)}</span>
      {name}
    </>
  );
}

function Stat({ fig, title, value }: { fig: string; title: string; value: React.ReactNode }) {
  return (
    <div className="card stat">
      <div className="fig">{fig}</div>
      <h3>{title}</h3>
      <div className="big">{value}</div>
    </div>
  );
}

export default async function AdminDashboard() {
  const sb = await supabaseServer();
  const today = manilaToday();
  const count = { count: "exact" as const, head: true };

  const [emps, present, onLeave, pLeave, pFix, pReq] = await Promise.all([
    sb
      .from("profiles")
      .select("id, full_name, position, department, hired_on, birthday, profile_complete")
      .eq("role", "employee"),
    sb.from("attendance").select("id", count).eq("work_date", today).not("time_in", "is", null),
    sb
      .from("leave_requests")
      .select("id", count)
      .eq("status", "Approved")
      .lte("from_date", today)
      .gte("to_date", today),
    sb.from("leave_requests").select("id", count).eq("status", "Pending"),
    sb.from("attendance_corrections").select("id", count).eq("status", "Pending"),
    sb.from("hr_requests").select("id", count).eq("status", "Pending"),
  ]);

  const list = emps.data ?? [];
  const total = list.length;
  const pending = (pLeave.count ?? 0) + (pFix.count ?? 0) + (pReq.count ?? 0);

  // department mix
  const byDept = new Map<string, number>();
  list.forEach((e) => {
    const d = e.department || "Unassigned";
    byDept.set(d, (byDept.get(d) ?? 0) + 1);
  });
  const depts = [...byDept.entries()];
  let offset = 0;

  const birthdays = list
    .filter((e) => e.birthday && e.profile_complete)
    .map((e) => ({ e, in: daysUntilBirthday(e.birthday!, today) }))
    .sort((a, b) => a.in - b.in)
    .slice(0, 3);

  const cutoff = new Date(new Date(today + "T00:00:00").getTime() - 60 * 864e5)
    .toLocaleDateString("en-CA");
  const hires = list
    .filter((e) => e.hired_on >= cutoff)
    .sort((a, b) => (a.hired_on < b.hired_on ? 1 : -1))
    .slice(0, 5);

  return (
    <>
      <div className="eyebrow">HR Admin / Dashboard</div>
      <h1>
        The whole team,
        <br />
        <em>at a glance.</em>
      </h1>
      <p className="lead">Headcount, attendance and approvals for today.</p>

      <div className="grid g4">
        <Stat fig="FIG 0.1" title="Headcount" value={total} />
        <Stat
          fig="FIG 0.2"
          title="Present today"
          value={
            <>
              <span>{present.count ?? 0}</span>/{total}
            </>
          }
        />
        <Stat fig="FIG 0.3" title="On leave today" value={onLeave.count ?? 0} />
        <Stat fig="FIG 0.4" title="Pending approvals" value={pending} />
      </div>

      <div className="grid g2 mt">
        <div className="card">
          <div className="fig">BY DEPARTMENT</div>
          <h3>Headcount mix</h3>
          <svg viewBox="0 0 120 120" style={{ width: 150, display: "block", margin: "10px 0" }}>
            <circle cx="60" cy="60" r="42" fill="none" stroke="var(--line)" strokeWidth="14" />
            {depts.map(([d, n], k) => {
              const p = (n / (total || 1)) * 100;
              const el = (
                <circle
                  key={d}
                  cx="60"
                  cy="60"
                  r="42"
                  pathLength="100"
                  fill="none"
                  stroke={COLORS[k % COLORS.length]}
                  strokeWidth="14"
                  strokeDasharray={`${Math.max(p - 1, 0)} ${101 - p}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 60 60)"
                />
              );
              offset += p;
              return el;
            })}
            <text x="60" y="66" textAnchor="middle" style={{ fill: "var(--tx)", font: "600 22px system-ui" }}>
              {total}
            </text>
          </svg>
          <div className="leg">
            {depts.map(([d, n], k) => (
              <span key={d}>
                <i style={{ background: COLORS[k % COLORS.length] }} />
                {d} ({n})
              </span>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="fig">WAITING ON HR</div>
          <h3>Approvals queue</h3>
          <div className="ls">Leave requests <span className="mut">· {pLeave.count ?? 0}</span></div>
          <div className="ls">Attendance corrections <span className="mut">· {pFix.count ?? 0}</span></div>
          <div className="ls">Overtime &amp; document requests <span className="mut">· {pReq.count ?? 0}</span></div>
        </div>
      </div>

      <div className="grid g2 mt">
        <div className="card">
          <div className="fig">UPCOMING</div>
          <h3>Birthdays</h3>
          {birthdays.length ? (
            birthdays.map(({ e }) => (
              <div className="ls" key={e.id}>
                <Who name={e.full_name} />{" "}
                <span className="mut">· {fmt(e.birthday!, { month: "short", day: "numeric" })}</span>
              </div>
            ))
          ) : (
            <p className="mut">None soon.</p>
          )}
        </div>
        <div className="card">
          <div className="fig">NEW</div>
          <h3>Recent hires</h3>
          {hires.length ? (
            hires.map((e) => (
              <div className="ls" key={e.id}>
                <Who name={e.full_name} /> <span className="mut">· {e.position ?? "—"}</span>
              </div>
            ))
          ) : (
            <p className="mut">None.</p>
          )}
        </div>
      </div>
    </>
  );
}