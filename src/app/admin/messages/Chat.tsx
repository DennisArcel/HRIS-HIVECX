"use client";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import { ChatStyles } from "@/components/ChatStyles";
import { sendMessage, markRepliesRead } from "../employees/messages";

export type Emp = { id: string; name: string; code: string; avatar: string | null };
export type Sent = { id: string; employee_id: string; title: string; body: string; read: boolean; created_at: string };
export type Reply = { id: string; employee_id: string; body: string; read: boolean; created_at: string };
type Item = { id: string; out: boolean; title: string; body: string; read: boolean; created_at: string };

const DEFAULT_TITLE = "Message from HR"; // notifications.title (also shown in the employee's bell)
const tz = "Asia/Manila";
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", timeZone: tz });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { day: "numeric", month: "long", year: "numeric", timeZone: tz });

function Row({ e, last, unread, active, onPick }: { e: Emp; last?: Item; unread: number; active: boolean; onPick: () => void }) {
  return (
    <button className={"crow" + (active ? " on" : "")} onClick={onPick}>
      <Avatar name={e.name} src={e.avatar} />
      <span className="cmid">
        <b>{e.name}</b>
        <span>{last ? (last.out ? "You: " : "") + last.body : e.code}</span>
      </span>
      {last && (
        <span className="cend">
          <time suppressHydrationWarning>{time(last.created_at)}</time>
          {unread > 0 ? (
            <span className="cbadge">{unread}</span>
          ) : last.out ? (
            <span className={"ctick" + (last.read ? " read" : "")} title={last.read ? "Read" : "Delivered"}>{last.read ? "✓✓" : "✓"}</span>
          ) : null}
        </span>
      )}
    </button>
  );
}

export function Chat({ employees, sent, replies }: { employees: Emp[]; sent: Sent[]; replies: Reply[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const inflight = useRef(false);

  // employee_id -> conversation (HR messages + employee replies), oldest first
  const threads = useMemo(() => {
    const m = new Map<string, Item[]>();
    const add = (id: string, it: Item) => { const a = m.get(id); if (a) a.push(it); else m.set(id, [it]); };
    for (const s of sent) add(s.employee_id, { id: "s" + s.id, out: true, title: s.title, body: s.body, read: s.read, created_at: s.created_at });
    for (const r of replies) add(r.employee_id, { id: "r" + r.id, out: false, title: "", body: r.body, read: r.read, created_at: r.created_at });
    for (const arr of m.values()) arr.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    return m;
  }, [sent, replies]);

  const unread = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of replies) if (!r.read) m.set(r.employee_id, (m.get(r.employee_id) ?? 0) + 1);
    return m;
  }, [replies]);

  const { recent, rest } = useMemo(() => {
    const t = q.trim().toLowerCase();
    const match = employees.filter((e) => !t || e.name.toLowerCase().includes(t) || e.code.toLowerCase().includes(t));
    const lastAt = (e: Emp) => { const a = threads.get(e.id); return a ? +new Date(a[a.length - 1].created_at) : 0; };
    return {
      recent: match.filter((e) => threads.has(e.id)).sort((a, b) => lastAt(b) - lastAt(a)),
      rest: match.filter((e) => !threads.has(e.id)),
    };
  }, [employees, threads, q]);

  const emp = employees.find((e) => e.id === sel) ?? null;
  const thread = (sel && threads.get(sel)) || [];
  const unreadSel = sel ? unread.get(sel) ?? 0 : 0;

  // pick up new replies without a manual reload
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) router.refresh(); }, 8000);
    return () => clearInterval(t);
  }, [router]);

  // opening a conversation marks that employee's replies as read
  useEffect(() => {
    if (!sel || unreadSel === 0 || inflight.current) return;
    inflight.current = true;
    markRepliesRead(sel).finally(() => { inflight.current = false; router.refresh(); });
  }, [sel, unreadSel, router]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [sel, thread.length]);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!sel || !body || pending) return;
    const fd = new FormData();
    fd.set("to", sel);
    fd.set("title", DEFAULT_TITLE);
    fd.set("body", body);
    setErr("");
    start(async () => {
      const r = await sendMessage(fd);
      if ("error" in r) return setErr(r.error);
      setText("");
      router.refresh();
    });
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  }

  const last = (id: string) => { const a = threads.get(id); return a ? a[a.length - 1] : undefined; };
  let prevDay = "";

  return (
    <div className={"chat" + (sel ? " has-sel" : "")}>
      <ChatStyles />
      <aside className="chat-side">
        <h2>Recent Messages</h2>
        <label className="chat-search">
          <Icon name="search" />
          <input placeholder="Search employee..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search employees" />
        </label>
        {recent.map((e) => (
          <Row key={e.id} e={e} last={last(e.id)} unread={unread.get(e.id) ?? 0} active={e.id === sel} onPick={() => { setSel(e.id); setErr(""); }} />
        ))}
        {rest.length > 0 && (
          <>
            <div className="chat-sec"><Icon name="msg" /> All Employees</div>
            {rest.map((e) => (
              <Row key={e.id} e={e} unread={0} active={e.id === sel} onPick={() => { setSel(e.id); setErr(""); }} />
            ))}
          </>
        )}
        {recent.length + rest.length === 0 && <p className="mut" style={{ margin: "8px" }}>No employees found.</p>}
      </aside>

      <section className="chat-main">
        {!emp ? (
          <div className="chat-body"><p className="chat-empty">Select an employee to start a conversation.</p></div>
        ) : (
          <>
            <div className="chat-head">
              <button className="ib" aria-label="Back" onClick={() => setSel(null)}><Icon name="left" /></button>
              <Avatar name={emp.name} src={emp.avatar} size="lg" />
              <div><b>{emp.name}</b><small>{emp.code}</small></div>
            </div>

            <div className="chat-body" ref={bodyRef}>
              {thread.length === 0 && <p className="chat-empty">No messages yet. Say hello 👋</p>}
              {thread.map((m) => {
                const d = day(m.created_at);
                const showDay = d !== prevDay;
                prevDay = d;
                return (
                  <div key={m.id} style={{ display: "contents" }}>
                    {showDay && <div className="cday">{d}</div>}
                    {m.out ? (
                      <div className="cmsg out">
                        <div className="cwrap">
                          <div className="cmeta" suppressHydrationWarning>{time(m.created_at)}</div>
                          <div className="cbub">
                            {m.title && m.title !== DEFAULT_TITLE && <b>{m.title}</b>}
                            {m.body}
                          </div>
                          <div className="cfoot">
                            <span className={"ctick" + (m.read ? " read" : "")}>{m.read ? "✓✓ Read" : "✓ Delivered"}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="cmsg">
                        <Avatar name={emp.name} src={emp.avatar} size="sm" />
                        <div className="cwrap">
                          <div className="cmeta">{emp.name.split(" ")[0]} · <span suppressHydrationWarning>{time(m.created_at)}</span></div>
                          <div className="cbub">{m.body}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {err && <p className="chat-err">{err}</p>}
            <form className="chat-form" onSubmit={submit}>
              <textarea
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKey}
                maxLength={1000}
                placeholder={`Message ${emp.name.split(" ")[0]}…`}
                aria-label="Message"
              />
              <button className="chat-send" type="submit" disabled={pending || !text.trim()} aria-label="Send message">
                <Icon name="send" />
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}