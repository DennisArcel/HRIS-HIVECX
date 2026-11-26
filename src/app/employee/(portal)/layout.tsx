import { redirect } from "next/navigation";
import { getPortal, loadNotifications } from "@/lib/employee-data";
import { SideNav, TopBar } from "@/components/employee-chrome";

/** Portal shell. Until first-login setup is finished, every portal page sends the employee to /employee/setup. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const p = await getPortal();
  if (!p.me.profile_complete) redirect("/employee/setup");
  const notis = await loadNotifications(p);
  return (
    <div className="shell">
      <aside className="side" aria-label="Sidebar">
        <div className="brand"><i></i><span>Hive HRIS<small>Employee portal</small></span></div>
        <SideNav name={p.me.full_name} role={p.me.position ?? "Employee"} />
      </aside>
      <div className="main">
        <TopBar notis={notis} />
        <main id="app">{children}</main>
      </div>
    </div>
  );
}
