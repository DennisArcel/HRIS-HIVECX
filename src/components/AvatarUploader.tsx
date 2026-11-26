"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IMG_EXT, MAX_BYTES, MAX_MB, extOf } from "@/lib/doc-types";
import { removeAvatar, uploadAvatar } from "@/lib/avatar-actions";
import { DocStyles } from "@/components/DocStyles";

/** Round profile picture with a Change photo button. url = signed link of the current photo (or undefined). */
export function AvatarUploader({ employeeId, name, url }: { employeeId: string; name: string; url?: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!IMG_EXT.includes(extOf(file.name))) { setMsg({ ok: false, text: "Use a JPG or PNG photo." }); return; }
    if (file.size > MAX_BYTES) { setMsg({ ok: false, text: `That photo is over ${MAX_MB} MB.` }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.set("employeeId", employeeId);
      fd.set("file", file);
      const r = await uploadAvatar(fd);
      if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
      setMsg({ ok: true, text: "Profile picture updated." });
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Upload failed. Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await removeAvatar(employeeId);
      if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
      setMsg({ ok: true, text: "Profile picture removed." });
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Couldn't remove the photo." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dc-ava-wrap">
      <DocStyles />
      <input ref={input} type="file" accept=".jpg,.jpeg,.png" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; onFile(f); }} />
      <div className="dc-ava">
        {url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={url} alt={name} /> : (name.trim().charAt(0) || "?").toUpperCase()}
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <b>Profile picture</b>
        <span className="mut" style={{ fontSize: 12.5 }}>JPG or PNG &middot; up to {MAX_MB} MB</span>
        <span><button type="button" className="dc-mini" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Working\u2026" : url ? "Change photo" : "Upload photo"}</button>{url && <> <button type="button" className="dc-mini" disabled={busy} onClick={remove}>Remove photo</button></>}</span>
        {msg && <span style={{ fontSize: 13, color: msg.ok ? "var(--ok)" : "var(--bad)" }}>{msg.text}</span>}
      </div>
    </div>
  );
}