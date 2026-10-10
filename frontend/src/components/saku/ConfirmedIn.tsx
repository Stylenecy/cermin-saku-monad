"use client";

import { Zap } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { formatNum } from "@/lib/idr";

/** "Recorded on Monad 0.9 s after sending" — the measured time, never a claimed one. */
export function ConfirmedIn({ ms, className = "" }: { ms: number | undefined; className?: string }) {
  const { t, lang } = useLang();
  if (ms === undefined) return null;
  const sec = formatNum(ms / 1000, lang, 1);
  return (
    <p className={`inline-flex items-center gap-1.5 rounded-full bg-daun/10 px-3 py-1 text-xs font-medium text-daun ${className}`}>
      <Zap className="h-3.5 w-3.5" aria-hidden />
      {t(`Tercatat di blok Monad ${sec} dtk setelah dikirim`, `Recorded in a Monad block ${sec} s after sending`)}
    </p>
  );
}
