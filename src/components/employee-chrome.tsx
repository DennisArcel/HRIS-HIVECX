"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "./Icon";
import { ago } from "@/lib/employee-calc";
import { markAllRead, markRead, signOut } from "@/app/employee/actions";

export const EMPLOYEE_NAV = [
  { href: "/employee/home", label: "Home", icon: "home" },
  { href: "/employee/attendance", label: "Attendance", icon: "cal" },
  { href: "/employee/leave", label: "Leave", icon: "plane" },
  { href: "/employee/payslips", label: "Payslips", icon: "wallet" },
  { href: "/employee/profile", label: "My Profile", icon: "user" },
];
const NOTI_ICON: Record<string, string> = { announcement: "mega", leave: "plane", correction: "cal", payslip: "wallet", bonus: "zap", hr: "info", payroll: "wallet" };

export type Noti = { id: string | number; kind: string; title: string; body: string; link: string | null; read: boolean; created_at: string };

export function SideNav({ name, role }: { name: string; role: string }) {
  const path = usePathname();
  const [pending, start] = useTransition();
  return (
    <>
      <nav className="navgrp" aria-label="Main navigation">
        <div className="fig">MY WORKSPACE</div>
        {EMPLOYEE_NAV.map((n) => {
          const on = path === n.href || path.startsWith(n.href + "/");
          return (
            <Link key={n.href} href={n.href} className={"ni" + (on ? " on" : "")} aria-current={on ? "page" : undefined}
              onClick={() => document.body.classList.remove("menu-open")}>
              <Icon name={n.icon} /><span>{n.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="sidefoot">
        <div className="who">
          <span className="av">{name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</span>
          <span><b>{name}</b><span>{role}</span></span>
        </div>
        <button className="ni" disabled={pending} onClick={() => start(() => signOut())}>
          <Icon name="out" /><span>{pending ? "Signing out…" : "Sign out"}</span>
        </button>
      </div>
    </>
  );
}

export function TopBar({ notis }: { notis: Noti[] }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const page = EMPLOYEE_NAV.find((n) => path === n.href || path.startsWith(n.href + "/"))?.label ?? "";
  const unread = notis.filter((n) => !n.read).length;

  function toggleTheme() {
    const root = document.documentElement;
    const cur = root.getAttribute("data-theme");
    const dark = cur ? cur === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("hive.theme", next); } catch {}
  }

  return (
    <>
      <header className="bar">
        <button className="ib burger" aria-label="Toggle menu" onClick={() => document.body.classList.toggle("menu-open")}>
          <Icon name="menu" />
        </button>
        <div className="crumb">Hive HRIS · <b>{page}</b></div>
        <div className="sp" />
        <button className="ib" aria-label="Toggle colour theme" onClick={toggleTheme}><Icon name="moon" /></button>
        <button className="ib" aria-label="Notifications" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <Icon name="bell" />{unread ? <b>{unread}</b> : null}
        </button>
      </header>
      {open && (
        <div className="bellp" role="dialog" aria-label="Notifications">
          <div className="row between" style={{ margin: "0 0 6px" }}>
            <div className="fig">NOTIFICATIONS · {notis.length}</div>
            <button className="sm" onClick={() => start(async () => { await markAllRead(); router.refresh(); })}>Mark all read</button>
          </div>
          {notis.length === 0 && <p className="mut">All caught up.</p>}
          {notis.map((n) => (
            <button key={n.id} className={"nitem" + (n.read ? "" : " unread")}
              onClick={() => start(async () => {
                await markRead(String(n.id)); setOpen(false);
                if (n.link) router.push(n.link); else router.refresh();
              })}>
              <span className="nd" /><Icon name={NOTI_ICON[n.kind] ?? "info"} />
              <span style={{ flex: 1 }}><b>{n.title}</b><span>{n.body}</span><time>{ago(n.created_at)}</time></span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
