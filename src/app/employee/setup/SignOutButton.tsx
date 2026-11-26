import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

/** Sign-out button for the first-login setup shell (no sidebar there). */
export function SignOutButton() {
  async function signOut() {
    "use server";
    const sb = await supabaseServer();
    await sb.auth.signOut();
    redirect("/signin");
  }

  return (
    <form action={signOut}>
      <button type="submit" className="btn">Sign out</button>
    </form>
  );
}
