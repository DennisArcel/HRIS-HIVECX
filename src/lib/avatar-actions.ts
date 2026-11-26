"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { BUCKET, IMG_EXT, MAX_BYTES, extOf } from "./doc-types";

type Res = { ok: true } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Sets the profile picture. Employees can change their own; admins can change anyone's. */
export async function uploadAvatar(fd: FormData): Promise<Res> {
  try {
    const sb = await supabaseServer();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return fail("Not signed in");
    const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).single();
    const admin = me?.role === "admin";

    const employeeId = String(fd.get("employeeId") ?? "");
    const file = fd.get("file") as File | null;
    if (!/^[0-9a-f-]{36}$/i.test(employeeId)) return fail("Bad employee");
    if (!admin && employeeId !== user.id) return fail("Not allowed");
    if (!file || typeof file !== "object" || !("arrayBuffer" in file) || file.size === 0) return fail("Choose a photo");
    if (file.size > MAX_BYTES) return fail("That photo is over 5 MB");
    const ext = extOf(file.name);
    if (!IMG_EXT.includes(ext)) return fail("Use a JPG or PNG photo");

    const { data: cur } = await sb.from("profiles").select("avatar_path").eq("id", employeeId).single();
    const path = `${employeeId}/avatar-${randomUUID()}.${ext}`;

    const { error: upErr } = await sb.storage
      .from(BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: ext === "png" ? "image/png" : "image/jpeg" });
    if (upErr) return fail(upErr.message);

    const { data: updated, error: dbErr } = await sb.from("profiles").update({ avatar_path: path }).eq("id", employeeId).select("id");
    if (dbErr || !updated || updated.length === 0) {
      await sb.storage.from(BUCKET).remove([path]);
      return fail(dbErr?.message ?? "Couldn't save the photo to the profile");
    }

    if (cur?.avatar_path) await sb.storage.from(BUCKET).remove([cur.avatar_path]); // best effort
    revalidatePath("/admin/documents");
    revalidatePath(`/admin/documents/${employeeId}`);
    revalidatePath("/employee/documents");
    revalidatePath("/employee/profile");
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Upload failed");
  }
}

/** Removes the profile picture. Employees can remove their own; admins can remove anyone's. */
export async function removeAvatar(employeeId: string): Promise<Res> {
  try {
    const sb = await supabaseServer();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return fail("Not signed in");
    const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).single();
    const admin = me?.role === "admin";

    if (!/^[0-9a-f-]{36}$/i.test(employeeId)) return fail("Bad employee");
    if (!admin && employeeId !== user.id) return fail("Not allowed");

    const { data: cur } = await sb.from("profiles").select("avatar_path").eq("id", employeeId).single();
    if (!cur?.avatar_path) return { ok: true };

    const { data: updated, error } = await sb.from("profiles").update({ avatar_path: null }).eq("id", employeeId).select("id");
    if (error || !updated || updated.length === 0) return fail(error?.message ?? "Couldn't remove the photo");

    await sb.storage.from(BUCKET).remove([cur.avatar_path]); // best effort; the picture is already unlinked
    revalidatePath("/admin/documents");
    revalidatePath(`/admin/documents/${employeeId}`);
    revalidatePath("/employee/documents");
    revalidatePath("/employee/profile");
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn't remove the photo");
  }
}