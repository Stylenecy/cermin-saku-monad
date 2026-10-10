"use client";

import { useEffect, useMemo, useState } from "react";
import { parseEther } from "viem";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { formatUsd } from "@/lib/utils";
import { formatIdr, useUsdIdr } from "@/lib/idr";
import { useLang } from "@/lib/i18n";
import { ShieldCheck, Coins, Plus } from "lucide-react";

const MEZO_MAX_LTV = 90;

interface CollateralCardProps {
  collateral: bigint;
  debt: bigint;
  btcPriceUsd: number;
  onAddCollateral?: (amountWei: bigint) => void;
  isAddCollateralLoading?: boolean;
}

export function BtcBalanceCard({
  collateral,
  debt,
  btcPriceUsd,
  onAddCollateral,
  isAddCollateralLoading,
}: CollateralCardProps) {
  const { t } = useLang();
  const { rate } = useUsdIdr();
  const btcAmount = Number(collateral) / 1e18;
  const usdValue = btcAmount * btcPriceUsd;
  const debtMusd = Number(debt) / 1e18;
  const netValue = usdValue - debtMusd;
  const ltvPct = usdValue > 0 ? (debtMusd / usdValue) * 100 : 0;

  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [barW, setBarW] = useState(0);
  useEffect(() => {
    let raf = 0;
    const id = setTimeout(() => {
      raf = requestAnimationFrame(() => setBarW(Math.min(100, (ltvPct / MEZO_MAX_LTV) * 100)));
    }, 200);
    return () => {
      clearTimeout(id);
      cancelAnimationFrame(raf);
    };
  }, [ltvPct]);

  const validation = useMemo(() => {
    if (!amount) return { ok: false, reason: null as string | null };
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0)
      return { ok: false, reason: t("Masukkan jumlah lebih dari 0", "Enter a positive amount") };
    return { ok: true, reason: null };
  }, [amount, t]);

  const addUsd = (parseFloat(amount) || 0) * btcPriceUsd;

  const handleAdd = () => {
    if (!validation.ok || !onAddCollateral) return;
    let wei: bigint;
    try {
      wei = parseEther(amount as `${number}`);
    } catch {
      return;
    }
    onAddCollateral(wei);
    setShowForm(false);
    setAmount("");
  };

  return (
    <Card glow className="relative overflow-hidden flex flex-col">
      <Coins
        aria-hidden
        className="pointer-events-none absolute -right-6 -bottom-6 w-32 h-32 text-amber-500/[0.06]"
      />
      <div className="relative flex items-start justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs text-amber-500 tabular-nums">001</span>
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted font-medium">
              {t("MON · jaminan", "MON · collateral")}
            </p>
            <p className="text-muted-2 text-xs">{t("Terkunci sebagai jaminan", "Locked as collateral")}</p>
          </div>
        </div>
        <Badge variant="success">
          <ShieldCheck className="w-3 h-3 mr-1" />
          {t("Terlindungi", "Protected")}
        </Badge>
      </div>

      <div className="relative flex items-end gap-3">
        <Coins className="w-7 h-7 text-amber-500/70 mb-1.5" />
        <div>
          <AnimatedNumber
            value={btcAmount}
            format={(n) => n.toFixed(6)}
            className="block text-4xl font-semibold text-ink tabular-nums tracking-tight leading-none"
          />
          <p className="text-base font-medium text-muted-2 mt-1">
            MON ·{" "}
            <AnimatedNumber key={rate} value={usdValue} format={(n) => formatIdr(n * rate)} className="tabular-nums" />
            <span className="ml-1.5 text-[0.8em] font-normal text-muted tabular-nums">≈ {formatUsd(usdValue)}</span>
          </p>
        </div>
      </div>

      {/* net value vs debt */}
      <div className="relative grid grid-cols-2 gap-px mt-5 rounded-2xl overflow-hidden bg-line/70 border border-cream-300">
        <div className="bg-surface px-3.5 py-3">
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-2 font-mono">
            {t("Nilai bersih", "Net value")}
          </div>
          <div className="text-sm font-semibold tabular-nums text-ink mt-1">{formatIdr(netValue * rate)}</div>
          <div className="text-[11px] tabular-nums text-muted">≈ {formatUsd(netValue)}</div>
        </div>
        <div className="bg-surface px-3.5 py-3">
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-2 font-mono">{t("Utang", "Borrowed")}</div>
          <div className="text-sm font-semibold tabular-nums text-ink mt-1">{formatIdr(debtMusd * rate)}</div>
          <div className="text-[11px] tabular-nums text-muted">≈ {formatUsd(debtMusd)}</div>
        </div>
      </div>

      {/* LTV utilization */}
      <div className="relative mt-4">
        <div className="flex items-center justify-between text-[11px] font-mono mb-1.5">
          <span className="text-muted">
            {t("Dipinjam dari nilai MON", "Borrowed against MON")}{" "}
            <span className="text-ink tabular-nums">{ltvPct.toFixed(0)}%</span>
          </span>
          <span className="text-muted-2 tabular-nums">
            {t("maks", "max")} {MEZO_MAX_LTV}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-cream-300 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-[width] duration-[1100ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
            style={{ width: `${barW}%` }}
          />
        </div>
      </div>

      {onAddCollateral && (
        <div className="relative mt-auto pt-5">
          {!showForm ? (
            <Button variant="secondary" size="sm" onClick={() => setShowForm(true)} className="w-full">
              <Plus className="w-4 h-4" />
              {t("Tambah MON", "Add MON")}
            </Button>
          ) : (
            <div className="space-y-2 animate-fade-in">
              <p className="text-[11px] text-muted-2 leading-relaxed">
                {t(
                  "Tambah MON = bantalan aman lebih tebal. Ini tidak otomatis menambah pinjaman.",
                  "More MON = a bigger safety buffer. It doesn't borrow more on its own.",
                )}
              </p>
              <input
                type="number"
                inputMode="decimal"
                placeholder={t("Jumlah (MON)", "Amount (MON)")}
                aria-label={t("Jumlah MON yang ditambahkan", "Amount of MON to add")}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={0}
                step="0.001"
                className="w-full bg-surface border border-cream-300 rounded-xl px-3.5 py-2.5 text-sm text-ink caret-amber-500 placeholder-muted-2 focus:outline-none focus:border-amber-300 focus:shadow-ring transition-all duration-200"
              />
              {addUsd > 0 && (
                <p className="text-[11px] text-muted-2 text-right">
                  ≈ {formatIdr(addUsd * rate)} <span className="text-muted">({formatUsd(addUsd)})</span>
                </p>
              )}
              {validation.reason && <p className="text-[11px] text-danger">{validation.reason}</p>}
              <div className="flex gap-2 pt-1">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleAdd}
                  loading={isAddCollateralLoading}
                  disabled={!validation.ok || isAddCollateralLoading}
                  className="flex-1"
                >
                  {t("Konfirmasi", "Confirm")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowForm(false);
                    setAmount("");
                  }}
                >
                  {t("Batal", "Cancel")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
