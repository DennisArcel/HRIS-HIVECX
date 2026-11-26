"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markAllRead } from "@/app/employee/actions";

export function MarkAllReadButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button className="sm" disabled={pending} onClick={() => start(async () => { await markAllRead(); router.refresh(); })}>
      Mark all read
    </button>
  );
}
