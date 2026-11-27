/** Finds the profile photo URL on a `profiles` row, whatever the column is called. */
const KEYS = ["avatar_url", "photo_url", "profile_photo", "profile_picture", "picture", "photo", "avatar", "image_url"];

export function pickAvatar(row: Record<string, unknown> | null | undefined): string | null {
  if (!row) return null;
  for (const k of KEYS) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}
