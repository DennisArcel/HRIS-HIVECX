"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import type QrScannerType from "qr-scanner";
import { Icon } from "@/components/Icon";
import { simulateToken } from "./actions";

type Emp = { id: string; name: string; no: string | null };
type Log = { ok: boolean; late?: boolean; msg: string; t: string };
type Cam = { id: string; label: string };

const hm = () => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());

export function ScanClient({ employees, initialLog = [] }: { employees: Emp[]; initialLog?: Log[] }) {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<Log[]>(initialLog);   // today's scans come from the database, so they survive leaving the tab
  const [banner, setBanner] = useState<Log | null>(null);
  const [camErr, setCamErr] = useState("");
  const [cams, setCams] = useState<Cam[]>([]);
  const [camId, setCamId] = useState("");
  const [sim, setSim] = useState(employees[0]?.id ?? "");
  const [pending, start] = useTransition();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanner = useRef<QrScannerType | null>(null);
  const lastText = useRef("");                            // last code the camera saw
  const lastSeen = useRef(0);                             // when the camera last saw it
  const lastHit = useRef<Record<string, number>>({});    // min. 60 s between a clock-in and a clock-out
  const busy = useRef(false);

  async function handle(text: string, force: boolean) {
    if (busy.current) return;
    const id = text.split("|")[1] ?? text;               // only used for client-side de-duplication; the server verifies the signature
    let res: Log;
    const wait = 60 - Math.floor((Date.now() - (lastHit.current[id] ?? 0)) / 1000);
    if (!force && wait > 0) {
      res = { ok: false, msg: `Already scanned a moment ago — wait ${wait}s before the next scan`, t: hm() };
    } else {
      busy.current = true;
      try {
        const r = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
        const j = (await r.json().catch(() => null)) as { ok: boolean; msg: string; late?: boolean } | null;
        res = { ok: !!j?.ok, late: j?.late, msg: j?.msg ?? (r.status === 401 ? "Unauthorized — please sign in again" : "Scan failed"), t: hm() };
        if (j?.ok) lastHit.current[id] = Date.now();
      } catch { res = { ok: false, msg: "Could not reach the server", t: hm() }; }
      finally { busy.current = false; }
    }
    setBanner(res);
    setLog((l) => [res, ...l].slice(0, 50));
  }
  const handleRef = useRef(handle); handleRef.current = handle;

  // Badge QR codes never change, so "same code" can't mean "already scanned".
  // Instead: while the same badge stays in front of the camera it counts once;
  // take it away (1.5 s) and show it again, and it counts as a new scan.
  function onDecode(text: string) {
    const now = Date.now();
    const holding = text === lastText.current && now - lastSeen.current < 1500;
    lastText.current = text; lastSeen.current = now;
    if (!holding) void handleRef.current(text, false);
  }

  async function startCam() {
    const video = videoRef.current;
    if (scanner.current || !video) return;
    setCamErr("");
    try {
      // qr-scanner decodes in a background worker and copes much better with webcams, screens and tilted codes
      const { default: QrScanner } = await import("qr-scanner");
      if (!(await QrScanner.hasCamera())) {
        setCamErr("No camera found on this device. Use “Simulate a scan” to test.");
        return;
      }
      const sc = new QrScanner(video, (r) => onDecode(r.data), {
        preferredCamera: "environment",   // falls back to the laptop webcam automatically
        maxScansPerSecond: 25,
        returnDetailedScanResult: true,
        highlightScanRegion: false,       // off: the library draws these boxes mirrored, which would not line up
        highlightCodeOutline: false,
        // look at (almost) the whole picture, at higher detail than the default, so the badge can be farther away
        calculateScanRegion: (v) => {
          const side = Math.round(Math.min(v.videoWidth, v.videoHeight) * 0.9);
          const out = Math.min(side, 900);
          return {
            x: Math.round((v.videoWidth - side) / 2),
            y: Math.round((v.videoHeight - side) / 2),
            width: side,
            height: side,
            downScaledWidth: out,
            downScaledHeight: out,
          };
        },
      });
      scanner.current = sc;
      setRunning(true);
      await sc.start();
      const list = await QrScanner.listCameras(true);
      setCams(list.map((c) => ({ id: c.id, label: c.label })));
    } catch (e) {
      try { scanner.current?.destroy(); } catch {}
      scanner.current = null; setRunning(false);
      const m = String(e instanceof Error ? e.message : e);
      setCamErr(/denied|permission|NotAllowed/i.test(m)
        ? "Camera access was blocked. Click the camera icon in the address bar, allow it, then press Start camera again."
        : "Couldn't open the camera (" + m + "). Close other apps that use it, or use “Simulate a scan” to test.");
    }
  }
  async function stopCam() {
    const sc = scanner.current; scanner.current = null; setRunning(false); setCams([]);
    if (sc) { try { sc.stop(); sc.destroy(); } catch {} }
  }
  async function switchCam(id: string) {
    setCamId(id);
    try { await scanner.current?.setCamera(id); } catch { setCamErr("Couldn't switch to that camera."); }
  }
  useEffect(() => () => { void stopCam(); }, []);  // release the camera when leaving the page

  return (
    <>
      {banner && (
        <div className={"hintbox"} role="status" aria-live="polite"
          style={{ marginBottom: 14, color: banner.ok ? (banner.late ? "var(--warn)" : "var(--ok)") : "var(--bad)" }}>
          {banner.msg}
        </div>
      )}
      <div className="grid g2">
        <div className="card">
          <div className="cardhd"><div><div className="fig">CAMERA</div><h3>Scan employee QR</h3></div></div>
          {/* qr-scanner mirrors laptop (front) cameras by default; this keeps the picture the normal way round */}
          <style>{`.scanvideo{transform:none !important}`}</style>
          {/* The video must stay display:block at all times: if it is hidden when the scanner starts,
              qr-scanner shrinks it to 0 px and the picture never shows (the camera still scans, invisibly). */}
          <div style={{ position: "relative", aspectRatio: "4 / 3", borderRadius: 12, overflow: "hidden", background: "#000" }}>
            <video
              ref={videoRef}
              className="scanvideo"
              muted
              playsInline
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
            {!running && (
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#9a9a9a", fontSize: 13 }}>
                The camera picture appears here
              </div>
            )}
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="pri" onClick={startCam} disabled={running}><Icon name="qr" /> Start camera</button>
            <button onClick={stopCam} disabled={!running}>Stop</button>
          </div>
          {cams.length > 1 && (
            <div style={{ marginTop: 12 }}>
              <label htmlFor="camSel">Camera</label>
              <select id="camSel" value={camId} onChange={(e) => void switchCam(e.target.value)}>
                <option value="" disabled>Choose a camera…</option>
                {cams.map((c) => <option key={c.id} value={c.id}>{c.label || c.id}</option>)}
              </select>
            </div>
          )}
          {camErr && <p style={{ fontSize: 12.5, margin: "10px 0 0", color: "var(--bad)" }}>{camErr}</p>}
          <p className="mut" style={{ fontSize: 12.5, margin: "10px 0 0" }}>
            Hold the badge steady, facing the camera, about 20–30 cm away. Printed badges scan best. Needs camera permission, and the page must be served over HTTPS or localhost.
          </p>
        </div>
        <div className="card">
          <div className="cardhd"><div><div className="fig">NO CAMERA?</div><h3>Simulate a scan</h3></div></div>
          <p className="mut" style={{ fontSize: 13, margin: "0 0 10px" }}>For testing on one device: pick an employee and it scans a fresh code for them.</p>
          <label htmlFor="simE">Employee</label>
          <select id="simE" value={sim} onChange={(e) => setSim(e.target.value)}>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}{e.no ? ` · ${e.no}` : ""}</option>)}
          </select>
          <div className="row" style={{ marginTop: 12 }}>
            <button disabled={pending || !sim} onClick={() => start(async () => {
              const r = await simulateToken(sim);
              if (r.ok && r.text) await handle(r.text, true);
              else setBanner({ ok: false, msg: r.msg ?? "Could not create a test code", t: hm() });
            })}>{pending ? "Scanning…" : "Simulate scan"}</button>
          </div>
        </div>
      </div>
      <div className="card mt">
        <div className="fig">RECENT SCANS</div>
        <div>
          {log.length === 0 && <p className="mut">Nothing scanned yet today.</p>}
          {log.map((l, i) => (
            <div className="ls" key={i}><span className={"tag " + (l.ok ? "ok" : "wait")}>{l.ok ? "OK" : "Check"}</span> {l.msg} <span className="mut">· {l.t}</span></div>
          ))}
        </div>
      </div>
    </>
  );
}