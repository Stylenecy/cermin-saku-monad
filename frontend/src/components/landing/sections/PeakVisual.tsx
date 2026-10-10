"use client";

import { useEffect, useRef } from "react";
import { animate, createScope, stagger, type Scope } from "animejs";
import { Zap } from "lucide-react";

/* "Skims on every peak" — a MON price line that draws itself, peak markers that
   pop with a stagger, and floating skim chips. Choreographed with anime.js and
   replayed each time the card scrolls into view. */
export function PeakVisual() {
  const root = useRef<HTMLDivElement>(null);
  const scope = useRef<Scope | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const play = () => {
      scope.current?.revert();
      scope.current = createScope({ root: el }).add(() => {
        animate(".peak-line", {
          strokeDashoffset: [1, 0],
          duration: 1500,
          ease: "outExpo",
        });
        animate(".peak-fill", {
          opacity: [0, 1],
          duration: 1000,
          delay: 500,
          ease: "outExpo",
        });
        animate(".peak-dot", {
          scale: [0, 1],
          opacity: [0, 1],
          duration: 520,
          delay: stagger(170, { start: 700 }),
          ease: "outBack",
        });
        animate(".peak-chip", {
          translateY: [10, 0],
          opacity: [0, 1],
          duration: 560,
          delay: stagger(230, { start: 1150 }),
          ease: "outExpo",
        });
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) play();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);

    return () => {
      io.disconnect();
      scope.current?.revert();
      scope.current = null;
    };
  }, []);

  return (
    <div
      ref={root}
      className="peak-anim relative h-full w-full min-h-[140px] rounded-2xl bg-gradient-to-b from-amber-50/80 to-surface border border-amber-100 overflow-hidden"
    >
      <span className="peak-chip absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-surface/90 backdrop-blur border border-amber-200 px-2 py-0.5 text-[10px] font-mono text-amber-700 shadow-sm">
        <Zap className="w-3 h-3" /> +$214.10
      </span>
      <span className="peak-chip absolute top-12 right-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-surface/90 backdrop-blur border border-amber-200 px-2 py-0.5 text-[10px] font-mono text-amber-700 shadow-sm">
        <Zap className="w-3 h-3" /> +$88.40
      </span>
      <svg className="absolute inset-x-0 bottom-0 w-full h-[58%]" viewBox="0 0 300 80" preserveAspectRatio="none">
        <defs>
          <linearGradient id="peakFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#35648F" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#35648F" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          className="peak-fill"
          d="M0 62 L43 54 L86 58 L129 34 L172 46 L215 22 L258 34 L300 12 L300 80 L0 80 Z"
          fill="url(#peakFill)"
        />
        <path
          className="peak-line"
          pathLength={1}
          strokeDasharray={1}
          d="M0 62 L43 54 L86 58 L129 34 L172 46 L215 22 L258 34 L300 12"
          fill="none"
          stroke="#5B84AD"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {["43%", "71.6%", "100%"].map((left, i) => (
        <span
          key={i}
          className="peak-dot absolute w-1.5 h-1.5 rounded-full bg-amber-500 ring-2 ring-surface"
          style={{ left, bottom: ["20%", "32%", "40%"][i], transform: "translate(-50%,50%)" }}
        />
      ))}
    </div>
  );
}
