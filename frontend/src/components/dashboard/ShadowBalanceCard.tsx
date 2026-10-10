"use client";

import { useMemo, useState } from "react";
import { isAddress, parseUnits } from "viem";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { formatIdr, useUsdIdr } from "@/lib/idr";
import { useLang } from "@/lib/i18n";
import { Zap, ArrowUpRight } from "lucide-react";

interface SpendableCardProps {
  spendableMusd: bigint;
  onWithdraw?: (amount: bigint, recipient: `0x${string}`) => void;
  isWithdrawLoading?: boolean;
}

const usd2 = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ShadowBalanceCard({
  spendableMusd,
  onWithdraw,
  isWithdrawLoading,
}: SpendableCardProps) {
  const { t } = useLang();
  const { rate } = useUsdIdr();
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const spendable = useMemo(() => Number(spendableMusd) / 1e18, [spendableMusd]);

  const validation = useMemo(() => {
    const parsed = parseFloat(amount);
    if (!amount) return { ok: false, reason: null as string | null };
    if (isNaN(parsed) || parsed <= 0)
      return { ok: false, reason: t("Masukkan jumlah lebih dari 0", "Enter a positive amount") };
    if (parsed > spendable) return { ok: false, reason: t("Melebihi saldo pakai", "More than you can spend") };
    if (!recipient) return { ok: false, reason: null };
    if (!isAddress(recipient))
      return { ok: false, reason: t("Sepertinya itu bukan alamat yang valid", "That doesn't look like an address") };
    return { ok: true, reason: null };
  }, [amount, recipient, spendable, t]);

  const handleWithdraw = () => {
    if (!validation.ok || !onWithdraw) return;
    let amountWei: bigint;
    try {
      amountWei = parseUnits(amount as `${number}`, 18);
    } catch {
      return;
    }
    onWithdraw(amountWei, recipient as `0x${string}`);
    setShowForm(false);
    setAmount("");
    setRecipient("");
  };

  const inputCls =
    "w-full bg-surface border border-cream-300 rounded-xl px-3.5 py-2.5 text-sm text-ink caret-amber-500 placeholder-muted-2 focus:outline-none focus:border-amber-300 focus:shadow-ring transition-all duration-200";

  return (
    <Card className="relative overflow-hidden flex flex-col">
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs text-amber-500 tabular-nums">002</span>
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted font-medium">
              {t("Saldo pakai", "Spendable")}
            </p>
            <p className="text-muted-2 text-xs">{t("Bagian Shadow-mu · siap dipakai", "Your Shadow · ready to spend")}</p>
          </div>
        </div>
        <span className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
          <Zap className="w-4 h-4" />
        </span>
      </div>

      <div className="mb-1">
        <AnimatedNumber
          key={rate}
          value={spendable}
          format={(n) => formatIdr(n * rate)}
          className="block text-4xl font-semibold text-ink tabular-nums tracking-tight leading-none"
        />
        <p className="text-base font-medium text-muted-2 mt-1 tabular-nums">≈ {usd2(spendable)} MUSD</p>
      </div>

      <p className="text-xs text-muted-2 mt-3 leading-relaxed">
        {t(
          "Dipinjam dengan jaminan MON-mu. Tarik ke alamat mana pun untuk dipakai. MON-mu tetap utuh.",
          "Borrowed against your MON. Withdraw to any address to spend — your MON stays locked.",
        )}
      </p>

      <div className="mt-auto pt-5">
        {!showForm ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowForm(true)}
            className="w-full"
            disabled={spendable <= 0}
          >
            <ArrowUpRight className="w-4 h-4" />
            {t("Tarik", "Withdraw")}
          </Button>
        ) : (
          <div className="space-y-2 animate-fade-in">
            <input
              type="number"
              inputMode="decimal"
              placeholder={t("Jumlah (MUSD)", "Amount (MUSD)")}
              aria-label={t("Jumlah MUSD yang ditarik", "Amount of MUSD to withdraw")}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              max={spendable}
              min={0}
              step="0.01"
              className={inputCls}
            />
            <input
              type="text"
              placeholder={t("Alamat penerima (0x...)", "Recipient (0x...)")}
              aria-label={t("Alamat penerima", "Recipient address")}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              className={`${inputCls} font-mono`}
            />
            {validation.reason && <p className="text-[11px] text-danger">{validation.reason}</p>}
            <div className="flex gap-2 pt-1">
              <Button
                variant="primary"
                size="sm"
                onClick={handleWithdraw}
                loading={isWithdrawLoading}
                disabled={!validation.ok || isWithdrawLoading}
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
                  setRecipient("");
                }}
              >
                {t("Batal", "Cancel")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
