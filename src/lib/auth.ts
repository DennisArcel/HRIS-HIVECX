import { supabaseServer } from "@/lib/supabase/server";

/** Use at the top of every admin server action. Throws unless the caller is a signed-in admin. */
export async function requireAdmin() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: me } = await sb.from("profiles").select("full_name, role").eq("id", user.id).single();
  if (!me || me.role !== "admin") throw new Error("Admins only");
  return { id: user.id, name: me.full_name as string };
}