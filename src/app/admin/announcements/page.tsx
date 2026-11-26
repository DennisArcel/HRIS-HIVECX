import { supabaseServer } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/fmt";
import { AnnouncementForm } from "./AnnouncementForm";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("announcements")
    .select("id, title, body, priority, pinned, posted_on")
    .order("pinned", { ascending: false })
    .order("posted_on", { ascending: false })
    .order("id", { ascending: false });
  const list = data ?? [];

  return (
    <>
      <div className="eyebrow">HR Admin / Announcements</div>
      <h1>
        Tell everyone,
        <br />
        <em>once.</em>
      </h1>
      <p className="lead">
        Posts appear at the top of every employee&apos;s home screen. Pin urgent ones so they can&apos;t be missed.
      </p>

      <AnnouncementForm />

      <div className="card mt">
        <div className="cardhd">
          <div>
            <div className="fig">POSTED</div>
            <h3>{list.length} announcements</h3>
          </div>
        </div>
        <div className="announce">
          {list.length === 0 && <p className="mut">Nothing posted yet.</p>}
          {list.map((a) => (
            <div className={"an" + (a.pinned ? " top" : "")} key={a.id}>
              {a.pinned && <span className="pin">Pinned</span>}
              <div className="anhd">
                <span className={"tag " + (a.priority === "Urgent" ? "bad" : a.priority === "High" ? "wait" : "")}>
                  {a.priority}
                </span>
                <b>{a.title}</b>
                <time>{fmtDate(a.posted_on)}</time>
                <span className="mut" style={{ fontSize: 12, marginLeft: "auto" }}>HR</span>
              </div>
              <p>{a.body}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}