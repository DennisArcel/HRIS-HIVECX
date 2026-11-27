"use client";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import { ChatStyles } from "@/components/ChatStyles";
import { ago } from "@/lib/employee-calc";
import { markAllRead } from "@/app/employee/actions";
import { sendReply } from "@/app/employee/reply";
import type { Noti } from "@/components/employee-chrome";

export type Reply = { id: string; body: string; read: boolean; created_at: string };
type Item = { id: string; fromHr: boolean; title: string; body: string; read: boolean; created_at: string };

const DEFAULT_TITLE = "Message from HR";
const tz = "Asia/Manila";
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", timeZone: tz });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { day: "numeric", month: "long", year: "numeric", timeZone: tz });

export function MessagesList({
  msgs, replies, me,
}: { msgs: Noti[]; replies: Reply[]; me: { name: string; avatar: string | null } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false); // mobile: show the conversation pane
  const bodyRef = useRef<HTMLDivElement>(null);
  const inflight = useRef(false);

  const unread = msgs.filter((m) => !m.read).length;

  const all = useMemo<Item[]>(() => {
    const a: Item[] = [
      ...msgs.map((m) => ({ id: "m" + m.id, fromHr: true, title: m.title, body: m.body, read: m.read, created_at: m.created_at })),
      ...replies.map((r) => ({ id: "r" + r.id, fromHr: false, title: "", body: r.body, read: r.read, created_at: r.created_at })),
    ];
    return a.sort((x, y) => +new Date(x.created_at) - +new Date(y.created_at));
  }, [msgs, replies]);

  const thread = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all.filter((m) => !t || m.title.toLowerCase().includes(t) || m.body.toLowerCase().includes(t));
  }, [all, q]);

  const last = all[all.length - 1];

  // pick up new HR messages without a manual reload
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) router.refresh(); }, 8000);
    return () => clearInterval(t);
  }, [router]);

  // opening the conversation marks HR's messages as read (HR sees ✓✓)
  useEffect(() => {
    if (unread === 0 || inflight.current) return;
    inflight.current = true;
    markAllRead().finally(() => { inflight.current = false; router.refresh(); });
  }, [unread, router]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [thread.length]);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || pending) return;
    setErr("");
    start(async () => {
      const r = await sendReply(body);
      if ("error" in r) return setErr(r.error);
      setText("");
      router.refresh();
    });
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  }

  let prevDay = "";

  return (
    <div className={"chat" + (open ? " has-sel" : "")}>
      <ChatStyles />
      <aside className="chat-side">
        <h2>Recent Messages</h2>
        <label className="chat-search">
          <Icon name="search" />
          <input placeholder="Search here..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search messages" />
        </label>
        <button className="crow on" onClick={() => setOpen(true)}>
          <Avatar name="HR" text="HR" />
          <span className="cmid">
            <b>HR Department</b>
            <span>{last ? (last.fromHr ? "" : "You: ") + last.body : "No messages yet"}</span>
          </span>
          <span className="cend">
            {last && <time>{ago(last.created_at)}</time>}
            {unread > 0 && <span className="cbadge">{unread}</span>}
          </span>
        </button>
      </aside>

      <section className="chat-main">
        <div className="chat-head">
          <button className="ib" aria-label="Back" onClick={() => setOpen(false)}><Icon name="left" /></button>
          <Avatar name="HR" text="HR" size="lg" />
          <div>
            <b>HR Department</b>
            <small>{all.length} message{all.length === 1 ? "" : "s"}</small>
          </div>
        </div>

        <div className="chat-body" ref={bodyRef}>
          {thread.length === 0 && (
            <p className="chat-empty">{all.length === 0 ? "No messages yet." : "No messages match your search."}</p>
          )}
          {thread.map((m) => {
            const d = day(m.created_at);
            const showDay = d !== prevDay;
            prevDay = d;
            return (
              <div key={m.id} style={{ display: "contents" }}>
                {showDay && <div className="cday">{d}</div>}
                {m.fromHr ? (
                  <div className="cmsg">
                    <Avatar name="HR" text="HR" size="sm" />
                    <div className="cwrap">
                      <div className="cmeta">HR · <span suppressHydrationWarning>{time(m.created_at)}</span></div>
                      <div className="cbub">
                        {m.title && m.title !== DEFAULT_TITLE && <b>{m.title}</b>}
                        {m.body}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="cmsg out">
                    <Avatar name={me.name} src={me.avatar} size="sm" />
                    <div className="cwrap">
                      <div className="cmeta" suppressHydrationWarning>{time(m.created_at)}</div>
                      <div className="cbub">{m.body}</div>
                      <div className="cfoot">
                        <span className={"ctick" + (m.read ? " read" : "")}>{m.read ? "✓✓ Read" : "✓ Delivered"}</span>
                      </div>
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
            placeholder="Reply to HR…"
            aria-label="Reply to HR"
          />
          <button className="chat-send" type="submit" disabled={pending || !text.trim()} aria-label="Send reply">
            <Icon name="send" />
          </button>
        </form>
      </section>
    </div>
  );
}