"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ACCEPT, IMG_EXT, MAX_BYTES, MAX_MB, WORKER_LABEL, extOf, labelFor, normalizeWorker, requirementsFor } from "@/lib/doc-types";
import { deleteDocument, documentUrl, uploadDocument } from "@/lib/document-actions";
import { DocStyles } from "@/components/DocStyles";

export type DocRow = { id: string; doc_type: string; file_name: string; size_bytes: number | null; date: string; by: string };

const size = (n: number | null) =>
  n == null ? "" : n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";

/**
 * Required-documents summary + one card per uploaded file (preview on top, details and buttons below).
 * previews = { [documentId]: signedUrl } for images and PDFs.
 * Used on the employee page (admin=false) and the admin per-employee page (admin=true).
 */
export function DocumentsPanel({
  employeeId,
  docs,
  previews = {},
  workerType,
  admin = false,
}: {
  employeeId: string;
  docs: DocRow[];
  previews?: Record<string, string>;
  workerType?: string | null;
  admin?: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const target = useRef("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const type = normalizeWorker(workerType);
  const { required, optional } = requirementsFor(type);
  const have = new Set(docs.map((d) => d.doc_type));
  const done = required.filter((k) => have.has(k)).length;
  const pct = required.length ? Math.round((done / required.length) * 100) : 100;
  const [addType, setAddType] = useState(required.find((k) => !have.has(k)) ?? "other");

  function pick(key: string) {
    target.current = key;
    input.current?.click();
  }

  async function onFile(file: File | undefined) {
    const key = target.current;
    if (!file || !key) return;
    if (file.size === 0) { setMsg({ ok: false, text: "That file is empty." }); return; }
    if (file.size > MAX_BYTES) { setMsg({ ok: false, text: `That file is over ${MAX_MB} MB.` }); return; }
    setBusyKey(key);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.set("employeeId", employeeId);
      fd.set("docType", key);
      fd.set("file", file);
      const r = await uploadDocument(fd);
      if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
      setMsg({ ok: true, text: `${labelFor(key)} uploaded.` });
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Upload failed. Check the file size and try again." });
    } finally {
      setBusyKey(null);
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
    <div style={{ display: "grid", gap: 18 }}>
      <DocStyles />
      <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; onFile(f); }} />

      <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <span className="fig">REQUIRED DOCUMENTS &middot; {WORKER_LABEL[type].toUpperCase()}</span>
          <span className="mut">{done} / {required.length} uploaded</span>
        </div>
        <div className={"dc-bar" + (pct === 100 ? " done" : "")}><i style={{ width: `${pct}%` }} /></div>
        <div className="dc-chips">
          {required.map((k) =>
            have.has(k) ? (
              <span key={k} className="tag ok">{labelFor(k)} &middot; uploaded</span>
            ) : (
              <button key={k} type="button" className="tag wait dc-chip" disabled={busyKey === k} onClick={() => pick(k)}>
                {busyKey === k ? "Uploading\u2026" : `+ ${labelFor(k)}`}
              </button>
            )
          )}
        </div>
        <p className="mut" style={{ fontSize: 12.5, margin: 0 }}>
          Tap a missing item to upload it. PDF, Word, JPG or PNG &middot; up to {MAX_MB} MB per file.
        </p>
        {msg && <p style={{ margin: 0, fontSize: 13.5, color: msg.ok ? "var(--ok)" : "var(--bad)" }}>{msg.text}</p>}
      </div>

      <div className="dc-grid" style={{ padding: 0 }}>
        {docs.map((d, i) => {
          const url = previews[d.id];
          const ext = extOf(d.file_name);
          const isImg = IMG_EXT.includes(ext);
          return (
            <div key={d.id} className="dc-card" style={{ animationDelay: `${i * 70}ms` }}>
              <div className="dc-prev click" onClick={() => view(d.id)} title="Open file">
                {url && isImg && /* eslint-disable-next-line @next/next/no-img-element */ <img src={url} alt={d.file_name} />}
                {url && !isImg && <iframe src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`} title={d.file_name} />}
                {!url && (
                  <div className="dc-empty">
                    <span className="dc-ext">{ext ? ext.toUpperCase() : "FILE"}</span>
                    <span>No preview for this file type</span>
                  </div>
                )}
                <span className="dc-prev-tag">{labelFor(d.doc_type)}</span>
              </div>
              <div className="dc-body">
                <b style={{ fontSize: 15 }}>{labelFor(d.doc_type)}</b>
                <div>
                  <div className="dc-doc-meta" title={d.file_name}>{d.file_name}</div>
                  <div className="dc-doc-meta">{size(d.size_bytes)} &middot; {d.date} &middot; added by {d.by}</div>
                </div>
                <div className="dc-actions">
                  <button type="button" className="dc-mini" onClick={() => view(d.id)}>Open</button>
                  {admin && (confirmId === d.id ? (
                    <>
                      <span className="mut" style={{ fontSize: 13 }}>Delete?</span>
                      <button type="button" className="dc-mini" onClick={() => remove(d.id)}>Yes</button>
                      <button type="button" className="dc-mini" onClick={() => setConfirmId(null)}>No</button>
                    </>
                  ) : (
                    <button type="button" className="dc-mini" onClick={() => setConfirmId(d.id)}>Delete</button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        <div className="dc-add" style={{ animationDelay: `${docs.length * 70}ms` }}>
          <div className="dc-plus">+</div>
          <b>Add a document</b>
          <select value={addType} onChange={(e) => setAddType(e.target.value)}>
            {[...required, ...optional].map((k) => <option key={k} value={k}>{labelFor(k)}{required.includes(k) ? "" : " (optional)"}</option>)}
          </select>
          <button type="button" className="dc-mini" disabled={busyKey === addType} onClick={() => pick(addType)}>
            {busyKey === addType ? "Uploading\u2026" : "Choose file"}
          </button>
        </div>
      </div>

      {docs.length === 0 && <p className="mut" style={{ margin: 0 }}>No documents uploaded yet.</p>}
    </div>
  );
}