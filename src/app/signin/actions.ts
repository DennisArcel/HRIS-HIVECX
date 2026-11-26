"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const schema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or username."),
  password: z.string().min(1, "Enter your password."),
});

const BAD_LOGIN =
  "Incorrect username or password. If HR created your account, use the temporary password they gave you.";

/** Sign in by username, email or employee ID (HV-001). Supabase Auth itself only knows emails, so resolve first. */
export async function signIn(_: unknown, fd: FormData): Promise<{ error?: string }> {
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { identifier, password } = parsed.data;

  // Strip characters that would break the PostgREST filter string.
  const id = identifier.replace(/[,()]/g, "");

  let target: string;

  try {
    const { data: rows, error: lookupError } = await supabaseAdmin()
      .from("profiles")
      .select("email, role, profile_complete")
      .or(
        `username.eq.${id.toLowerCase()},email.eq.${id.toLowerCase()},employee_code.eq.${id.toUpperCase()}`
      )
      .limit(1);

    if (lookupError) {
      console.error("[signIn] profile lookup failed:", lookupError);
      return { error: "Sign-in is temporarily unavailable. Please contact HR." };
    }

    const row = rows?.[0];
    if (!row) return { error: BAD_LOGIN }; // same message as a wrong password so accounts can't be discovered

    const sb = await supabaseServer();
    const { error } = await sb.auth.signInWithPassword({ email: row.email, password });
    if (error) {
      console.error("[signIn] auth error:", error.message);
      return { error: BAD_LOGIN };
    }

    target =
      row.role === "admin"
        ? "/admin/dashboard"
        : row.profile_complete
          ? "/employee/home"
          : "/employee/setup";
  } catch (e) {
    console.error("[signIn] unexpected error:", e);
    return { error: "Sign-in is temporarily unavailable. Please contact HR." };
  }

  // Outside the try/catch because redirect() works by throwing.
  redirect(target);
}

export async function signOut() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/signin");
}