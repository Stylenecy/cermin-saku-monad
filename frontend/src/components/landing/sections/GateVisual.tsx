"use client";

import { useEffect, useRef } from "react";
import { animate, createScope, stagger, type Scope } from "animejs";
import { Check } from "lucide-react";
import { useLang } from "@/lib/i18n";

/* "Holds itself when it's unsafe" — Kiel's PeakVisual choreography (anime.js,
   replayed each time the card scrolls into view) on a MON line that dips under
   the safety line: paid on the way up, DITAHAN in the dip, paid again after. */
export function GateVisual() {
  const { t } = useLang();
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
      className="peak-anim relative h-full w-full min-h-[160px] rounded-2xl bg-gradient-to-b from-amber-50/80 to-surface border border-amber-100 overflow-hidden"
    >
      <span className="peak-chip absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-surface/90 backdrop-blur border border-leaf-300 px-2 py-0.5 text-[10px] font-mono text-leaf-700 shadow-sm">
        <Check className="w-3 h-3" /> {t("dibayar", "paid")}
      </span>
      <span className="peak-chip absolute top-[44%] left-1/2 -translate-x-1/2 z-10">
        <span className="stamp bg-surface/90 text-danger text-[10px]">{t("Ditahan", "Held")}</span>
      </span>
      <span className="peak-chip absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-surface/90 backdrop-blur border border-leaf-300 px-2 py-0.5 text-[10px] font-mono text-leaf-700 shadow-sm">
        <Check className="w-3 h-3" /> {t("dibayar lagi", "paid again")}
      </span>
      <svg className="absolute inset-x-0 bottom-0 w-full h-[70%]" viewBox="0 0 300 80" preserveAspectRatio="none">
        <defs>
          <linearGradient id="gateFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#35648F" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#35648F" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" x2="300" y1="44" y2="44" stroke="#A84A3A" strokeOpacity="0.55" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        <path className="peak-fill" d="M0 30 L40 24 L80 32 L120 50 L150 62 L180 52 L220 34 L260 26 L300 18 L300 80 L0 80 Z" fill="url(#gateFill)" />
        <path
          className="peak-line"
          pathLength={1}
          strokeDasharray={1}
          d="M0 30 L40 24 L80 32 L120 50 L150 62 L180 52 L220 34 L260 26 L300 18"
          fill="none"
          stroke="#35648F"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="absolute right-3 bottom-[47%] text-[9px] font-mono text-danger/80">{t("garis aman", "safety line")}</span>
      {[
        { left: "13.3%", bottom: "70%", c: "bg-leaf-500" },
        { left: "50%", bottom: "22%", c: "bg-danger" },
        { left: "86.7%", bottom: "68%", c: "bg-leaf-500" },
      ].map((d, i) => (
        <span
          key={i}
          className={`peak-dot absolute w-2 h-2 rounded-full ring-2 ring-surface ${d.c}`}
          style={{ left: d.left, bottom: d.bottom, transform: "translate(-50%,50%)" }}
        />
      ))}
    </div>
  );
}
