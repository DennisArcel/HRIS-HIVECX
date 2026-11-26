"use client";
import { useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ACCEPT, DOC_TYPES, MAX_BYTES, MAX_MB, labelFor } from "@/lib/doc-types";
import { deleteDocument, documentUrl, uploadDocument } from "@/lib/document-actions";

export type DocRow = { id: string; doc_type: string; file_name: string; size_bytes: number | null; date: string; by: string };

const field: CSSProperties = {
  background: "var(--bg)", color: "var(--tx)", border: "1px solid var(--bd, #333)", borderRadius: 10, padding: "10px 12px", font: "inherit",
};
const primary: CSSProperties = {
  background: "var(--ac)", color: "#111", fontWeight: 600, padding: "10px 18px", borderRadius: 999, border: 0, cursor: "pointer",
};

const size = (n: number | null) =>
  n == null ? "" : n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";

/** Upload form + document list. Used on the employee setup page (admin=false) and the admin pages (admin=true). */
export function DocumentsPanel({ employeeId, docs, admin = false }: { employeeId: string; docs: DocRow[]; admin?: boolean }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const have = new Set(docs.map((d) => d.doc_type));

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("employeeId", employeeId);
    const f = fd.get("file") as File | null;
    if (!f || f.size === 0) { setMsg({ ok: false, text: "Choose a file first." }); return; }
    if (f.size > MAX_BYTES) { setMsg({ ok: false, text: `That file is over ${MAX_MB} MB.` }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const r = await uploadDocument(fd);
      if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
      form.current?.reset();
      setMsg({ ok: true, text: "Uploaded." });
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Upload failed. Check the file size and try again." });
    } finally {
      setBusy(false);
    }
  }

  async function view(id: string) {
    const r = await documentUrl(id);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    window.open(r.url, "_blank", "noopener");
  }

  async function remove(id: string) {
    setConfirmId(null);
    const r = await deleteDocument(id);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    setMsg({ ok: true, text: "Deleted." });
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card" style={{ padding: 20 }}>
        <div className="fig">REQUIRED DOCUMENTS</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {DOC_TYPES.filter((t) => t.required).map((t) => (
            <span key={t.key} className={"tag " + (have.has(t.key) ? "ok" : "wait")}>
              {t.label} · {have.has(t.key) ? "uploaded" : "required"}
            </span>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div className="fig">UPLOAD A DOCUMENT</div>
        <form ref={form} onSubmit={submit} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
          <select name="docType" defaultValue="resume" style={field}>
            {DOC_TYPES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}{t.required ? " (required)" : ""}</option>
            ))}
          </select>
          <input name="file" type="file" accept={ACCEPT} style={{ ...field, maxWidth: 280 }} />
          <button type="submit" style={{ ...primary, opacity: busy ? 0.6 : 1 }} disabled={busy}>
            {busy ? "Uploading…" : "Upload"}
          </button>
        </form>
        <p className="mut" style={{ fontSize: 12.5, margin: "10px 0 0" }}>PDF, Word, JPG or PNG · up to {MAX_MB} MB per file.</p>
        {msg && <p style={{ margin: "10px 0 0", fontSize: 13.5, color: msg.ok ? "var(--ok)" : "var(--bad)" }}>{msg.text}</p>}
      </div>

      <div className="card" style={{ padding: "6px 20px" }}>
        {docs.length === 0 && <p className="mut" style={{ margin: "14px 0" }}>No documents uploaded yet.</p>}
        {docs.map((d) => (
          <div
            key={d.id}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 0", borderBottom: "1px solid var(--bd, #2a2a2a)" }}
          >
            <span>
              <b>{labelFor(d.doc_type)}</b>
              <div className="mut" style={{ fontSize: 12.5 }}>
                {d.file_name} · {size(d.size_bytes)} · {d.date} · added by {d.by}
              </div>
            </span>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button type="button" className="btn" onClick={() => view(d.id)}>Open</button>
              {admin && (confirmId === d.id ? (
                <>
                  <span className="mut" style={{ fontSize: 13 }}>Delete?</span>
                  <button type="button" className="btn" onClick={() => remove(d.id)}>Yes</button>
                  <button type="button" className="btn" onClick={() => setConfirmId(null)}>No</button>
                </>
              ) : (
                <button type="button" className="btn" onClick={() => setConfirmId(d.id)}>Delete</button>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
