"use client";

import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWriteContract, useWaitForTransactionReceipt, useAccount, useBalance } from "wagmi";
import { useRouter } from "next/navigation";
import { formatEther, parseEther, zeroAddress } from "viem";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/ui/Logo";
import { motion, AnimatePresence } from "framer-motion";
import { EASE_OUT } from "@/lib/motion";
import { PRESETS, GOAL_LABELS, RISK_LABELS, type RiskKey, type GoalLabel } from "@/lib/presets";
import { simulate } from "@/lib/simulation";
import { CONTRACTS, CERMIN_FACTORY_ABI } from "@/lib/contracts";
import { formatUsd, formatTxError } from "@/lib/utils";
import { formatIdr, formatNum, useUsdIdr } from "@/lib/idr";
import { useLang } from "@/lib/i18n";
import { EXPLORER_URL, activeChain } from "@/lib/chains";
import { useConfirmTimer } from "@/hooks/useConfirmTimer";
import { ConfirmedIn } from "@/components/saku/ConfirmedIn";
import {
  Coins,
  Target,
  Zap,
  Shield,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";

interface WizardState {
  btcAmount: string;
  btcPriceUsd: number;
  goal: GoalLabel | null;
  risk: RiskKey | null;
}

const TOTAL_STEPS = 5;

const stepVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 44 : -44, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -44 : 44, opacity: 0 }),
};

// The vault reverts with MinDebtNotMet() when the borrow at open
// (collateralValue * targetLTV) is under MIN_DEBT. MIN_DEBT is a deploy-time
// setting (Mezo: 2,000 MUSD; our Monad testnet deployment: 0.01), so it comes from
// the deployment via NEXT_PUBLIC_MIN_DEBT (wei). Checked client-side against the
// live price so the wizard never lets a user sign a transaction doomed to revert.
const MIN_MUSD_DEBT = Number(BigInt(process.env.NEXT_PUBLIC_MIN_DEBT || "20000000000000000000") / 10n ** 16n) / 100;
// Kept back from the wallet balance for the open transaction's gas.
const GAS_BUFFER_MON = 0.1; // Monad charges the gas limit; createVault needs well under this

function minDebtCheck(btcAmount: string, btcPriceUsd: number, targetLTV: number) {
  const btc = parseFloat(btcAmount || "0");
  const ltv = targetLTV / 10_000;
  const borrow = btc * btcPriceUsd * ltv;
  const meets = borrow >= MIN_MUSD_DEBT;
  const minBtc =
    btcPriceUsd > 0 && ltv > 0 ? MIN_MUSD_DEBT / (btcPriceUsd * ltv) : 0;
  return { borrow, meets, minBtc };
}

/** Rupiah first, dollars as the small second figure. */
function UsdNote({ usd, decimals = 2 }: { usd: number; decimals?: number }) {
  return <span className="ml-1 text-[0.8em] font-normal text-muted">({formatUsd(usd, decimals)})</span>;
}

function StepHeader({
  step,
  total,
  onBack,
}: {
  step: number;
  total: number;
  onBack: (() => void) | null;
}) {
  const { t } = useLang();
  const pct = ((step + 1) / total) * 100;
  return (
    <div className="flex items-center gap-4 mb-8">
      <button
        onClick={onBack ?? undefined}
        disabled={!onBack}
        aria-label={t("Kembali", "Back")}
        className="w-10 h-10 rounded-full bg-surface border border-cream-300 shadow-sm flex items-center justify-center disabled:opacity-30 hover:border-amber-200 hover:-translate-y-px transition-all duration-200 active:translate-y-0"
      >
        <ArrowLeft className="w-4 h-4" />
      </button>
      <div className="flex-1 h-1.5 rounded-full bg-cream-300 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-shadow-900 transition-[width] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-muted tabular-nums">
        {step + 1} / {total}
      </span>
    </div>
  );
}

