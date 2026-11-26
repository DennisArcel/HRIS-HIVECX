"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { IMG_EXT, MAX_BYTES, MAX_MB, extOf } from "@/lib/doc-types";
import { removeAvatar, uploadAvatar } from "@/lib/avatar-actions";

const initials = (n: string) =>
  n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

/**
 * Round profile picture (shows initials until a photo is uploaded).
 * Click it to open a small menu: Change photo / Remove photo.
 * url = signed link of the current photo, or undefined.
 */
export function ProfileAvatar({ employeeId, name, url, size = 96 }: { employeeId: string; name: string; url?: string; size?: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"" | "upload" | "remove">("");
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function close() {
    if (busy) return;
    setOpen(false);
    setConfirm(false);
    setMsg(null);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!IMG_EXT.includes(extOf(file.name))) { setMsg({ ok: false, text: "Use a JPG or PNG." }); return; }
    if (file.size > MAX_BYTES) { setMsg({ ok: false, text: `That photo is over ${MAX_MB} MB.` }); return; }
    setBusy("upload");
    setMsg(null);
    try {
      const fd = new FormData();
      fd.set("employeeId", employeeId);
      fd.set("file", file);
      const r = await uploadAvatar(fd);
      if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
      setBusy("");
      setOpen(false);
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Upload failed. Try again." });
    } finally {
      setBusy("");
    }
  }

  async function onRemove() {
    setBusy("remove");
    setMsg(null);
    try {
      const r = await removeAvatar(employeeId);
      if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
      setBusy("");
      setOpen(false);
      setConfirm(false);
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Couldn't remove the photo. Try again." });
    } finally {
      setBusy("");
    }
  }

  const modal = open && typeof document !== "undefined"
    ? createPortal(
        <div className="pf-overlay" onClick={close}>
          <div className="pf-modal" role="dialog" aria-modal="true" aria-label="Profile picture" onClick={(e) => e.stopPropagation()}>
            <div className="pf-big">
              {url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={url} alt={name} /> : <span>{initials(name)}</span>}
            </div>
            <b style={{ fontSize: 26, marginTop: 6 }}>{name}</b>
            <span style={{ fontSize: 14, opacity: 0.65 }}>JPG or PNG &middot; up to {MAX_MB} MB</span>

            <div className="pf-actions">
              <button type="button" className="pf-btn pf-primary" disabled={!!busy} onClick={() => input.current?.click()}>
                {busy === "upload" ? "Uploading\u2026" : url ? "Edit photo" : "Upload photo"}
              </button>
              {url && !confirm && (
                <button type="button" className="pf-btn" disabled={!!busy} onClick={() => setConfirm(true)}>Remove photo</button>
              )}
              {url && confirm && (
                <div className="pf-confirm">
                  <span>Remove your photo?</span>
                  <button type="button" className="pf-btn pf-danger" disabled={!!busy} onClick={onRemove}>{busy === "remove" ? "Removing\u2026" : "Yes, remove"}</button>
                  <button type="button" className="pf-btn" disabled={!!busy} onClick={() => setConfirm(false)}>Cancel</button>
                </div>
              )}
              <button type="button" className="pf-btn pf-ghost" disabled={!!busy} onClick={close}>Close</button>
            </div>
            {msg && <span style={{ fontSize: 13, color: msg.ok ? "var(--ok, #3ecf8e)" : "var(--bad, #ff6b6b)" }}>{msg.text}</span>}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 6, flex: "none" }}>
      <style suppressHydrationWarning>{`
.pf-ava { position: relative; display: block; flex: none; padding: 0; border: 0; background: none; color: var(--tx); cursor: pointer; transition: transform .3s cubic-bezier(.2, .9, .3, 1.5); }
.pf-ava:hover { transform: scale(1.08); }
.pf-clip { position: absolute; inset: 0; overflow: hidden; border-radius: 50%; border: 3px solid var(--bd, #2a2a2a); background: #222; display: flex; align-items: center; justify-content: center; font-weight: 700; transition: border-color .3s; }
.pf-ava:hover .pf-clip { border-color: var(--ac, #f5b800); }
.pf-clip img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center top; display: block; }
.pf-cam { position: absolute; right: -4px; bottom: -4px; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--ac, #f5b800); color: #111; border: 2px solid var(--bg, #0b0b0b); font-size: 12px; font-weight: 700; }

@keyframes pf-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes pf-pop { from { opacity: 0; transform: scale(.85) translateY(16px); } to { opacity: 1; transform: none; } }
.pf-overlay { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 20px; background: rgba(0, 0, 0, .65); backdrop-filter: blur(3px); animation: pf-fade .2s ease both; }
.pf-modal { width: min(500px, 100%); max-height: 94vh; overflow-y: auto; display: grid; justify-items: center; gap: 12px; padding: 36px 32px 28px; border-radius: 24px; text-align: center; background: var(--card, #141414); color: var(--tx, #f2f2f2); border: 1px solid var(--bd, #2a2a2a); box-shadow: 0 24px 60px rgba(0, 0, 0, .6); animation: pf-pop .35s cubic-bezier(.2, .9, .3, 1.3) both; }
.pf-big { position: relative; width: min(300px, 70vw); height: min(300px, 70vw); border-radius: 50%; overflow: hidden; display: grid; place-items: center; font-size: 110px; font-weight: 700; background: #222; border: 4px solid var(--ac, #f5b800); }
.pf-big img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center top; }
.pf-actions { display: grid; gap: 10px; width: 100%; margin-top: 12px; }
.pf-btn { cursor: pointer; font: inherit; font-size: 16px; padding: 14px 20px; border-radius: 999px; border: 1px solid var(--bd, #333); background: transparent; color: var(--tx, #f2f2f2); transition: transform .2s, background .2s, color .2s, border-color .2s; }
.pf-btn:hover:not([disabled]) { transform: scale(1.03); border-color: var(--ac, #f5b800); }
.pf-btn[disabled] { opacity: .55; cursor: default; }
.pf-primary { background: var(--ac, #f5b800); color: #111; border-color: var(--ac, #f5b800); font-weight: 600; }
.pf-danger { background: #c0392b; border-color: #c0392b; color: #fff; }
.pf-ghost { border-color: transparent; opacity: .75; }
.pf-confirm { display: grid; gap: 10px; padding: 14px; border-radius: 16px; border: 1px dashed var(--bd, #444); font-size: 15px; }
@media (prefers-reduced-motion: reduce) { .pf-ava:hover, .pf-btn:hover { transform: none; } .pf-overlay, .pf-modal { animation: none; } }
      `}</style>
      <input ref={input} suppressHydrationWarning type="file" accept=".jpg,.jpeg,.png" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; onFile(f); }} />
      <button type="button" suppressHydrationWarning className="pf-ava" style={{ width: size, height: size }} onClick={() => setOpen(true)} title="Profile picture" aria-label="Profile picture options">
        <span className="pf-clip">
          {url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={url} alt={name} /> : <span style={{ fontSize: size * 0.34 }}>{initials(name)}</span>}
        </span>
        <span className="pf-cam">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </span>
      </button>
      {modal}
    </div>
  );
}