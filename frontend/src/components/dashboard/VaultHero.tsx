"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { ICRGauge } from "@/components/dashboard/ICRGauge";
import { formatUsd, truncateAddress, icrLabel, icrToColor } from "@/lib/utils";
import { formatIdr, formatNum, useUsdIdr } from "@/lib/idr";
import { useLang } from "@/lib/i18n";
import { EXPLORER_URL } from "@/lib/chains";
import { ExternalLink, ShieldCheck, ShieldAlert } from "lucide-react";

const MEZO_LIQUIDATION_ICR = 1.1;

interface VaultHeroProps {
  vaultAddress: `0x${string}`;
  collateral: bigint;
  debt: bigint;
  spendable: bigint;
  icr: bigint;
  btcPriceUsd: number;
  defendICR: number;
  onDefend?: () => void;
  isDefendLoading?: boolean;
}

export function VaultHero({
  vaultAddress,
  collateral,
  debt,
  spendable,
  icr,
  btcPriceUsd,
  defendICR,
  onDefend,
  isDefendLoading,
}: VaultHeroProps) {
  const { t, lang } = useLang();
  const { rate } = useUsdIdr();
  const btcAmount = Number(collateral) / 1e18;
  const collUsd = btcAmount * btcPriceUsd;
  const debtMusd = Number(debt) / 1e18;
  const spendableUsd = Number(spendable) / 1e18;
  const netEquity = collUsd - debtMusd;

  const icrBps = Number(icr);
  const liqPrice = btcAmount > 0 ? (MEZO_LIQUIDATION_ICR * debtMusd) / btcAmount : 0;
  const dropBuffer =
    btcPriceUsd > 0 && liqPrice > 0 ? Math.max(0, ((btcPriceUsd - liqPrice) / btcPriceUsd) * 100) : 0;
  const healthColor = icrToColor(icrBps);
  const healthLabel = icrLabel(icrBps, lang);
  const needsDefense = icrBps > 0 && icrBps < defendICR;

  return (
    <Card variant="ink" className="relative overflow-hidden !p-6 md:!p-8">
      {/* landing scene for depth — faded, with a gradient so copy stays legible */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.38]"
          style={{ backgroundImage: "url(/saku-shadow-night-warmth.webp)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-shadow-900 via-shadow-900/88 to-shadow-900/55" />
      </div>
      <svg
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-12 w-72 h-72 text-amber-300/10"
        viewBox="0 0 200 200"
        fill="none"
      >
        {[44, 70, 96, 122].map((r) => (
          <circle key={r} cx="150" cy="50" r={r} stroke="currentColor" strokeWidth="1" />
        ))}
      </svg>
      <div className="absolute -top-16 -right-4 w-60 h-60 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />

      <div className="relative grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-8 items-center [&>*]:min-w-0">
        {/* left — the Shadow (what you live on), cast from MON held whole */}
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-5">
            <span className="text-[10px] uppercase tracking-[0.2em] text-amber-300/80 font-mono">Vault</span>
            <a
              href={`${EXPLORER_URL}/address/${vaultAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-white/55 hover:text-white transition-colors"
            >
              {truncateAddress(vaultAddress)}
              <ExternalLink className="w-3 h-3" />
            </a>
            <span className="w-px h-3 bg-white/15" />
            <span className="inline-flex items-center gap-1.5 text-xs font-mono tabular-nums text-white/55">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> MON {formatIdr(btcPriceUsd * rate)}
              <span className="text-[0.85em]">
                ({formatUsd(btcPriceUsd, 0)}) · {t("harga simulasi", "simulated price")}
              </span>
            </span>
          </div>

          <p className="text-[11px] uppercase tracking-[0.18em] text-amber-300/80 font-mono mb-2">
            {t("Saldo pakai · sumber uang saku", "Spendable · where allowances come from")}
          </p>
          <AnimatedNumber
            key={rate}
            value={spendableUsd}
            format={(n) => formatIdr(n * rate)}
            className="block text-[2.9rem] md:text-[3.4rem] font-semibold tabular-nums tracking-tight text-cream-50 leading-none"
          />
          <p className="text-sm text-white/55 mt-3">
            {t("Saldo pakai sekarang", "Spendable now")}{" "}
            <span className="tabular-nums">
              (≈ {formatNum(spendableUsd, lang, 2)} MUSD)
            </span>{" "}
            ·{" "}
            {t("dipinjam dari", "borrowed against")}{" "}
            <span className="text-cream-100 tabular-nums">{formatNum(btcAmount, lang, 4)} MON</span>{" "}
            {t("yang tetap utuh", "held whole")}
          </p>
          <p className="text-xs text-white/40 mt-1.5 tabular-nums">
            {t("Posisi bersih", "Net position")} {formatIdr(netEquity * rate)} ({formatUsd(netEquity)}) ·{" "}
            {t("utang", "borrowed")} {formatIdr(debtMusd * rate)} ({formatUsd(debtMusd)})
          </p>
        </div>

        {/* right — health */}
        <div className="flex flex-wrap items-center gap-5 lg:flex-nowrap lg:justify-end">
          <ICRGauge icr={icr} dark />
          <div className="min-w-0 flex-1 basis-44">
            <div className="flex items-center gap-2 mb-3">
              <span className="relative flex items-center justify-center">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: healthColor }} />
                <span
                  className="absolute inset-0 rounded-full animate-ping opacity-60"
                  style={{ backgroundColor: healthColor }}
                />
              </span>
              <span className="text-sm font-medium" style={{ color: healthColor }}>
                {healthLabel}
              </span>
            </div>
            <div className="space-y-2 mb-4">
              <Stat
                label={t("Likuidasi", "Liquidation")}
                value={liqPrice > 0 ? formatIdr(liqPrice * rate) : "—"}
                sub={liqPrice > 0 ? formatUsd(liqPrice, 0) : undefined}
              />
              <Stat label={t("Ruang turun MON", "MON drop buffer")} value={`${dropBuffer.toFixed(0)}%`} accent="text-success" />
            </div>
            {onDefend && (
              needsDefense ? (
                <Button variant="secondary" size="sm" onClick={onDefend} loading={isDefendLoading} disabled={isDefendLoading} className="w-full">
                  <ShieldAlert className="w-4 h-4" />
                  {t("Bela sekarang", "Defend now")}
                </Button>
              ) : (
                <button
                  onClick={onDefend}
                  disabled={isDefendLoading}
                  className="w-full inline-flex items-center justify-center gap-2 h-9 rounded-full border border-white/15 text-cream-100 text-sm hover:bg-white/[0.06] transition-colors disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {t("Bela", "Defend")}
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
      <span className="text-[11px] uppercase tracking-[0.12em] text-white/45 font-mono">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${accent ?? "text-cream-50"}`}>
        {value}
        {sub && <span className="ml-1 text-[0.8em] font-normal text-white/45">≈ {sub}</span>}
      </span>
    </div>
  );
}
