import "server-only";
import { createClient } from "@supabase/supabase-js";
/** Bypasses RLS. Use only inside server actions that have already verified the caller is an admin. */
export const supabaseAdmin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
