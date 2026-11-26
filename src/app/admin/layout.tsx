import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { signOut } from "@/app/signin/actions";
import { SideNav, TopBar } from "@/components/admin-chrome";
import { Icon } from "@/components/Icon";

const ini = (n: string) =>
  n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/signin");

  const { data: me } = await sb
    .from("profiles")
    .select("full_name, position, role")
    .eq("id", user.id)
    .single();
  if (!me) redirect("/signin");
  if (me.role !== "admin") redirect("/employee/home");

  return (
    <div className="shell">
      <aside className="side" aria-label="Sidebar">
        <div className="brand">
          <i />
          <span>
            Hive HRIS<small>HR admin</small>
          </span>
        </div>
        <SideNav />
        <div className="sidefoot">
          <div className="who">
            <span className="av">{ini(me.full_name)}</span>
            <span>
              <b>{me.full_name}</b>
              <span>{me.position ?? "Administrator"}</span>
            </span>
          </div>
          <form action={signOut}>
            <button className="ni" type="submit">
              <Icon name="out" />
              <span>Sign out</span>
            </button>
          </form>
        </div>
      </aside>
      <div className="main">
        <TopBar />
        <main id="app">{children}</main>
      </div>
    </div>
  );
}