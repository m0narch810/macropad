"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/*
 * Phone nav for the marketing pages. The inline link row is hidden below md,
 * which used to leave phones with no path to Coverage or Pricing at all -
 * this hamburger restores it and closes itself on tap-through.
 */
export default function MobileMenu({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const links: [string, string][] = [
    ["/#system", "System"],
    ["/coverage", "Coverage"],
    ["/pricing", "Pricing"],
    ...(signedIn ? [] : ([["/signin", "Sign in"]] as [string, string][])),
  ];

  return (
    <div ref={ref} className="relative md:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center border border-[var(--border)] text-[var(--text-dim)]"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          {open ? (
            <>
              <path d="M3 3L13 13" />
              <path d="M13 3L3 13" />
            </>
          ) : (
            <>
              <path d="M2 4.5H14" />
              <path d="M2 8H14" />
              <path d="M2 11.5H14" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-44 border border-[var(--border-strong)] bg-[var(--panel-2)] py-1.5">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 font-sans text-[0.86rem] text-[var(--text-dim)] transition-colors duration-150 hover:bg-[var(--panel-3)] hover:text-[var(--text)]"
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
