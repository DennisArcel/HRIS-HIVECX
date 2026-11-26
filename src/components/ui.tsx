"use client";
import type { ReactNode } from "react";

export function Modal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="mb" onClick={onClose}>
      <div className="mc" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function ExportButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <button className="sm" type="button" onClick={() => (window.location.href = href)}>
      {children}
    </button>
  );
}