"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CONTRACTS, ERC20_ABI } from "@/lib/contracts";
import { formatTxError } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { Rp } from "@/components/saku/Money";
import { EXPLORER_URL } from "@/lib/chains";
import { AlertTriangle } from "lucide-react";
import type { ClosePhase } from "@/hooks/useVaultActions";

const GAS_COMP = 200n * 10n ** 18n;

interface CloseVaultPanelProps {
  vaultAddress: `0x${string}`;
  debt: bigint;
  spendable: bigint;
  vaultValue: bigint;
  onClose: (args: { shortfall: bigint; currentAllowance: bigint }) => void;
  closePhase: ClosePhase;
  isCloseLoading: boolean;
  closeError?: unknown;
  closeHash?: `0x${string}`;
  approveHash?: `0x${string}`;
}

export function CloseVaultPanel({
  vaultAddress,
  debt,
  spendable,
  vaultValue,
  onClose,
  closePhase,
  isCloseLoading,
  closeError,
  closeHash,
  approveHash,
}: CloseVaultPanelProps) {
  const { address: owner } = useAccount();
  const { t } = useLang();
  const [confirmed, setConfirmed] = useState(false);

  // Read owner's MUSD balance + allowance so we can sanity-check before firing.
  const { data: musdReads } = useReadContracts({
    contracts: owner
      ? [
          {
            address: CONTRACTS.MUSD,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [owner],
          },
          {
            address: CONTRACTS.MUSD,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [owner, vaultAddress],
          },
        ]
      : [],
    query: { enabled: !!owner, refetchInterval: 20_000 },
  });

  const ownerMusdBalance = (musdReads?.[0]?.result as bigint | undefined) ?? 0n;
  const allowance = (musdReads?.[1]?.result as bigint | undefined) ?? 0n;

  const { toBurn, shortfall, hasEnoughMusd } = useMemo(() => {
    const burn = debt > GAS_COMP ? debt - GAS_COMP : 0n;
    const available = spendable + vaultValue;
    const short = burn > available ? burn - available : 0n;
    return {
      toBurn: burn,
      shortfall: short,
      hasEnoughMusd: short === 0n || ownerMusdBalance >= short,
    };
  }, [debt, spendable, vaultValue, ownerMusdBalance]);

  const handleClose = () => {
    onClose({ shortfall, currentAllowance: allowance });
  };

  const buttonLabel = (() => {
    if (closePhase === "approving") return t("Menyetujui MUSD…", "Approving MUSD…");
    if (closePhase === "closing") return t("Menutup vault…", "Closing vault…");
    if (closePhase === "done") return t("Vault sudah ditutup", "Vault closed");
    return shortfall > 0n ? t("Setujui & tutup vault", "Approve & close vault") : t("Tutup vault", "Close vault");
  })();

  const covered = spendable + vaultValue > toBurn ? toBurn : spendable + vaultValue;

  return (
    <Card className="relative overflow-hidden border-danger/20 bg-danger/[0.025]">
      <div className="flex items-start gap-3.5 mb-5">
        <div className="w-10 h-10 rounded-2xl bg-danger/10 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 text-danger" />
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-danger/70 mb-1">
            005 · {t("Zona berbahaya", "Danger zone")}
          </p>
          <p className="text-sm font-semibold text-ink">{t("Tutup vault", "Close vault")}</p>
          <p className="text-xs text-muted mt-1 max-w-lg leading-relaxed">
            {t(
              "Melunasi utang MUSD-mu dan membuka kunci MON-mu. Shadow-mu (saldo pakai + tabungan) dipakai untuk melunasi pinjaman. Ini tidak bisa dibatalkan.",
              "Repays your MUSD debt and unlocks your MON. Your Shadow (spendable + savings) is spent to clear the loan — this can't be undone.",
            )}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-surface border border-cream-300 divide-y divide-line/70 mb-4">
        <Row label={t("Utang yang dilunasi", "Debt to repay")} value={<Rp wei={toBurn} />} />
        <Row label={t("Ditutup dari Shadow-mu", "Covered by your Shadow")} value={<Rp wei={covered} />} tone="success" />
        <Row
          label={t("Diambil dari dompetmu", "Pulled from your wallet")}
          value={<Rp wei={shortfall} />}
          tone={shortfall > 0n ? "warn" : "muted"}
        />
        {shortfall > 0n && (
          <Row
            label={t("Saldo MUSD-mu", "Your MUSD balance")}
            value={<Rp wei={ownerMusdBalance} />}
            tone={hasEnoughMusd ? "muted" : "danger"}
          />
        )}
      </div>

      {shortfall > 0n && !hasEnoughMusd && (
        <p className="text-xs text-danger mb-3">
          {t("Kamu butuh", "You need")} <Rp wei={shortfall - ownerMusdBalance} />{" "}
          {t(
            "lagi di dompetmu untuk menutup vault ini.",
            "more in your wallet to close this vault.",
          )}
        </p>
      )}

      {closeError ? (
        <p className="text-xs text-danger mb-3 break-words">{formatTxError(closeError)}</p>
      ) : null}

      {(approveHash || closeHash) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono text-muted mb-3">
          {approveHash && (
            <a
              href={`${EXPLORER_URL}/tx/${approveHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-ink transition-colors"
            >
              {t("Transaksi persetujuan ↗", "Approve tx ↗")}
            </a>
          )}
          {closeHash && (
            <a
              href={`${EXPLORER_URL}/tx/${closeHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-ink transition-colors"
            >
              {t("Transaksi tutup vault ↗", "Close tx ↗")}
            </a>
          )}
        </div>
      )}

      <label className="flex items-center gap-2.5 mb-4 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="w-4 h-4 rounded border-cream-400 accent-danger"
        />
        <span className="text-xs text-muted">
          {t(
            "Aku paham ini menutup vault-ku dan mengembalikan MON-ku.",
            "I understand this closes my vault and returns my MON.",
          )}
        </span>
      </label>

      <Button
        variant="danger"
        size="md"
        onClick={handleClose}
        loading={isCloseLoading}
        disabled={
          !confirmed ||
          isCloseLoading ||
          closePhase === "done" ||
          (shortfall > 0n && !hasEnoughMusd)
        }
        className="w-full"
      >
        {buttonLabel}
      </Button>
    </Card>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: "muted" | "warn" | "danger" | "success";
}) {
  const color =
    tone === "warn"
      ? "text-warning"
      : tone === "danger"
        ? "text-danger"
        : tone === "success"
          ? "text-success"
          : "text-ink";
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-sm font-mono tabular-nums ${color}`}>{value}</span>
    </div>
  );
}
