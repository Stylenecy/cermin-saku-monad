"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useLang } from "@/lib/i18n";
import { useVault } from "@/hooks/useVault";
import { useFeedPrice, useSakuAllowance, useVaultSchedules } from "@/hooks/useSaku";
import { sakuDeployed, bps } from "@/lib/saku";
import { SakuNav, SakuFooter } from "@/components/saku/SakuNav";
import { CreateSchedule } from "@/components/saku/CreateSchedule";
import { ScheduleCards } from "@/components/saku/ScheduleCards";
import { LensPanel } from "@/components/saku/LensPanel";
import { Ledger } from "@/components/saku/Ledger";
import { Rp, RateNote } from "@/components/saku/Money";
import { buttonClasses } from "@/components/ui/Button";

export default function SakuPage() {
  const { t } = useLang();
  const { isConnected } = useAccount();
  const v = useVault();
  const { price } = useFeedPrice();
  const vault = v.vaultAddress;
  const { allowance, policy } = useSakuAllowance(vault);
  const schedules = useVaultSchedules(vault);
  const spendable = v.shadow ? v.shadow[0] : v.state?.spendableMusd;
  const next = schedules.data?.find((x) => !x.cancelled && x.paid < x.periods);

  return (
    <div className="min-h-screen">
      <SakuNav />
      <main className="mx-auto max-w-6xl px-6 pb-10 pt-10">
        <div className="inline-flex items-center gap-2.5 rounded-full border border-cream-300 bg-surface/70 backdrop-blur px-3 py-1.5 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink">{t("Uang saku", "Allowances")}</span>
        </div>
        <h1 className="font-serif text-[2rem] md:text-[2.5rem] font-medium tracking-[-0.02em] text-ink leading-tight">
          {t("Amplop untuk ", "Envelopes for ")}
          <em className="italic font-normal text-amber-600">{t("anakmu", "your child")}</em>
        </h1>
        <p className="text-muted mt-2.5 text-pretty max-w-xl leading-relaxed">
          {t(
            "Atur sekali: nominal, jadwal, dan penerimanya. Kontrak membayarnya dari saldo pakai vault dan menahannya sendiri kalau posisi sedang tidak aman.",
            "Set it once: the amount, the schedule and who receives it. The contract pays it from the vault's spendable balance and holds it on its own when the position is not safe.",
          )}
        </p>

        {!sakuDeployed() ? (
          <p className="mt-8 rounded-3xl border border-dashed border-amber-200 bg-amber-50 p-6 text-sm">
            {t("Kontrak Saku belum dideploy di jaringan ini.", "Saku contracts are not deployed on this network yet.")}
          </p>
        ) : !isConnected ? (
          <div className="mt-8 rounded-3xl border border-cream-300 bg-surface shadow-soft p-6 sm:p-8">
            <p className="max-w-xl leading-relaxed text-muted">
              {t(
                "Masuk sebagai pemilik vault untuk menjadwalkan uang saku. Mau lihat dulu tanpa dompet? Buka vault demo kami.",
                "Sign in as the vault owner to schedule allowances. Want to look first without a wallet? Open our demo vault.",
              )}
            </p>
            <Link href="/demo" className={`${buttonClasses({ variant: "secondary", size: "lg" })} mt-5`}>
              {t("Lihat vault demo on-chain", "See the on-chain demo vault")}
            </Link>
          </div>
        ) : v.isLoading ? (
          <p className="mt-8 text-sm text-muted">{t("Membaca vault…", "Reading vault…")}</p>
        ) : !v.hasVault || !vault ? (
          <div className="mt-8 rounded-3xl border border-cream-300 bg-surface shadow-soft p-6 sm:p-8">
            <p className="max-w-xl leading-relaxed text-muted">
              {t(
                "Dompet ini belum punya vault. Uang saku dibayar dari saldo pakai vault, jadi buka vault dulu dengan menyetor MON.",
                "This wallet has no vault yet. Allowances are paid from the vault's spendable balance, so open a vault by depositing MON first.",
              )}
            </p>
            <Link href="/onboard" className={`${buttonClasses({ variant: "primary", size: "lg" })} mt-5`}>
              {t("Buka vault dengan MON", "Open a vault with MON")}
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-cream-300 bg-surface shadow-sm px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{t("Saldo pakai", "Spendable")}</p>
                <p className="mt-1 text-lg font-bold text-ink">
                  <Rp wei={spendable} showUsd={false} />
                </p>
              </div>
              <div className="rounded-2xl border border-cream-300 bg-surface shadow-sm px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{t("Izin Saku tersisa", "Saku allowance left")}</p>
                <p className="mt-1 text-lg font-bold text-ink">
                  <Rp wei={allowance} showUsd={false} />
                </p>
              </div>
              <div className="rounded-2xl border border-cream-300 bg-surface shadow-sm px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{t("Aturan aman", "Safety rule")}</p>
                <p className="mt-1 text-sm text-ink">
                  {policy && v.params
                    ? t(
                        `Bayar hanya bila ICR ≥ ${bps(v.params.defendICR + policy.floorBufferBps)}% dan cadangan tahan MON turun ${bps(policy.stressBps)}% lagi`,
                        `Pay only if ICR ≥ ${bps(v.params.defendICR + policy.floorBufferBps)}% and the reserve survives another ${bps(policy.stressBps)}% drop`,
                      )
                    : "…"}
                </p>
              </div>
            </div>

            <div className="mt-8">
              <CreateSchedule vault={vault} spendable={spendable} allowance={allowance} />
            </div>

            <h2 className="mt-12 font-serif text-2xl md:text-[1.75rem] font-medium tracking-[-0.02em] text-ink">
              {t("Amplop ", "Your ")}
              <em className="italic font-normal text-amber-600">{t("yang berjalan", "envelopes")}</em>
            </h2>
            <div className="mt-4">
              <ScheduleCards
                schedules={schedules.data}
                vault={vault}
                livePrice={price}
                ownerView
                isLoading={schedules.isLoading}
                isError={schedules.isError}
              />
            </div>
            <div className="mt-10">
              <LensPanel vault={vault} livePrice={price} sakuAmount={next?.amount ?? schedules.data?.[0]?.amount ?? 0n} sakuPending={!!next} />
            </div>
            <div className="mt-10">
              <Ledger vault={vault} />
            </div>
          </>
        )}
        <RateNote className="mt-6" />
      </main>
      <SakuFooter />
    </div>
  );
}
