"use client";
import { useActionState, useState } from "react";
import { signIn } from "./actions";

const Check = () => (
  <svg className="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
  </svg>
);

// Same honeycomb art as hexArt() in the old core.js
function HexArt() {
  const r = 26, w = Math.sqrt(3) * r, on = [2, 5, 6, 9, 12, 14];
  let i = 0, cx = 0, cy = 0;
  const cells: React.ReactNode[] = [];
  for (let a = 0; a < 4; a++)
    for (let b = 0; b < 5; b++) {
      const x = b * w + (a % 2 ? w / 2 : 0) + w / 2 + 8, y = a * r * 1.5 + r + 8;
      const pts = [0, 1, 2, 3, 4, 5].map((k) => {
        const t = (Math.PI / 180) * (60 * k - 30);
        return (x + r * 0.92 * Math.cos(t)).toFixed(1) + "," + (y + r * 0.92 * Math.sin(t)).toFixed(1);
      }).join(" ");
      if (i === 7) { cx = x; cy = y; }
      cells.push(<polygon key={i} points={pts} className={"hx" + (i === 7 ? " core" : on.includes(i) ? " on" : "")} />);
      i++;
    }
  return (
    <svg className="hex" viewBox={`0 0 ${(5.5 * w + 16).toFixed(0)} ${(3 * r * 1.5 + 2 * r + 16).toFixed(0)}`} aria-hidden="true">
      {cells}
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize="13" fontWeight="700" fill="#0b0b0a">HR</text>
    </svg>
  );
}

export default function SignIn() {
  const [state, action, pending] = useActionState(signIn, {});
  const [show, setShow] = useState(false);
  return (
    <div className="login">
      <div className="login__art">
        <div className="fig">HIVE HRIS · HUMAN RESOURCE INFORMATION SYSTEM</div>
        <h1>People work,<br /><em>moving forward.</em></h1>
        <p className="mut" style={{ maxWidth: "46ch", margin: 0 }}>
          Attendance, leave, payslips and people — one connected HR platform for the whole team.
        </p>
        <ul>
          <li><Check /> Live attendance with clock in / clock out</li>
          <li><Check /> Automatic leave balances &amp; monthly attendance bonus</li>
          <li><Check /> Payslips, announcements and notifications</li>
        </ul>
        <HexArt />
      </div>
      <div className="login__form">
        <div className="logo"><i className="hxi" /><span>Hive HRIS<small>Sign in to continue</small></span></div>
        <form action={action} noValidate>
          <div className="full">
            <label htmlFor="lgU">Email or username <span className="req">*</span></label>
            <input id="lgU" name="identifier" autoComplete="username" placeholder="username or email" required />
          </div>
          <div className="full">
            <label htmlFor="lgP">Password <span className="req">*</span></label>
            <div className="pw">
              <input id="lgP" name="password" type={show ? "text" : "password"} autoComplete="current-password" placeholder="Your password" required />
              <button type="button" onClick={() => setShow((s) => !s)}>{show ? "Hide" : "Show"}</button>
            </div>
          </div>
          {state.error && <div className="err-box" role="alert">{state.error}</div>}
          <div className="full"><button className="pri wide" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button></div>
          <div className="hintbox">First time here? Sign in with the username and temporary password HR gave you — you'll finish your profile and choose your own password next.</div>
        </form>
      </div>
    </div>
  );
}