"use client";
import { useRef, useState } from "react";

const initials = (n: string) => n.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

/**
 * Profile photo with an initials fallback.
 * Signed URLs change on every server refresh, so the first URL is kept for as long as it is the same file
 * (no flicker on the 8-second refresh); if it stops loading, the newest URL is tried before falling back to initials.
 */
export function Avatar({ name, src, size, text }: { name: string; src?: string | null; size?: "sm" | "lg"; text?: string }) {
  const key = src ? src.split("?")[0] : "";
  const held = useRef<{ key: string; src?: string | null }>({ key, src });
  if (held.current.key !== key) held.current = { key, src };
  const [fresh, setFresh] = useState(false);
  const [bad, setBad] = useState(false);
  const url = fresh ? src : held.current.src;

  return (
    <span className={"cav" + (size ? " " + size : "")}>
      {url && !bad ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          onError={() => {
            if (!fresh && src && src !== held.current.src) setFresh(true);
            else setBad(true);
          }}
        />
      ) : (
        text ?? initials(name)
      )}
    </span>
  );
}