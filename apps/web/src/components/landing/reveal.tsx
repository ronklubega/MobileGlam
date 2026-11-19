"use client";
import { useEffect, useRef, type ReactNode } from "react";

/** Fades/slides its children in once when scrolled into view. Content stays visible without JS (see <noscript> in the page). */
export function Reveal({ children, delay = 0, className = "", as: Tag = "div" }: { children: ReactNode; delay?: number; className?: string; as?: "div" | "li" | "section" }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return void el.classList.add("is-in");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }),
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const Component = Tag as "div";
  return (
    <Component ref={ref as React.RefObject<HTMLDivElement>} data-reveal className={className} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Component>
  );
}
