"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

export const ADMIN_NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/admin/employees", label: "Employees", icon: "users" },
  { href: "/admin/documents", label: "Documents", icon: "grid" },
  { href: "/admin/attendance", label: "Attendance", icon: "cal" },
  { href: "/admin/leave", label: "Leave", icon: "plane" },
  { href: "/admin/payroll", label: "Payroll", icon: "wallet" },
  { href: "/admin/announcements", label: "Announcements", icon: "mega" },
  { href: "/admin/reports", label: "Reports", icon: "chart" },
  { href: "/admin/scan", label: "Scan QR", icon: "qr" },
  { href: "/admin/qr", label: "QR Badges", icon: "qr" },
];

export function SideNav() {
  const path = usePathname();
  return (
    <nav className="navgrp" aria-label="Main navigation">
      <div className="fig">MANAGEMENT</div>
      {ADMIN_NAV.map((n) => {
        const on = path === n.href || path.startsWith(n.href + "/");
        return (
          <Link
            key={n.href}
            href={n.href}
            className={"ni" + (on ? " on" : "")}
            aria-current={on ? "page" : undefined}
            onClick={() => document.body.classList.remove("menu-open")}
          >
            <Icon name={n.icon} />
            <span>{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function TopBar() {
  const path = usePathname();
  const page = ADMIN_NAV.find((n) => path === n.href || path.startsWith(n.href + "/"))?.label ?? "";

  function toggleTheme() {
    const root = document.documentElement;
    const cur = root.getAttribute("data-theme");
    const dark = cur ? cur === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("hive.theme", next);
    } catch {}
  }

  return (
    <header className="bar">
      <button
        className="ib burger"
        aria-label="Toggle menu"
        onClick={() => document.body.classList.toggle("menu-open")}
      >
        <Icon name="menu" />
      </button>
      <div className="crumb">
        Hive HRIS · <b>{page}</b>
      </div>
      <div className="sp" />
      <button className="ib" aria-label="Toggle colour theme" onClick={toggleTheme}>
        <Icon name="moon" />
      </button>
    </header>
  );
}