function StepDeposit({
  state,
  onChange,
  onNext,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onNext: () => void;
}) {
  const { t, lang } = useLang();
  const { rate } = useUsdIdr();
  const { address } = useAccount();
  const { data: bal } = useBalance({ address, query: { enabled: !!address, refetchInterval: 15_000 } });
  const balanceBnb = bal ? Number(formatEther(bal.value)) : undefined;
  const usdValue = parseFloat(state.btcAmount || "0") * state.btcPriceUsd;
  const priceReady = state.btcPriceUsd > 0;
  // The lowest possible minimum is the highest-LTV preset (Aggressive). Require
  // at least that, so whatever strategy the user picks next is always valid.
  const maxLtv = Math.max(...Object.values(PRESETS).map((p) => p.targetLTV));
  const floor = minDebtCheck(state.btcAmount, state.btcPriceUsd, maxLtv);
  const balancedMin = minDebtCheck("0", state.btcPriceUsd, PRESETS.balanced.targetLTV).minBtc;
  const conservativeMin = minDebtCheck("0", state.btcPriceUsd, PRESETS.conservative.targetLTV).minBtc;
  const amount = parseFloat(state.btcAmount || "0");
  const amountEntered = amount > 0;
  const affordable = balanceBnb === undefined || amount + GAS_BUFFER_MON <= balanceBnb;
  const valid = amountEntered && (!priceReady || floor.meets) && affordable;
  const presets = ["1", "2", "5", "10"];
  const priceRp = formatIdr(state.btcPriceUsd * rate);

  return (
    <div className="space-y-7">
      <div>
        <Badge variant="amber" className="mb-3">
          <Coins className="w-3 h-3" />
          {t("Langkah 1", "Step 1")}
        </Badge>
        <h2 className="font-serif text-3xl font-medium tracking-[-0.02em] text-ink leading-tight">
          {t("Berapa MON yang mau kamu ", "How much MON do you want to ")}
          <em className="italic font-normal">{t("taruh di vault", "vault")}</em>?
        </h2>
        <p className="text-muted text-sm mt-2">
          {t(
            "MON-mu tetap utuh dan terkunci. Yang dipakai hanya dolar (MUSD) hasil pinjaman.",
            "Your MON stays locked. Only the borrowed dollars get spent.",
          )}
        </p>
      </div>

      <Input
        variant="big"
        type="number"
        placeholder="0.00"
        min="0.001"
        step="0.001"
        value={state.btcAmount}
        onChange={(e) => onChange({ btcAmount: e.target.value })}
        suffix="MON"
        aria-label={t("Jumlah MON yang disetor", "Amount of MON to deposit")}
      />

      {usdValue > 0 ? (
        <p className="text-sm text-muted text-right -mt-3">
          ≈ {formatIdr(usdValue * rate)}
          <UsdNote usd={usdValue} />
        </p>
      ) : (
        <p className="text-sm text-muted text-right -mt-3">
          MON ≈ {formatIdr(state.btcPriceUsd * rate)}
          <UsdNote usd={state.btcPriceUsd} decimals={0} /> · {t("harga simulasi", "simulated price")}
        </p>
      )}

      <div className="grid grid-cols-4 gap-2">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => onChange({ btcAmount: p })}
            aria-pressed={state.btcAmount === p}
            className={`h-11 rounded-full text-sm font-medium transition-all duration-200 tabular-nums ${
              state.btcAmount === p
                ? "bg-ink text-white shadow-soft"
                : "bg-surface border border-cream-300 text-ink hover:border-amber-200 hover:-translate-y-px"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-cream-300 bg-surface px-4 py-3 text-sm -mt-2">
        <span className="text-muted">{t("Saldo dompetmu", "Your wallet balance")}</span>
        <span className="font-medium tabular-nums text-ink">
          {balanceBnb === undefined ? "…" : `${formatNum(balanceBnb, lang, 4)} MON`}
        </span>
      </div>

      {amountEntered && !affordable && (
        <div className="text-sm -mt-3 space-y-2">
          <p className="text-danger">
            {t("Saldo belum cukup untuk setoran ini plus biaya gas. ", "Not enough balance for this deposit plus gas. ")}
            <a href="https://faucet.monad.xyz" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {t("Ambil MON gratis di faucet ↗", "Get free MON from the faucet ↗")}
            </a>
          </p>
          {address && (
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(address)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-cream-300 bg-surface px-4 py-2.5 text-left hover:border-amber-200"
            >
              <span className="min-w-0">
                <span className="block text-xs text-muted">{t("Kirim MON ke alamat dompetmu ini", "Send MON to this wallet address")}</span>
                <span className="block truncate font-mono text-xs text-ink">{address}</span>
              </span>
              <span className="shrink-0 text-xs font-medium text-amber-600">{t("Salin", "Copy")}</span>
            </button>
          )}
        </div>
      )}
      {amountEntered && affordable && priceReady && !floor.meets && (
        <p className="text-sm text-amber-700 -mt-3">
          {t("Terlalu kecil untuk membuka vault. Minimal", "Too small to open a vault. At least")}{" "}
          <span className="font-medium">{formatNum(floor.minBtc, lang, 4)} MON</span>.
        </p>
      )}

      <p className="text-xs text-muted-2 -mt-2">
        {priceReady
          ? t(
              `Profil ${RISK_LABELS.balanced.id} mulai dari ${formatNum(balancedMin, lang, 3)} MON · ${RISK_LABELS.conservative.id} ${formatNum(conservativeMin, lang, 3)} MON · 1 MON = ${priceRp} (testnet)`,
              `${RISK_LABELS.balanced.en} starts at ${formatNum(balancedMin, lang, 3)} MON · ${RISK_LABELS.conservative.en} ${formatNum(conservativeMin, lang, 3)} MON · 1 MON = ${priceRp} (testnet)`,
            )
          : t("Mengambil harga MON…", "Fetching the MON price…")}
      </p>

      <Button variant="primary" size="xl" className="w-full" onClick={onNext} disabled={!valid}>
        {t("Lanjut", "Continue")}
        <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

function StepGoal({
  state,
  onChange,
  onNext,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onNext: () => void;
}) {
  const { t, lang } = useLang();
  const options: { key: GoalLabel; icon: React.ReactNode }[] = [
    { key: "forever", icon: <Shield className="w-5 h-5" /> },
    { key: "spendNow", icon: <Target className="w-5 h-5" /> },
  ];

  return (
    <div className="space-y-7">
      <div>
        <Badge variant="amber" className="mb-3">{t("Langkah 2", "Step 2")}</Badge>
        <h2 className="font-serif text-3xl font-medium tracking-[-0.02em] text-ink leading-tight">
          {t("Apa ", "What's your ")}
          <em className="italic font-normal">{t("tujuanmu", "goal")}</em>?
        </h2>
        <p className="text-muted text-sm mt-2">
          {t(
            "Vault-nya sama apa pun pilihanmu. Ini cuma soal cara melihatnya.",
            "Same vault either way — this just frames the experience.",
          )}
        </p>
      </div>

      <div className="space-y-3">
        {options.map((opt) => {
          const meta = GOAL_LABELS[opt.key];
          const selected = state.goal === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => onChange({ goal: opt.key })}
              aria-pressed={selected}
              className={`w-full text-left rounded-3xl p-5 transition-all duration-200 flex items-start gap-4 ${
                selected
                  ? "bg-ink text-white shadow-lift"
                  : "bg-surface border border-cream-300 hover:border-amber-200 hover:-translate-y-0.5 hover:shadow-soft"
              }`}
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  selected ? "bg-white/15 text-white" : "bg-amber-50 text-amber-700"
                }`}
              >
                {opt.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-base font-semibold">{meta.title[lang]}</p>
                  <Badge variant={selected ? "amber" : "default"}>{meta.badge[lang]}</Badge>
                </div>
                <p className={`text-sm ${selected ? "text-white/70" : "text-muted"}`}>
                  {meta.tagline[lang]}
                </p>
              </div>
              {selected && <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-1" />}
            </button>
          );
        })}
      </div>

      <Button variant="primary" size="xl" className="w-full" onClick={onNext} disabled={!state.goal}>
        {t("Lanjut", "Continue")} <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

