"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useVault } from "@/hooks/useVault";
import { useVaultActions } from "@/hooks/useVaultActions";
import { useBtcPrice } from "@/hooks/useBtcPrice";
import { BtcBalanceCard } from "@/components/dashboard/BtcBalanceCard";
import { ShadowBalanceCard } from "@/components/dashboard/ShadowBalanceCard";
import { StrategyCard } from "@/components/dashboard/StrategyCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { CloseVaultPanel } from "@/components/dashboard/CloseVaultPanel";
import { VaultHero } from "@/components/dashboard/VaultHero";
import { BtcPriceChart } from "@/components/dashboard/BtcPriceChart";
import { SavingsSection } from "@/components/dashboard/SavingsSection";
import { useSavings } from "@/hooks/useSavings";
import { useSavingsActions } from "@/hooks/useSavingsActions";
import { formatTxError } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { buttonClasses } from "@/components/ui/Button";
import { LineShadowText } from "@/components/ui/LineShadowText";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { useFeedPrice, useVaultSchedules } from "@/hooks/useSaku";
import { ScheduleCards } from "@/components/saku/ScheduleCards";

const TESTNET_PRICE_FALLBACK = 95_000;

function SkeletonCard() {
  const bar =
    "rounded bg-gradient-to-r from-cream-200 via-cream-100 to-cream-200 bg-[length:200%_100%] animate-shimmer";
  return (
    <div className="rounded-3xl border border-cream-300 bg-surface p-6">
      <div className={`h-4 w-1/3 mb-6 ${bar}`} />
      <div className={`h-10 w-2/3 mb-3 ${bar}`} />
      <div className={`h-3 w-1/2 ${bar}`} />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

function ErrorState() {
  const { t } = useLang();
  return (
    <div className="max-w-md mx-auto px-6 py-20 text-center">
      <div className="w-12 h-12 mx-auto rounded-full bg-danger/10 flex items-center justify-center mb-4">
        <span className="text-danger text-xl">!</span>
      </div>
      <h2 className="text-lg font-semibold text-ink">
        {t("Tidak bisa terhubung ke Monad", "Couldn't reach Monad")}
      </h2>
      <p className="text-muted text-sm mt-2">
        {t(
          "Data vault gagal dimuat. RPC mungkin sedang tidak tersedia. Kami coba lagi otomatis.",
          "Vault data failed to load. The RPC may be temporarily unavailable — retry will run automatically.",
        )}
      </p>
    </div>
  );
}

// Shown when a connected user has no vault yet. The dashboard is the hub: it
// invites you to open a position rather than silently redirecting to onboarding.
function NoPositionState() {
  const { t } = useLang();
  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-[1.75rem] font-medium tracking-[-0.02em] text-ink">
          {t("Dashboard-mu", "Your Dashboard")}
        </h1>
        <p className="text-muted text-sm mt-1">{t("Belum ada posisi yang terbuka.", "No open position yet.")}</p>
      </div>

      <div className="rounded-3xl border border-cream-300 bg-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_4px_12px_rgba(14,31,56,0.06)] p-10 md:p-16 text-center animate-rise-in">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-6 shadow-glow-amber animate-float">
          <Sparkles className="w-7 h-7" />
        </div>
        <h2 className="font-serif text-[1.9rem] font-medium tracking-[-0.02em] text-ink">
          {t("Buka ", "Open your ")}
          <em className="italic font-normal text-amber-600">{t("posisi pertamamu", "first position")}</em>
        </h2>
        <p className="text-muted text-sm mt-3 max-w-md mx-auto leading-relaxed">
          {t(
            "Setor MON sekali untuk membuka vault-mu di Monad. Dari situ kamu bisa menjadwalkan uang saku untuk anakmu tanpa menjual MON untuk membayarnya.",
            "Deposit MON once to open your vault on Monad. From there you can schedule your child's allowance without selling MON to pay it.",
          )}
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href="/onboard"
            className={buttonClasses({ variant: "primary", size: "xl" })}
          >
            {t("Buka posisi baru", "Open a new position")}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { isConnected } = useAccount();
  const router = useRouter();
  const {
    vaultAddress,
    hasVault,
    state,
    params,
    icr,
    debt,
    collateral,
    shadow,
    isLoading,
    isError,
  } = useVault();
  const { btcPriceUsd } = useBtcPrice();
  const {
    withdrawSpendable,
    isWithdrawLoading,
    withdrawError,
    addCollateral,
    isAddCollateralLoading,
    addCollateralError,
    defend,
    isDefendLoading,
    defendError,
    closeVault,
    closePhase,
    isCloseLoading,
    closeError,
    closeHash,
    approveHash,
  } = useVaultActions(vaultAddress);
  const savings = useSavings();
  const { price: feedPrice } = useFeedPrice();
  const schedules = useVaultSchedules(hasVault ? vaultAddress : undefined);
  const savingsActions = useSavingsActions();
  const { t } = useLang();

  useEffect(() => {
    if (!isConnected) router.replace("/");
  }, [isConnected, router]);

  const derived = useMemo(() => {
    if (!state || !params) return null;
    const effectiveBtcPrice = btcPriceUsd > 0 ? btcPriceUsd : TESTNET_PRICE_FALLBACK;
    const collValue = collateral ?? 0n;
    const spendable = shadow ? shadow[0] : state.spendableMusd;
    const vaultValue = shadow ? shadow[1] : 0n;
    return { effectiveBtcPrice, collValue, spendable, vaultValue };
  }, [state, params, collateral, shadow, btcPriceUsd]);

  if (!isConnected || isLoading) return <DashboardSkeleton />;
  if (isError) return <ErrorState />;
  if (!hasVault) return <NoPositionState />;
  if (!derived || !state || !params) return null;

  const { effectiveBtcPrice, collValue, spendable, vaultValue } = derived;
  const btcAmt = Number(collValue) / 1e18;
  const debtMusdNum = Number(debt ?? 0n) / 1e18;
  // Live ICR from collateral/debt valued at the live feed price — the same
  // ratio defend() checks on-chain. The vault's getICR() view is cached at
  // lastSeenPrice and only refreshes inside open/skim/defend, so between those
  // it reads stale (typically healthy) and would hide a real dip. Fall back to
  // that cached view only when the price feed is unavailable.
  const icrNum =
    btcPriceUsd > 0 && debtMusdNum > 0
      ? Math.round(((btcAmt * btcPriceUsd) / debtMusdNum) * 10000)
      : Number(icr ?? 0n);
  const needsDefense = icrNum > 0 && icrNum < params.defendICR;
  const liqPrice = btcAmt > 0 ? (1.1 * debtMusdNum) / btcAmt : 0;
  const defensePrice = btcAmt > 0 ? ((params.defendICR / 10000) * debtMusdNum) / btcAmt : 0;

  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[440px] overflow-hidden">
        <div className="absolute -top-28 left-1/2 -translate-x-1/2 w-[52rem] h-[30rem] rounded-full bg-amber-200/25 blur-[120px]" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(rgba(14,31,56,0.10) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            maskImage: "linear-gradient(to bottom, black, transparent)",
            WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
          }}
        />
      </div>
      <motion.div
        variants={staggerContainer(0.08, 0.05)}
        initial="hidden"
        animate="show"
        className="relative max-w-6xl mx-auto px-6 py-10"
      >
        <motion.div variants={fadeUp} className="mb-7">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-cream-300 bg-surface/70 backdrop-blur px-3 py-1.5 mb-3">
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${needsDefense ? "bg-warning" : "bg-success"}`} />
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink">
              {needsDefense ? t("Perlu tindakan", "Action needed") : t("Semua aman", "All systems go")}
            </span>
          </div>
          <h1 className="font-serif text-[2rem] md:text-[2.5rem] font-medium tracking-[-0.02em] text-ink leading-tight">
            {t("", "Your ")}
            <LineShadowText as="span" shadowColor="#35648F" className="italic font-normal text-ink">
              Vault
            </LineShadowText>
            {t("-mu", "")}
          </h1>
          <p className="text-muted mt-2.5 text-pretty max-w-xl leading-relaxed">
            {needsDefense
              ? t(
                  "Vault-mu turun di bawah garis bela. Tekan Bela di bawah untuk memulihkannya.",
                  "Your vault dipped below its defense line — hit Defend below to recover.",
                )
              : t(
                  "MON-mu tetap utuh. Uang saku dibayar dari saldo pakai sesuai jadwal; kalau MON turun terlalu dalam, pembayaran ditahan dan penjaga membela posisimu lebih dulu.",
                  "Your MON stays whole. Allowances are paid from the spendable balance on schedule; if MON falls too far, payments are held and the guard defends your position first.",
                )}
          </p>
        </motion.div>

      {withdrawError && (
        <div className="mb-4 rounded-2xl bg-danger/8 border border-danger/25 px-4 py-3">
          <p className="text-xs text-danger">
            {t("Gagal menarik:", "Withdraw failed:")} {formatTxError(withdrawError, 200)}
          </p>
        </div>
      )}

      {addCollateralError && (
        <div className="mb-4 rounded-2xl bg-danger/8 border border-danger/25 px-4 py-3">
          <p className="text-xs text-danger">
            {t("Gagal menambah jaminan:", "Add collateral failed:")} {formatTxError(addCollateralError, 200)}
          </p>
        </div>
      )}

      {defendError && (
        <div className="mb-4 rounded-2xl bg-danger/8 border border-danger/25 px-4 py-3">
          <p className="text-xs text-danger">
            {t("Gagal membela posisi:", "Defend failed:")} {formatTxError(defendError, 200)}
          </p>
          <p className="text-[11px] text-muted-2 mt-1">
            {t(
              "Kalau ICR sudah di atas batas bela, posisi tidak perlu dibela.",
              "If ICR is already above the defend threshold, no defense is needed.",
            )}
          </p>
        </div>
      )}

      <motion.div variants={fadeUp} className="mb-4">
        <VaultHero
          vaultAddress={vaultAddress!}
          collateral={collValue}
          debt={debt ?? 0n}
          spendable={spendable}
          icr={BigInt(icrNum)}
          btcPriceUsd={effectiveBtcPrice}
          defendICR={params.defendICR}
          onDefend={defend}
          isDefendLoading={isDefendLoading}
        />
      </motion.div>

      <motion.div variants={fadeUp} className="mb-4">
        <BtcPriceChart
          currentPrice={effectiveBtcPrice}
          liquidationPrice={liqPrice}
          defensePrice={defensePrice}
        />
      </motion.div>

      <motion.section variants={fadeUp} className="mb-8">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <h2 className="font-serif text-2xl md:text-[1.75rem] font-medium tracking-[-0.02em] text-ink">
            {t("Uang saku ", "Scheduled ")}
            <em className="italic font-normal text-amber-600">{t("terjadwal", "allowances")}</em>
          </h2>
          <Link href="/saku" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            {t("Atur uang saku", "Manage allowances")}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <ScheduleCards
          schedules={schedules.data}
          vault={vaultAddress}
          livePrice={feedPrice}
          ownerView
          isLoading={schedules.isLoading}
          isError={schedules.isError}
        />
      </motion.section>

      <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <motion.div
          whileHover={{ y: -4, transition: { type: "spring", stiffness: 400, damping: 26 } }}
          className="[&>*]:h-full"
        >
          <BtcBalanceCard
            collateral={collValue}
            debt={debt ?? 0n}
            btcPriceUsd={effectiveBtcPrice}
            onAddCollateral={addCollateral}
            isAddCollateralLoading={isAddCollateralLoading}
          />
        </motion.div>
        <motion.div
          whileHover={{ y: -4, transition: { type: "spring", stiffness: 400, damping: 26 } }}
          className="[&>*]:h-full"
        >
          <ShadowBalanceCard
            spendableMusd={spendable}
            onWithdraw={withdrawSpendable}
            isWithdrawLoading={isWithdrawLoading}
          />
        </motion.div>
        <motion.div
          whileHover={{ y: -4, transition: { type: "spring", stiffness: 400, damping: 26 } }}
          className="[&>*]:h-full"
        >
          <StrategyCard
            params={params}
            btcPriceUsd={effectiveBtcPrice}
            lastSkimPrice={state.lastSkimPrice}
            createdAt={state.createdAt}
          />
        </motion.div>
      </motion.div>

      <motion.div variants={fadeUp} className="mb-8">
        <SavingsSection
          poolTvl={savings.poolTvl}
          aprPct={5}
          vaultSavings={vaultValue}
          vaultPrincipal={state.smusdShares}
          userShares={savings.userShares}
          userYield={savings.userYield}
          walletMusd={savings.walletMusd}
          allowance={savings.allowance}
          onDeposit={savingsActions.deposit}
          onWithdraw={savingsActions.withdraw}
          onClaim={savingsActions.claim}
          depositPhase={savingsActions.depositPhase}
          isDepositing={savingsActions.isDepositing}
          isWithdrawing={savingsActions.isWithdrawing}
          isClaiming={savingsActions.isClaiming}
        />
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-1 gap-4">
        <ActivityFeed vaultAddress={vaultAddress!} />
      </motion.div>

      <motion.div variants={fadeUp} className="mt-8">
        <CloseVaultPanel
          vaultAddress={vaultAddress!}
          debt={debt ?? 0n}
          spendable={spendable}
          vaultValue={vaultValue}
          onClose={closeVault}
          closePhase={closePhase}
          isCloseLoading={isCloseLoading}
          closeError={closeError}
          closeHash={closeHash}
          approveHash={approveHash}
        />
      </motion.div>
      </motion.div>
    </div>
  );
}
