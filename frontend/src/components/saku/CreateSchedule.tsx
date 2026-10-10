"use client";

import { useEffect, useMemo, useState } from "react";
import { isAddress } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useLang } from "@/lib/i18n";
import { CERMIN_SAKU_ABI, CERMIN_VAULT_V11_ABI } from "@/lib/abis.generated";
import { PERIOD_PRESETS, SAKU, encodeLabel } from "@/lib/saku";
import { formatIdr, idrToMusdWei, useUsdIdr } from "@/lib/idr";
import { formatTxError } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/Button";
import { Rp } from "./Money";
import { useConfirmTimer } from "@/hooks/useConfirmTimer";
import { ConfirmedIn } from "./ConfirmedIn";

const field =
  "mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-ink placeholder:text-muted-2 focus:border-tinta focus:outline-none focus:ring-2 focus:ring-amber-200";

/**
 * Two transactions, both from the parent's wallet:
 *  1. vault.setSpendAllowance(Saku, cap) — the hard ceiling Saku may ever move
 *  2. saku.createSchedule(...)            — the envelopes themselves
 */
export function CreateSchedule({
  vault,
  spendable,
  allowance,
  onDone,
}: {
  vault: `0x${string}`;
  spendable: bigint | undefined;
  allowance: bigint | undefined;
  onDone?: () => void;
}) {
  const { t, lang } = useLang();
  const { rate } = useUsdIdr();
  const qc = useQueryClient();
  const [label, setLabel] = useState("Uang saku Rara");
  const [to, setTo] = useState("");
  const [idr, setIdr] = useState("25000");
  const [period, setPeriod] = useState<number>(600);
  const [count, setCount] = useState("12");

  const amount = useMemo(() => idrToMusdWei(Number(idr) || 0, rate), [idr, rate]);
  const n = Math.floor(Number(count) || 0);
  const total = amount * BigInt(Math.max(n, 0));
  const needsAllowance = allowance === undefined || allowance < total;

  const errors: string[] = [];
  if (!isAddress(to)) errors.push(t("Alamat penerima belum valid.", "Recipient address is not valid."));
  else if (to.toLowerCase() === vault.toLowerCase()) errors.push(t("Penerima tidak boleh vault itu sendiri.", "Recipient cannot be the vault itself."));
  if (amount <= 0n) errors.push(t("Nominal harus lebih dari nol.", "Amount must be above zero."));
  if (n < 1 || n > 120) errors.push(t("Jumlah amplop 1 sampai 120.", "Number of envelopes: 1 to 120."));
  if (!label.trim()) errors.push(t("Beri nama amplop.", "Name the envelope."));

  const grant = useWriteContract();
  const create = useWriteContract();
  const grantRc = useWaitForTransactionReceipt({ hash: grant.data });
  const createRc = useWaitForTransactionReceipt({ hash: create.data });
  const grantMs = useConfirmTimer(grant.data, grantRc.isSuccess);
  const createMs = useConfirmTimer(create.data, createRc.isSuccess);

  useEffect(() => {
    if (grantRc.isSuccess) qc.invalidateQueries();
  }, [grantRc.isSuccess, qc]);
  useEffect(() => {
    if (createRc.isSuccess) {
      qc.invalidateQueries();
      onDone?.();
    }
  }, [createRc.isSuccess, qc, onDone]);

  const busy = grant.isPending || grantRc.isLoading || create.isPending || createRc.isLoading;

  return (
    <form
      className="rounded-3xl border border-cream-300 bg-surface shadow-soft p-5 sm:p-7"
      onSubmit={(e) => {
        e.preventDefault();
        if (errors.length) return;
        create.writeContract({
          address: SAKU.SAKU,
          abi: CERMIN_SAKU_ABI,
          functionName: "createSchedule",
          args: [to as `0x${string}`, amount, BigInt(period), n, 0n, encodeLabel(label)],
        });
      }}
    >
      <h2 className="text-xl text-ink">{t("Jadwalkan amplop baru", "Schedule new envelopes")}</h2>
      <p className="mt-1 text-sm text-muted">
        {t(
          "Dibayar dari saldo pakai vault-mu, hanya saat posisi aman. Amplop pertama jatuh tempo segera setelah dijadwalkan.",
          "Paid from your vault's spendable balance, only while the position is safe. The first envelope is due right after scheduling.",
        )}
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">
          {t("Nama amplop", "Envelope name")}
          <input className={field} value={label} maxLength={31} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className="block text-sm font-semibold text-ink">
          {t("Alamat penerima (dompet anak)", "Recipient address (child's wallet)")}
          <input className={`${field} font-mono text-sm`} value={to} placeholder="0x…" onChange={(e) => setTo(e.target.value.trim())} />
        </label>
        <label className="block text-sm font-semibold text-ink">
          {t("Nominal per amplop (Rp)", "Amount per envelope (Rp)")}
          <input className={`${field} tabular`} inputMode="numeric" value={idr} onChange={(e) => setIdr(e.target.value.replace(/[^0-9]/g, ""))} />
          <span className="mt-1 block text-xs font-normal text-muted">
            = <Rp wei={amount} showUsd /> {t("· tersimpan di kontrak dalam MUSD; nilai Rupiah-nya ikut kurs", "· stored on-chain in MUSD; its Rupiah value follows the rate")}
          </span>
        </label>
        <label className="block text-sm font-semibold text-ink">
          {t("Setiap", "Every")}
          <select className={field} value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
            {PERIOD_PRESETS.map((p) => (
              <option key={p.seconds} value={p.seconds}>
                {lang === "id" ? p.id : p.en}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-ink">
          {t("Berapa kali", "How many times")}
          <input className={`${field} tabular`} inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/[^0-9]/g, ""))} />
        </label>
        <div className="rounded-xl bg-canvas-2 p-4 text-sm">
          <p className="text-muted">{t("Total paling banyak", "Total at most")}</p>
          <p className="mt-0.5 text-lg font-bold text-ink">
            <Rp wei={total} showUsd={false} />
          </p>
          <p className="mt-1 text-xs text-muted">
            {t("Saldo pakai sekarang", "Spendable now")}: <Rp wei={spendable} showUsd={false} />
          </p>
        </div>
      </div>

      {errors.length > 0 && (
        <ul className="mt-4 list-disc space-y-0.5 pl-5 text-sm text-kunyit">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={busy || errors.length > 0 || !needsAllowance}
          onClick={() =>
            grant.writeContract({
              address: vault,
              abi: CERMIN_VAULT_V11_ABI,
              functionName: "setSpendAllowance",
              args: [SAKU.SAKU, total + (allowance ?? 0n)],
            })
          }
          className={buttonClasses({ variant: needsAllowance ? "primary" : "secondary", size: "lg" })}
        >
          {grant.isPending || grantRc.isLoading
            ? t("Menunggu konfirmasi…", "Waiting for confirmation…")
            : needsAllowance
              ? `1 · ${t("Izinkan Saku membayar hingga", "Let Saku pay up to")} ${formatIdr((Number(total + (allowance ?? 0n)) / 1e18) * rate)}`
              : `1 · ${t("Izin sudah cukup", "Allowance is enough")} ✓`}
        </button>
        <button
          type="submit"
          disabled={busy || errors.length > 0 || needsAllowance}
          className={buttonClasses({ variant: needsAllowance ? "secondary" : "primary", size: "lg" })}
        >
          {create.isPending || createRc.isLoading ? t("Menjadwalkan…", "Scheduling…") : `2 · ${t("Jadwalkan amplop", "Schedule envelopes")}`}
        </button>
      </div>
      {(grant.error || create.error) && (
        <p className="mt-3 text-sm text-stempel">{formatTxError(grant.error ?? create.error, 200)}</p>
      )}
      {grantRc.isSuccess && !createRc.isSuccess && <ConfirmedIn ms={grantMs} className="mt-3" />}
      {createRc.isSuccess && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-daun">{t("Terjadwal. Keeper akan mengirim amplop pertama.", "Scheduled. The keeper will send the first envelope.")}</p>
          <ConfirmedIn ms={createMs} />
        </div>
      )}
      <p className="mt-4 text-xs text-muted">
        {t(
          "Izin (langkah 1) adalah batas di kontrak vault: Saku tidak bisa memindahkan lebih dari ini. Hanya kamu yang bisa menambah atau mencabutnya.",
          "The allowance (step 1) is a cap in the vault contract: Saku cannot move more than this. Only you can raise or revoke it.",
        )}
      </p>
    </form>
  );
}
