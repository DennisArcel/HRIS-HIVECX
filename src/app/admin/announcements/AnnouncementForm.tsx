"use client";
import { FormEvent, useState, useTransition } from "react";
import { postAnnouncement } from "./actions";

export function AnnouncementForm() {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setErr("");
    setOk(false);
    start(async () => {
      const r = await postAnnouncement(fd);
      if (r.error) return setErr(r.error);
      form.reset();
      setOk(true);
    });
  }

  return (
    <div className="card">
      <h3>New announcement</h3>
      <form onSubmit={onSubmit} noValidate>
        {err && <p className="err-box"><span>{err}</span></p>}
        <div>
          <label htmlFor="anT">Title <span className="req">*</span></label>
          <input id="anT" name="t" required placeholder="e.g. Office closed Nov 30" />
        </div>
        <div>
          <label htmlFor="anP">Priority</label>
          <select id="anP" name="pri">
            <option>Normal</option>
            <option>High</option>
            <option>Urgent</option>
          </select>
        </div>
        <div className="full">
          <label htmlFor="anB">Message <span className="req">*</span></label>
          <textarea id="anB" name="b" rows={3} required placeholder="What should everyone know?" />
        </div>
        <div className="full">
          <label className="chk"><input type="checkbox" name="pin" /> Pin to the top of the home page</label>
        </div>
        <div>
          <button className="pri" type="submit" disabled={pending}>
            {pending ? "Posting…" : "Post announcement"}
          </button>
          {ok && <span className="mut" style={{ marginLeft: 12 }}>Posted to everyone&apos;s home page.</span>}
        </div>
      </form>
    </div>
  );
}