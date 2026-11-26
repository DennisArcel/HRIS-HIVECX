import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { readToken } from "@/lib/qr";
import { manilaNow, mins } from "@/lib/dates";
import { isRest } from "@/lib/leave";

/** HR scans a code: first scan of the day = clock in, second = clock out. Server time decides the minute, never the client. */
export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, msg: "Unauthorized" }, { status: 401 });
  const { data: me } = await sb.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ ok: false, msg: "Forbidden" }, { status: 403 });

  const body = z.object({ text: z.string().max(300) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false, msg: "Bad request" }, { status: 400 });
  const tok = readToken(body.data.text);
  if ("err" in tok) return NextResponse.json({ ok: false, msg: tok.err });

  const { date, time } = manilaNow();
  const { data: emp } = await sb.from("profiles").select("id, full_name, role, hired_on, qr_version, shifts(start_time, end_time, rest_days)").eq("id", tok.id).single();
  if (!emp) return NextResponse.json({ ok: false, msg: "Unknown employee" });
  if (emp.role === "admin") {
    return NextResponse.json({ ok: false, msg: `That QR belongs to the admin account (${emp.full_name}), not an employee. Scan the employee's own badge from QR Badges.` });
  }
  // Badge QR codes carry a version. If HR generated a new QR (lost badge), the old one no longer matches.
  if (tok.v !== undefined && (emp.qr_version ?? 0) !== tok.v) {
    return NextResponse.json({ ok: false, msg: `This QR was replaced. Use ${emp.full_name}'s new badge` });
  }
  if (date < emp.hired_on) return NextResponse.json({ ok: false, msg: `${emp.full_name} has not started yet` });

  const [{ data: leave }, { data: hol }, { data: rec }] = await Promise.all([
    sb.from("leave_requests").select("id").eq("employee_id", emp.id).eq("status", "Approved").lte("from_date", date).gte("to_date", date).limit(1),
    sb.from("holidays").select("name").eq("on_date", date).maybeSingle(),
    sb.from("attendance").select("id, time_in, time_out").eq("employee_id", emp.id).eq("work_date", date).maybeSingle(),
  ]);
  if (leave?.length) return NextResponse.json({ ok: false, msg: `${emp.full_name} is on approved leave today` });

  const sh = emp.shifts as unknown as { start_time: string; end_time: string; rest_days: number[] };
  const off = hol ? "holiday" : isRest(date, { start: "", end: "", rest: sh.rest_days }) ? "rest day" : "";
  const notify = (title: string, body: string) =>
    sb.from("notifications").insert({ employee_id: emp.id, kind: "hr", title, body, link: "/employee/attendance" });
  const audit = (action: string, detail: string) => sb.from("audit_log").insert({ actor: user.id, actor_name: me.full_name, action, detail });

  if (rec?.time_in && rec?.time_out) return NextResponse.json({ ok: false, msg: `${emp.full_name} already completed today (${rec.time_in.slice(0, 5)}–${rec.time_out.slice(0, 5)})` });

  if (!rec?.time_in) {
    const late = off ? 0 : Math.max(0, mins(time) - mins(sh.start_time));
    // upsert on (employee_id, work_date): a double scan can never create two rows
    const { error } = await sb.from("attendance").upsert({ employee_id: emp.id, work_date: date, time_in: time, note: off ? `QR clock in · ${off} work` : "QR clock in" }, { onConflict: "employee_id,work_date" });
    if (error) return NextResponse.json({ ok: false, msg: "Could not save the clock-in" }, { status: 500 });
    await audit("QR clock in", `${emp.full_name} · ${date} · ${time}${late ? ` · ${late} min late` : ""}`);
    await notify(`Clocked in at ${time}`, late ? `Late by ${late} min` : "On time");
    return NextResponse.json({ ok: true, late: late > 0, msg: `${emp.full_name} clocked IN at ${time}${off ? ` · ${off} work` : late ? ` · late by ${late} min` : " · on time"}` });
  }
  if (mins(time) < mins(rec.time_in)) return NextResponse.json({ ok: false, msg: `Clock-out can't be before clock-in (${rec.time_in.slice(0, 5)})` });
  await sb.from("attendance").update({ time_out: time }).eq("id", rec.id);
  const w = mins(time) - mins(rec.time_in);
  await audit("QR clock out", `${emp.full_name} · ${date} · ${time}`);
  await notify(`Clocked out at ${time}`, `${Math.floor(w / 60)}h ${w % 60}m worked`);
  return NextResponse.json({ ok: true, msg: `${emp.full_name} clocked OUT at ${time} · ${Math.floor(w / 60)}h ${w % 60}m worked` });
}