function StepRisk({
  state,
  onChange,
  onNext,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onNext: () => void;
}) {
  const { t, lang } = useLang();
  const options: {
    key: RiskKey;
    title: string;
    ltv: string;
    drop: string;
    desc: string;
    badge?: string;
  }[] = [
    {
      key: "conservative",
      title: RISK_LABELS.conservative[lang],
      ltv: "40% LTV",
      drop: t("tahan turun ~58%", "~58% drop tolerance"),
      desc: t(
        "Hasil lebih kecil, perlindungan paling tinggi. Cocok untuk pemegang MON yang setia.",
        "Lower yield, maximum protection. Perfect for MON maxis.",
      ),
    },
    {
      key: "balanced",
      title: RISK_LABELS.balanced[lang],
      ltv: "50% LTV",
      drop: t("tahan turun ~30%", "~30% drop tolerance"),
      desc: t("Risiko dan hasil yang seimbang untuk kebanyakan orang.", "Optimal risk-reward balance for most users."),
      badge: t("Disarankan", "Recommended"),
    },
    {
      key: "aggressive",
      title: RISK_LABELS.aggressive[lang],
      ltv: "70% LTV",
      drop: t("tahan turun ~12%", "~12% drop tolerance"),
      desc: t("Hasil paling besar, ruang aman lebih tipis.", "Maximum yield, tighter safety margins."),
    },
  ];

  // The selected preset must clear the min-debt floor for the entered deposit.
  const canContinue =
    !!state.risk &&
    (state.btcPriceUsd <= 0 ||
      minDebtCheck(state.btcAmount, state.btcPriceUsd, PRESETS[state.risk].targetLTV)
        .meets);

  return (
    <div className="space-y-7">
      <div>
        <Badge variant="amber" className="mb-3">
          <TrendingUp className="w-3 h-3" />
          {t("Langkah 3", "Step 3")}
        </Badge>
        <h2 className="font-serif text-3xl font-medium tracking-[-0.02em] text-ink leading-tight">
          {t("Pilih ", "Pick your ")}
          <em className="italic font-normal">{t("profil risiko", "risk profile")}</em>
          {t("-mu", "")}
        </h2>
        <p className="text-muted text-sm mt-2">
          {t(
            "Menentukan rasio pinjaman dan batas kapan keeper membela posisimu.",
            "Sets your borrow ratio and defense thresholds.",
          )}
        </p>
      </div>

      <div className="space-y-3">
        {options.map((opt) => {
          const selected = state.risk === opt.key;
          const check = minDebtCheck(
            state.btcAmount,
            state.btcPriceUsd,
            PRESETS[opt.key].targetLTV,
          );
          const affordable = state.btcPriceUsd <= 0 || check.meets;
          return (
            <button
              key={opt.key}
              onClick={() => affordable && onChange({ risk: opt.key })}
              disabled={!affordable}
              aria-pressed={selected}
              className={`w-full text-left rounded-3xl p-5 transition-all duration-200 ${
                !affordable
                  ? "bg-surface-soft border border-line opacity-60 cursor-not-allowed"
                  : selected
                    ? "bg-ink text-white shadow-lift"
                    : "bg-surface border border-cream-300 hover:border-amber-200 hover:-translate-y-0.5 hover:shadow-soft"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <p className="text-base font-semibold">{opt.title}</p>
                  {opt.badge && <Badge variant="amber">⭐ {opt.badge}</Badge>}
                </div>
                {selected && affordable && <CheckCircle2 className="w-5 h-5" />}
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${selected && affordable ? "bg-white/15 text-white" : "bg-amber-50 text-amber-700"}`}>
                  {opt.ltv}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${selected && affordable ? "bg-white/15 text-white" : "bg-success/15 text-success"}`}>
                  {opt.drop}
                </span>
              </div>
              <p className={`text-sm ${selected && affordable ? "text-white/70" : "text-muted"}`}>
                {opt.desc}
              </p>
              {!affordable && (
                <p className="text-xs text-amber-700 mt-2">
                  {t("Butuh", "Needs")} ≥ {check.minBtc.toFixed(4)} MON.{" "}
                  {t("Kamu baru memasukkan", "You entered")} {state.btcAmount || "0"} MON.{" "}
                  {t("Kembali dan setor lebih banyak.", "Go back to deposit more.")}
                </p>
              )}
            </button>
          );
        })}
      </div>

      <Button
        variant="primary"
        size="xl"
        className="w-full"
        onClick={onNext}
        disabled={!state.risk || !canContinue}
      >
        {t("Lanjut", "Continue")} <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

function StepPreview({
  state,
  onNext,
}: {
  state: WizardState;
  onNext: () => void;
  onBack: () => void;
}) {
  const { t, lang } = useLang();
  const { rate } = useUsdIdr();
  const params = PRESETS[state.risk ?? "balanced"];
  const btcNum = parseFloat(state.btcAmount || "0");
  const sim = simulate(btcNum, state.btcPriceUsd, params);
  const debt = minDebtCheck(state.btcAmount, state.btcPriceUsd, params.targetLTV);

  const fmt = (v: number) =>
    v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rp = (v: number) => formatIdr(v * rate);

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="amber" className="mb-3">
          <Zap className="w-3 h-3" />
          {t("Langkah 4", "Step 4")}
        </Badge>
        <h2 className="font-serif text-3xl font-medium tracking-[-0.02em] text-ink leading-tight">
          {t("Pratinjau ", "Your ")}
          <em className="italic font-normal text-amber-600">Shadow</em>
          {t("-mu", " preview")}
        </h2>
        <p className="text-muted text-sm mt-2">
          {t(
            `Perkiraan penghasilan dari ${btcNum.toFixed(4)} MON. Shadow = saldo pakai + tabungan.`,
            `Estimated income from ${btcNum.toFixed(4)} MON.`,
          )}
        </p>
      </div>

      <Card variant="accent" className="!p-6">
        <p className="text-xs uppercase tracking-wider text-white/80">{t("Penghasilan per bulan", "Monthly income")}</p>
        <p className="text-5xl font-semibold tabular-nums tracking-tight mt-1">
          {rp(sim.monthlyIncome)}
        </p>
        <p className="text-sm text-white/80 mt-1 tabular-nums">
          ≈ ${fmt(sim.monthlyIncome)} · {rp(sim.annualIncome)} (${fmt(sim.annualIncome)}) {t("per tahun", "per year")}
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="!p-5">
          <p className="text-xs text-muted">{t("Saldo pakai sekarang", "Spendable now")}</p>
          <p className="text-2xl font-semibold tabular-nums mt-1">
            {rp(sim.spendableNow)}
          </p>
          <p className="text-xs text-muted mt-0.5">
            <span className="tabular-nums">≈ ${fmt(sim.spendableNow)}</span> ·{" "}
            {t("langsung cair saat vault dibuka", "unlocked at open")}
          </p>
        </Card>
        <Card className="!p-5">
          <p className="text-xs text-muted">{t("Tahan turun", "Drop tolerance")}</p>
          <p className="text-2xl font-semibold tabular-nums text-success mt-1">
            ~{(sim.btcDropTolerance * 100).toFixed(0)}%
          </p>
          <p className="text-xs text-muted mt-0.5">{t("sebelum keeper membela", "before defense")}</p>
        </Card>
      </div>

      <Card variant="soft" className="!p-5 space-y-3">
        <Row
          label={t("Total pinjaman", "Total borrowed")}
          value={
            <>
              {rp(sim.totalBorrowed)}
              <span className="ml-1.5 text-[0.8em] font-normal text-muted">≈ {fmt(sim.totalBorrowed)} MUSD</span>
            </>
          }
        />
        <Row
          label={t("Masuk tabungan (sMUSD)", "Into sMUSD vault")}
          value={
            <>
              {rp(sim.inVault)}
              <span className="ml-1.5 text-[0.8em] font-normal text-muted">≈ {fmt(sim.inVault)} MUSD</span>
            </>
          }
        />
        <Row
          label={t("Strategi", "Strategy")}
          value={`${GOAL_LABELS[state.goal ?? "forever"].badge[lang]} · ${state.risk ? RISK_LABELS[state.risk][lang] : ""}`}
        />
      </Card>

      {!debt.meets && state.btcPriceUsd > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-1">
          <p className="text-xs font-medium text-amber-800">
            {t("Setoran terlalu kecil untuk strategi ini", "Deposit too small for this strategy")}
          </p>
          <p className="text-xs text-amber-700 leading-relaxed">
            {t(
              `Di harga ${rp(state.btcPriceUsd)}/MON (${formatUsd(state.btcPriceUsd, 0)}) dan LTV ${params.targetLTV / 100}%, ${btcNum.toFixed(4)} MON hanya bisa meminjam ~${rp(debt.borrow)} (~${debt.borrow.toFixed(0)} MUSD), di bawah minimum 2.000 MUSD. Setor minimal`,
              `At ${rp(state.btcPriceUsd)}/MON (${formatUsd(state.btcPriceUsd, 0)}) and ${params.targetLTV / 100}% LTV, ${btcNum.toFixed(4)} MON borrows only ~${rp(debt.borrow)} (~${debt.borrow.toFixed(0)} MUSD) — under the 2,000 MUSD minimum. Deposit at least`,
            )}{" "}
            <span className="font-medium">{debt.minBtc.toFixed(4)} MON</span>
            {t(", atau pilih strategi dengan LTV lebih tinggi.", ", or pick a higher-LTV strategy.")}
          </p>
        </div>
      )}

      <Button
        variant="primary"
        size="xl"
        className="w-full"
        onClick={onNext}
        disabled={!debt.meets && state.btcPriceUsd > 0}
      >
        {t("Buat vault", "Create vault")} <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

function Row({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: React.ReactNode;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className={`font-medium text-ink ${capitalize ? "capitalize" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function StepConfirm({
  state,
  onSuccess,
}: {
  state: WizardState;
  onSuccess: () => void;
}) {
  const { t, lang } = useLang();
  const { rate } = useUsdIdr();
  const params = PRESETS[state.risk ?? "balanced"];
  const queryClient = useQueryClient();
  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess: receiptReady,
  } = useWaitForTransactionReceipt({ hash: txHash });
  const confirmMs = useConfirmTimer(txHash, receiptReady);
  const [opening, setOpening] = useState(false);

  // A fetched receipt is not the same as a successful transaction: a reverted
  // tx still returns a receipt (status "reverted"). Only treat an explicit
  // "success" status as a created vault, otherwise the UI lies and the
  // dashboard then correctly finds no vault and bounces back to onboarding.
  const txSucceeded = receiptReady && receipt?.status === "success";
  const txReverted = receiptReady && receipt?.status === "reverted";

  // Safety net: block signing if the borrow would fall under the CDP min debt.
  const debt = minDebtCheck(state.btcAmount, state.btcPriceUsd, params.targetLTV);
  const blockedByMinDebt = !debt.meets && state.btcPriceUsd > 0;

  // The factory's vaultOf(address) read is cached (staleTime). Refresh it
  // before leaving so the dashboard sees the freshly created vault instead of
  // the pre-creation zero address — otherwise the dashboard bounces back here.
  const handleOpenDashboard = useCallback(async () => {
    setOpening(true);
    await Promise.race([
      queryClient.invalidateQueries().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
    onSuccess();
  }, [queryClient, onSuccess]);

  const handleCreate = () => {
    const btcNum = parseFloat(state.btcAmount || "0");
    const btcWei = parseEther(btcNum.toFixed(18) as `${number}`);
    writeContract({
      address: CONTRACTS.CERMIN_FACTORY,
      abi: CERMIN_FACTORY_ABI,
      functionName: "createVault",
      args: [params, 0n, zeroAddress, zeroAddress],
      value: btcWei,
    });
  };

  if (txSucceeded) {
    return (
      <div className="space-y-7 animate-fade-in text-center">
        <div className="w-20 h-20 rounded-full bg-success/15 flex items-center justify-center mx-auto animate-soft-pulse">
          <CheckCircle2 className="w-10 h-10 text-success animate-scale-in" />
        </div>
        <div>
          <h2 className="font-serif text-3xl font-medium tracking-[-0.02em]">
            Vault <em className="italic font-normal text-success">{t("berhasil dibuat", "created")}</em>
          </h2>
          <p className="text-muted text-sm mt-2 max-w-sm mx-auto">
            {t(
              "Vault Cermin-mu sudah aktif di Monad testnet. Shadow sudah jalan dan keeper ikut mengawasi.",
              "Your Cermin vault is live on Monad testnet. The Shadow is active and the keeper bot is watching.",
            )}
          </p>
        </div>
        <ConfirmedIn ms={confirmMs} />
        {txHash && (
          <a
            href={`${EXPLORER_URL}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-amber-600 hover:text-amber-700"
          >
            {t("Lihat transaksi ↗", "View transaction ↗")}
          </a>
        )}
        <Button
          variant="primary"
          size="xl"
          className="w-full"
          onClick={handleOpenDashboard}
          loading={opening}
          disabled={opening}
        >
          {t("Buka dashboard", "Open dashboard")} <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="amber" className="mb-3">{t("Langkah 5", "Step 5")}</Badge>
        <h2 className="font-serif text-3xl font-medium tracking-[-0.02em] text-ink leading-tight">
          {t("Cek & ", "Confirm & ")}
          <em className="italic font-normal">{t("tanda tangani", "sign")}</em>
        </h2>
        <p className="text-muted text-sm mt-2">
          {t("Satu transaksi untuk membuat dan mengisi vault-mu.", "One transaction creates and funds your vault.")}
        </p>
      </div>

      <Card variant="soft" className="!p-0 overflow-hidden">
        <div className="divide-y divide-line">
          <Field label={t("Setor", "Depositing")} value={`${state.btcAmount} MON`} />
          <Field
            label={t("Strategi", "Strategy")}
            value={`${GOAL_LABELS[state.goal ?? "forever"].badge[lang]} · ${state.risk ? RISK_LABELS[state.risk][lang] : ""}`}
          />
          <Field label={t("Jaringan", "Network")} value={activeChain.name} />
          <Field
            label={t("MON-mu", "MON stays")}
            value={t("Tetap utuh · tidak dijual", "Locked · Never sold")}
            valueClass="text-success"
          />
        </div>
      </Card>

      {error && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4">
          <p className="text-xs text-rose-700 leading-relaxed">
            {formatTxError(error)}
          </p>
        </div>
      )}

      {txReverted && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 space-y-1">
          <p className="text-xs font-medium text-rose-800">
            {t("Transaksi gagal. Vault tidak dibuat.", "Transaction reverted — no vault was created.")}
          </p>
          <p className="text-xs text-rose-700 leading-relaxed">
            {t(
              "Transaksi sudah masuk blok tapi gagal di chain. Kemungkinan besar setoranmu di bawah minimum utang 2.000 MUSD, atau dompetmu ada di jaringan yang salah. Sesuaikan lalu coba lagi.",
              "The tx was mined but failed on-chain. Most likely the deposit is below the 2,000 MUSD minimum debt, or your wallet is on the wrong network. Adjust and try again.",
            )}
          </p>
          {txHash && (
            <a
              href={`${EXPLORER_URL}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs text-rose-800 underline"
            >
              {t("Periksa transaksi ↗", "Inspect transaction ↗")}
            </a>
          )}
        </div>
      )}

      {blockedByMinDebt && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-1">
          <p className="text-xs font-medium text-amber-800">
            {t("Setoran di bawah minimum 2.000 MUSD", "Deposit below the 2,000 MUSD minimum")}
          </p>
          <p className="text-xs text-amber-700 leading-relaxed">
            {t(
              `${state.btcAmount || "0"} MON di harga ${formatIdr(state.btcPriceUsd * rate)}/MON (${formatUsd(state.btcPriceUsd, 0)}) dengan LTV ${params.targetLTV / 100}% hanya meminjam ~${formatIdr(debt.borrow * rate)} (~${debt.borrow.toFixed(0)} MUSD). Kembali dan setor minimal`,
              `${state.btcAmount || "0"} MON at ${formatIdr(state.btcPriceUsd * rate)}/MON (${formatUsd(state.btcPriceUsd, 0)}) and ${params.targetLTV / 100}% LTV borrows only ~${formatIdr(debt.borrow * rate)} (~${debt.borrow.toFixed(0)} MUSD). Go back and deposit at least`,
            )}{" "}
            <span className="font-medium">{debt.minBtc.toFixed(4)} MON</span>.
          </p>
        </div>
      )}

      <Button
        variant="primary"
        size="xl"
        className="w-full"
        onClick={handleCreate}
        loading={isPending || isConfirming}
        disabled={isPending || isConfirming || blockedByMinDebt}
      >
        {isPending
          ? t("Menunggu dompet…", "Waiting for wallet…")
          : isConfirming
          ? t("Menunggu konfirmasi di chain…", "Confirming on-chain…")
          : t("Tanda tangani & buat vault", "Sign & create vault")}
      </Button>
    </div>
  );
}

function Field({
  label,
  value,
  valueClass,
  capitalize,
}: {
  label: string;
  value: string;
  valueClass?: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <span className="text-sm text-muted">{label}</span>
      <span
        className={`text-sm font-medium ${valueClass ?? "text-ink"} ${capitalize ? "capitalize" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

interface OnboardingWizardProps {
  btcPriceUsd: number;
  onComplete: () => void;
}

export function OnboardingWizard({ btcPriceUsd, onComplete }: OnboardingWizardProps) {
  const router = useRouter();
  const { t } = useLang();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [state, setState] = useState<WizardState>({
    btcAmount: "",
    btcPriceUsd,
    goal: null,
    risk: null,
  });

  // Keep the live MON price flowing into the wizard. The price feed may resolve
  // after mount; without this, every calculation would use the stale snapshot
  // captured at mount (often the fallback price).
  useEffect(() => {
    setState((s) => (s.btcPriceUsd === btcPriceUsd ? s : { ...s, btcPriceUsd }));
  }, [btcPriceUsd]);

  const patch = useCallback(
    (p: Partial<WizardState>) => setState((s) => ({ ...s, ...p })),
    [],
  );
  const next = useCallback(() => {
    setDir(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }, []);
  const back = useCallback(() => {
    setDir(-1);
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  // Step 0 back exits the wizard to landing; the confirm step locks back.
  const onBack =
    step === TOTAL_STEPS - 1 ? null : step === 0 ? () => router.push("/") : back;

  return (
    <div className="bg-app min-h-[100svh]">
      <header className="glass border-b border-line/60 sticky top-0 z-30">
        <div className="mx-auto max-w-xl px-5 h-14 flex items-center justify-between pad-safe-top">
          <Link href="/" aria-label={t("Beranda Cermin Saku", "Cermin Saku home")} className="transition-opacity hover:opacity-80">
            <Logo />
          </Link>
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted">{t("Buka vault", "Open vault")}</span>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-5 py-6">
        <StepHeader step={step} total={TOTAL_STEPS} onBack={onBack} />

        <Card className="!p-6 sm:!p-8 overflow-hidden">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={step}
              custom={dir}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.32, ease: EASE_OUT }}
            >
              {step === 0 && <StepDeposit state={state} onChange={patch} onNext={next} />}
              {step === 1 && <StepGoal state={state} onChange={patch} onNext={next} />}
              {step === 2 && <StepRisk state={state} onChange={patch} onNext={next} />}
              {step === 3 && <StepPreview state={state} onNext={next} onBack={back} />}
              {step === 4 && <StepConfirm state={state} onSuccess={onComplete} />}
            </motion.div>
          </AnimatePresence>
        </Card>
      </main>
    </div>
  );
}
