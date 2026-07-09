"use client";

import { useEffect, useRef } from "react";

/*
 * Scroll reveal. Content is visible by default (SSR, no-JS, print all get
 * the full page); the hidden starting state is only applied client-side,
 * and only to elements still below the fold at mount — so nothing can ever
 * be stranded invisible. The travel/fade lives in globals.css (.reveal) so
 * reduced-motion can strip the transform there.
 */
export default function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li" | "span";
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Already on screen: leave it visible, no animation to run.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.95) return;

    el.classList.add("reveal");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-in");
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={className}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
