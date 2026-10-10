"use client";

import { formatIdr, formatAsOf, formatNum, musdToIdr, useUsdIdr } from "@/lib/idr";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** MUSD amount shown as Rupiah first, dollars second. */
export function Rp({
  wei,
  className,
  showUsd = true,
  sign = "",
}: {
  wei: bigint | undefined;
  className?: string;
  showUsd?: boolean;
  sign?: "" | "+" | "−";
}) {
  const { rate } = useUsdIdr();
  const { lang } = useLang();
  if (wei === undefined) return <span className={cn("text-muted", className)}>—</span>;
  const usd = Number(wei) / 1e18;
  return (
    <span className={cn("tabular", className)}>
      {sign}
      {formatIdr(musdToIdr(wei, rate))}
      {showUsd && (
        <span className="ml-1.5 text-[0.8em] font-normal text-muted">
          ≈ {formatNum(usd, lang, Number.isInteger(usd) ? 0 : 2)} MUSD
        </span>
      )}
    </span>
  );
}

/** MON/USD (1e18) price as Rupiah per MON. */
export function RpPrice({ price, className }: { price: bigint | undefined; className?: string }) {
  const { rate } = useUsdIdr();
  if (!price) return <span className={cn("text-muted", className)}>—</span>;
  return <span className={cn("tabular", className)}>{formatIdr(musdToIdr(price, rate))}</span>;
}

/** The honest footnote under any Rupiah figure. */
export function RateNote({ className }: { className?: string }) {
  const { rate, asOf, source, live } = useUsdIdr();
  const { t, lang } = useLang();
  return (
    <p className={cn("text-xs text-muted", className)}>
      {t("Kurs indikatif", "Indicative rate")} 1 USD = {formatIdr(rate)} · {source} · {formatAsOf(asOf, lang)}
      {!live && ` · ${t("cadangan, kurs live tidak terjangkau", "fallback, live rate unreachable")}`}.{" "}
      {t(
        "Kontrak hanya mengenal MUSD (dolar); Rupiah hanya tampilan.",
        "Contracts only know MUSD (dollars); Rupiah is display only.",
      )}
    </p>
  );
}
