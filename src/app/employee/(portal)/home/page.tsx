import Link from "next/link";
import { getPortal, loadAnnouncements, loadCtx, loadNotifications, loadUpcoming } from "@/lib/employee-data";
import { bal, longDate, monthFacts, monthLabel, shortDate, ago } from "@/lib/employee-calc";
import { Mini } from "@/components/employee-ui";
import { Icon } from "@/components/Icon";
import { MarkAllReadButton } from "./MarkAllReadButton";

export const dynamic = "force-dynamic";

export default async function EmployeeHome() {
  const p = await getPortal();
  const [ctx, ann, upcoming, notis] = await Promise.all([loadCtx(p), loadAnnouncements(p), loadUpcoming(p), loadNotifications(p, 5)]);
  const b = bal(ctx), mf = monthFacts(ctx.today.slice(0, 7), ctx);
  const hour = +p.now.slice(0, 2);
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = p.me.full_name.split(" ")[0];
  const pendReq = ctx.leaves.filter((l) => l.status === "Pending").length + ctx.fixes.filter((f) => f.status === "Pending").length;

  return (
    <>
      <div className="card flat" style={{ padding: 22 }}>
        <div className="cardhd"><div className="fig">ANNOUNCEMENTS</div><span className="mut" style={{ fontSize: 12.5 }}>Posted by HR · {ann.length} total</span></div>
        <div className="announce">
          {ann.map((a) => (
            <div key={a.id} className={"an" + (a.pinned ? " top" : "")}>
              {a.pinned ? <span className="pin">Pinned</span> : null}
              <div className="anhd">
                <span className={"tag " + (a.priority === "Urgent" ? "bad" : a.priority === "High" ? "wait" : "")}>{a.priority ?? "Normal"}</span>
                <b>{a.title}</b><time>{shortDate(String(a.created_at).slice(0, 10))}</time>
              </div>
              <p>{a.body}</p>
            </div>
          ))}
          {ann.length === 0 && <p className="mut">No announcements yet.</p>}
        </div>
      </div>

      <div className="card mt welcome">
        <div>
          <div className="fig">{greet.toUpperCase()}</div>
          <h1 style={{ margin: "8px 0 6px" }}>{greet}, <em>{first}.</em></h1>
          <p className="mut" style={{ margin: 0, maxWidth: "52ch" }}>
            Welcome back — here&apos;s your day. {longDate(ctx.today)}.{" "}
            {pendReq ? <>You have <b style={{ color: "var(--tx)" }}>{pendReq}</b> request{pendReq > 1 ? "s" : ""} waiting on HR.</> : "You have no pending requests."}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="fig">LEAVE REMAINING</div>
          <div className="big" style={{ marginTop: 6 }}>{b.remaining}<span style={{ fontSize: ".45em", color: "var(--mut)" }}> days</span></div>
          <Link className="mut" style={{ fontSize: 12.5 }} href="/employee/leave">Manage leave →</Link>
        </div>
      </div>

      <div className="grid g2 mt">
        <div className="card">
          <div className="cardhd"><div><div className="fig">LEAVE SUMMARY</div><h3>This year</h3></div><Link className="mut" style={{ fontSize: 12.5 }} href="/employee/leave">Details →</Link></div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", gap: "16px 10px" }}>
            <Mini label="Allowance" val={b.allowance} /><Mini label="Earned" val={b.earned} /><Mini label="Used" val={b.used} />
            <Mini label="Pending" val={b.pending} />
            <Mini label="Bonus earned" val={<span style={{ color: "var(--ac)" }}>+{b.bonusEarned}</span>} />
            <Mini label="Remaining" val={<span style={{ color: "var(--ok)" }}>{b.remaining}</span>} />
          </div>
        </div>
        <div className="card">
          <div className="cardhd"><div><div className="fig">ATTENDANCE SUMMARY</div><h3>{monthLabel(ctx.today.slice(0, 7))}</h3></div><Link className="mut" style={{ fontSize: 12.5 }} href="/employee/attendance">Details →</Link></div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", gap: "16px 10px" }}>
            <Mini label="Present days" val={mf.on + mf.late} /><Mini label="On time" val={mf.on} /><Mini label="Late days" val={mf.late} />
            <Mini label="On leave" val={<span style={{ color: "var(--leave)" }}>{mf.leave}</span>} />
            <Mini label="Absences" val={mf.absent} /><Mini label="Late minutes" val={mf.lateMin + "m"} />
          </div>
        </div>
      </div>

      <div className="grid g2 mt">
        <div className="card">
          <div className="fig">UPCOMING EVENTS</div><h3 style={{ marginTop: 4 }}>Holidays &amp; reminders</h3>
          <div style={{ marginTop: 8 }}>
            {upcoming.map((e, i) => {
              const d = new Date(e.d + "T00:00:00Z");
              return (
                <div className="ev" key={i}>
                  <div className="date"><b>{d.getUTCDate()}</b><span>{d.toLocaleDateString("en-PH", { month: "short", timeZone: "UTC" })}</span></div>
                  <div className="txt">{e.t}<span>{e.s}</span></div>
                  <span className={"tag " + (e.k === "hol" ? "info" : e.k === "event" ? "wait" : "")} style={{ marginLeft: "auto" }}>
                    {e.k === "hol" ? "Holiday" : e.k === "event" ? "Company event" : "HR reminder"}
                  </span>
                </div>
              );
            })}
            {upcoming.length === 0 && <p className="mut">Nothing coming up.</p>}
          </div>
        </div>
        <div className="card">
          <div className="cardhd"><div><div className="fig">RECENT NOTIFICATIONS</div><h3>Latest activity</h3></div><MarkAllReadButton /></div>
          <div>
            {notis.map((n) => (
              <Link key={n.id} href={n.link ?? "/employee/home"} className={"nitem" + (n.read ? "" : " unread")}>
                <span className="nd" /><Icon name="info" />
                <span style={{ flex: 1 }}><b>{n.title}</b><span>{n.body}</span><time>{ago(n.created_at)}</time></span>
              </Link>
            ))}
            {notis.length === 0 && <p className="mut">All caught up.</p>}
          </div>
        </div>
      </div>
    </>
  );
}
