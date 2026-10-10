"use client";

import { useState } from "react";
import { Calculator as CalcIcon } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { Card } from "@/components/ui/Card";
import { useLang } from "@/lib/i18n";
import { formatIdr, formatNum, useUsdIdr } from "@/lib/idr";
import { PRESETS } from "@/lib/presets";
import { useFeedPrice } from "@/hooks/useSaku";
import { Eyebrow } from "./Eyebrow";
import { cn } from "@/lib/utils";

const AMOUNTS = [250_000, 500_000, 1_000_000, 2_000_000];
const MONTHS = [3, 6, 12, 24];
const FALLBACK_MON_USD = 0.0244; // only if the price feed cannot be read

/**
 * "How much MON do I need?" — the vault's own Balanced rule: it borrows
 * targetLTV of the collateral value and keeps spendableShare of that as the
 * spendable balance the allowance is paid from (the rest is the defense
 * reserve). So MON needed = total allowance / (LTV × share) / price.
 */
export function Calculator() {
  const { t, lang } = useLang();
  const { rate } = useUsdIdr();
  const { price } = useFeedPrice();
  const [amount, setAmount] = useState(500_000);
  const [months, setMonths] = useState(12);

  const p = PRESETS.balanced;
  const share = (p.targetLTV / 10_000) * (p.spendableShare / 10_000);
  const bnbUsd = price ? Number(price) / 1e18 : FALLBACK_MON_USD;
  const totalIdr = amount * months;
  const totalUsd = totalIdr / rate;
  const collateralUsd = totalUsd / share;
  const bnb = collateralUsd / bnbUsd;
  const reserveIdr = collateralUsd * (p.targetLTV / 10_000) * (1 - p.spendableShare / 10_000) * rate;

  const Pill = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "h-10 rounded-full px-4 text-sm font-medium transition-colors border",
        on ? "bg-ink text-cream-50 border-ink" : "bg-surface text-ink border-cream-300 hover:border-amber-200",
      )}
    >
      {children}
    </button>
  );

  return (
    <section id="hitung" className="relative py-20 md:py-28 scroll-mt-16">
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="max-w-2xl mb-12">
          <Eyebrow icon={<CalcIcon className="w-3.5 h-3.5" />} label={t("Hitung", "Calculator")} note={t("profil Seimbang", "Balanced profile")} />
          <h2 className="font-serif text-3xl md:text-[2.75rem] font-medium tracking-[-0.02em] leading-[1.08] text-balance mt-5">
            {t("Mau kirim berapa ", "How much do you want to send ")}
            <em className="italic font-normal text-amber-600">{t("tiap bulan?", "each month?")}</em>
          </h2>
        </Reveal>

        <Reveal>
          <Card className="!p-6 md:!p-10">
            <div className="grid gap-10 md:grid-cols-[1.1fr_1fr] md:items-center">
              <div className="space-y-8">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] font-mono text-muted mb-3">{t("Uang saku per bulan", "Allowance per month")}</div>
                  <div className="flex flex-wrap gap-2">
                    {AMOUNTS.map((a) => (
                      <Pill key={a} on={amount === a} onClick={() => setAmount(a)}>
                        {formatIdr(a)}
                      </Pill>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] font-mono text-muted mb-3">{t("Selama", "For")}</div>
                  <div className="flex flex-wrap gap-2">
                    {MONTHS.map((m) => (
                      <Pill key={m} on={months === m} onClick={() => setMonths(m)}>
                        {m} {t("bulan", m === 1 ? "month" : "months")}
                      </Pill>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl bg-shadow-900 text-cream-50 p-7 md:p-8 relative overflow-hidden">
                <div aria-hidden className="absolute -top-16 -right-10 w-48 h-48 rounded-full bg-amber-500/40 blur-3xl" />
                <div className="relative">
                  <div className="text-xs uppercase tracking-[0.18em] font-mono text-amber-200">{t("Setor sebagai jaminan", "Deposit as collateral")}</div>
                  <div className="font-serif text-5xl md:text-6xl font-medium tracking-[-0.02em] mt-2 tabular-nums">
                    ≈ {formatNum(bnb, lang, 2)} <span className="italic font-normal text-amber-200">MON</span>
                  </div>
                  <p className="text-sm text-cream-200/80 mt-3 leading-relaxed text-pretty">
                    {t(
                      `untuk ${formatIdr(amount)} tiap bulan selama ${months} bulan. MON-nya tetap milikmu dan bisa diambil lagi saat vault ditutup.`,
                      `for ${formatIdr(amount)} a month for ${months} months. The MON stays yours and comes back when you close the vault.`,
                    )}
                  </p>
                  <dl className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-cream-200/60 text-xs">{t("Total uang saku", "Total allowance")}</dt>
                      <dd className="font-medium tabular-nums mt-0.5">{formatIdr(totalIdr)}</dd>
                    </div>
                    <div>
                      <dt className="text-cream-200/60 text-xs">{t("Cadangan pembela", "Defense reserve")}</dt>
                      <dd className="font-medium tabular-nums mt-0.5">{formatIdr(reserveIdr)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
            <p className="mt-6 text-xs text-muted-2">
              {t(
                `Harga acuan 1 MON = ${formatIdr(bnbUsd * rate)} (feed testnet). Kalau MON naik, vault bisa menambah saldo pakai; kalau turun jauh, uang saku ditahan dulu. Belum termasuk bunga pinjaman di jaringan utama.`,
                `Reference price 1 MON = ${formatIdr(bnbUsd * rate)} (testnet feed). If MON rises the vault can top up the spendable balance; if it falls far, the allowance is held first. Mainnet borrowing interest is not included.`,
              )}
            </p>
          </Card>
        </Reveal>
      </div>
    </section>
  );
}
