import { redirect } from "next/navigation";
import { getPortal } from "@/lib/employee-data";
import { SignOutButton } from "./SignOutButton";

/** First-login shell: no sidebar, nothing else reachable. Already-finished employees go straight home. */
export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  const p = await getPortal();
  if (p.me.profile_complete) redirect("/employee/home");
  return (
    <>
      <header className="setuphd">
        <div className="brand" style={{ padding: 0 }}><i></i><span>Hive HRIS<small>Account setup</small></span></div>
        <div className="row" style={{ margin: 0 }}><SignOutButton /></div>
      </header>
      <main id="app" className="setupmain">{children}</main>
    </>
  );
}
