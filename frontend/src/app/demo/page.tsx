"use client";

export const dynamic = "force-dynamic";

import { zeroAddress } from "viem";
import { motion } from "framer-motion";
import { Check, ChevronDown, Minus } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { SAKU, sakuDeployed } from "@/lib/saku";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { useFeedPrice, useLensSnapshot, useVaultSchedules } from "@/hooks/useSaku";
import { SakuNav, SakuFooter } from "@/components/saku/SakuNav";
import { LensPanel } from "@/components/saku/LensPanel";
import { Ledger } from "@/components/saku/Ledger";
import { OnTimeCard } from "@/components/saku/OnTimeCard";
import { ScheduleCards } from "@/components/saku/ScheduleCards";
import { ContractList } from "@/components/saku/ContractList";
import { RateNote } from "@/components/saku/Money";
import { VaultHero } from "@/components/dashboard/VaultHero";
import { LineShadowText } from "@/components/ui/LineShadowText";

/** The app, read-only, on our public demo vault: no wallet needed. */
export default function DemoPage() {
  const { t } = useLang();
  const vault = SAKU.DEMO_VAULT !== zeroAddress ? SAKU.DEMO_VAULT : undefined;
  const { price } = useFeedPrice();
  const snap = useLensSnapshot(vault, price);
  const schedules = useVaultSchedules(vault);
  const s = snap.data;
  const next = schedules.data?.find((x) => !x.cancelled && x.paid < x.periods);
  const priceUsd = price ? Number(price) / 1e18 : 0;
  const safe = s ? Number(s.icrBps) >= s.sakuFloorICR : true;

  return (
    <div className="min-h-screen">
      <SakuNav demo />
      <div className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[440px] overflow-hidden">
          <div className="absolute -top-28 left-1/2 -translate-x-1/2 w-[52rem] h-[30rem] rounded-full bg-amber-200/25 blur-[120px]" />
        </div>
        <motion.main
          variants={staggerContainer(0.08, 0.05)}
          initial="hidden"
          animate="show"
          className="relative mx-auto max-w-6xl px-6 py-10"
        >
          <motion.div variants={fadeUp} className="mb-7">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-cream-300 bg-surface/70 backdrop-blur px-3 py-1.5 mb-3">
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${safe ? "bg-success" : "bg-warning"}`} />
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink">
                {t("Vault demo · Monad testnet", "Demo vault · Monad testnet")}
              </span>
            </div>
            <h1 className="font-serif text-[2rem] md:text-[2.5rem] font-medium tracking-[-0.02em] text-ink leading-tight">
              {t("Lihat ", "See ")}
              <LineShadowText as="span" shadowColor="#35648F" className="italic font-normal text-ink">
                {t("Cermin Saku", "Cermin Saku")}
              </LineShadowText>{" "}
              {t("bekerja", "at work")}
            </h1>
            <p className="text-muted mt-2.5 text-pretty max-w-xl leading-relaxed">
              {t(
                "Ini vault sungguhan di testnet, dibaca langsung dari kontrak tanpa dompet. Lihat jadwal uang sakunya, setiap pembayaran dan penahanan, lalu geser harga MON untuk melihat apa yang akan dilakukan kontrak.",
                "A real vault on testnet, read straight from the contracts without a wallet. See its allowance schedule, every payment and hold, then slide the MON price to see what the contract would do.",
              )}
            </p>
          </motion.div>

          {!sakuDeployed() || !vault ? (
            <div className="rounded-3xl border border-dashed border-amber-200 bg-amber-50 p-6 text-sm text-ink">
              {t("Kontrak belum dideploy di jaringan ini.", "Contracts are not deployed on this network yet.")}
            </div>
          ) : (
            <>
              {s && (
                <motion.div variants={fadeUp} className="mb-4">
                  <VaultHero
                    vaultAddress={vault}
                    collateral={s.collateral}
                    debt={s.debt}
                    spendable={s.spendable}
                    icr={s.icrBps}
                    btcPriceUsd={priceUsd}
                    defendICR={s.defendICR}
                  />
                </motion.div>
              )}

              <motion.section variants={fadeUp} className="mt-10">
                <h2 className="font-serif text-2xl md:text-[1.75rem] font-medium tracking-[-0.02em] text-ink mb-4">
                  {t("Amplop ", "Scheduled ")}
                  <em className="italic font-normal text-amber-600">{t("terjadwal", "envelopes")}</em>
                </h2>
                <ScheduleCards
                  schedules={schedules.data}
                  vault={vault}
                  livePrice={price}
                  ownerView={false}
                  isLoading={schedules.isLoading}
                  isError={schedules.isError}
                />
              </motion.section>

              <motion.div variants={fadeUp} className="mt-10">
                <LensPanel
                  vault={vault}
                  livePrice={price}
                  sakuAmount={next?.amount ?? schedules.data?.[0]?.amount ?? 0n}
                  sakuPending={!!next}
                />
              </motion.div>

              <motion.div variants={fadeUp} className="mt-10">
                <OnTimeCard vault={vault} />
              </motion.div>

              <motion.div variants={fadeUp} className="mt-10">
                <Ledger vault={vault} limit={8} keyFirst />
              </motion.div>

              <motion.div variants={fadeUp} className="mt-10">
                <DemoScope />
              </motion.div>

              <details className="group mt-10 rounded-3xl border border-cream-300 bg-surface/60 px-6 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-ink">
                  {t("Detail teknis: alamat kontrak", "Technical details: contract addresses")}
                  <ChevronDown className="w-4 h-4 text-muted transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-4">
                  <ContractList />
                </div>
              </details>
              <RateNote className="mt-6" />
            </>
          )}
        </motion.main>
      </div>
      <SakuFooter />
    </div>
  );
}

/** What this testnet demo proves, and what it does not: stated once, plainly. */
function DemoScope() {
  const { t } = useLang();
  const proven = [
    t("Aturan uang saku dijalankan di dalam vault, bukan oleh aplikasi", "The allowance rule is enforced inside the vault, not by the app"),
    t("Urutan nyata on-chain: dibayar → ditahan → dibela → dibayar lagi", "A real on-chain sequence: paid → held → defended → paid again"),
    t("Siapa pun bisa memicu pembayaran; vault tetap memeriksa ulang", "Anyone can trigger a payment; the vault re-checks it anyway"),
    t("Di Monad, amplop dibayar beberapa detik setelah jatuh tempo, terbukti dari cap waktu di kontrak", "On Monad, envelopes are paid seconds after falling due, shown by timestamps in the contract"),
  ];
  const notYet = [
    t("Bunga pinjaman sungguhan: CDP tiruan di testnet tidak memungut bunga", "Real borrowing cost: the testnet mock CDP charges no interest"),
    t("Harga dan likuidasi sungguhan: harga MON di sini disimulasikan", "Real prices and liquidations: the MON price here is simulated"),
    t("Penukaran ke Rupiah, pengguna nyata, dan audit keamanan", "Rupiah off-ramp, real users, and a security audit"),
  ];
  return (
    <section aria-labelledby="scope-title" className="rounded-3xl border border-cream-300 bg-surface shadow-soft p-6 sm:p-8">
      <h2 id="scope-title" className="font-serif text-2xl font-medium tracking-[-0.02em] text-ink">
        {t("Yang dibuktikan demo ini, ", "What this demo proves, ")}
        <em className="italic font-normal text-amber-600">{t("dan yang belum", "and what it does not")}</em>
      </h2>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <ul className="space-y-3">
          {proven.map((x) => (
            <li key={x} className="flex gap-3 text-[15px] leading-relaxed text-ink">
              <span className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-leaf-50 text-leaf-600">
                <Check className="h-3.5 w-3.5" />
              </span>
              {x}
            </li>
          ))}
        </ul>
        <ul className="space-y-3">
          {notYet.map((x) => (
            <li key={x} className="flex gap-3 text-[15px] leading-relaxed text-muted">
              <span className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-cream-200 text-muted">
                <Minus className="h-3.5 w-3.5" />
              </span>
              {x}
            </li>
          ))}
        </ul>
      </div>
      <a
        href="https://github.com/Stylenecy/cermin-saku-monad/blob/main/docs/THREAT-MODEL.md"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex text-sm font-medium text-amber-600 hover:text-amber-700"
      >
        {t("Risiko dan batasan lengkap ↗", "Full risks and limits ↗")}
      </a>
    </section>
  );
}

