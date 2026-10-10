"use client";

import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { useLedger, type LedgerEntry } from "@/hooks/useSaku";
import { STATUS_TEXT, statusName } from "@/lib/saku";
import { EXPLORER_URL } from "@/lib/chains";
import { truncateAddress } from "@/lib/utils";
import { formatBps } from "@/lib/idr";
import { Rp, RpPrice } from "./Money";

function when(ts: number | undefined, lang: "id" | "en") {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleString(lang === "id" ? "id-ID" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

/** How long after its due time a payment landed, from the passbook's own two timestamps. */
function lateness(sec: number, t: (id: string, en: string) => string) {
  if (sec <= 1) return t("tepat waktu", "on time");
  if (sec < 120) return t(`${sec} dtk sesudah jatuh tempo`, `${sec} s after due`);
  const min = Math.round(sec / 60);
  if (min < 120) return t(`${min} mnt sesudah jatuh tempo`, `${min} min after due`);
  return t(`${Math.round(min / 60)} jam sesudah jatuh tempo`, `${Math.round(min / 60)} h after due`);
}

function Row({ e }: { e: LedgerEntry }) {
  const { t, lang } = useLang();
  let tag: React.ReactNode;
  let body: React.ReactNode;
  switch (e.kind) {
    case "paid":
      tag = <span className="rounded-md bg-daun px-2 py-0.5 text-xs font-bold text-white">{t("DIBAYAR", "PAID")}</span>;
      body = (
        <>
          <Rp wei={e.amount} className="font-semibold text-ink" /> → {truncateAddress(e.recipient ?? "")}
          <span className="text-muted"> · {t("ke", "no.")}-{e.paymentNo} · ICR {formatBps(e.icrBps, lang, 0)}</span>
        </>
      );
      break;
    case "held": {
      const s = statusName(e.reason ?? 0);
      tag = <span className="stamp text-stempel">{t("Ditahan", "Held")}</span>;
      body = (
        <>
          <span className="text-ink">{lang === "id" ? STATUS_TEXT[s].id : STATUS_TEXT[s].en}</span>
          <span className="text-muted">
            {" "}
            · ICR {formatBps(e.icrBps, lang, 1)} · MON <RpPrice price={e.price} />
          </span>
        </>
      );
      break;
    }
    case "defended":
      tag = <span className="rounded-md bg-kunyit px-2 py-0.5 text-xs font-bold text-white">{t("DIBELA", "DEFENDED")}</span>;
      body = (
        <>
          {t("Keeper mencicil utang", "Keeper repaid debt")} <Rp wei={e.amount} className="font-semibold text-ink" showUsd={false} />
          <span className="text-muted">
            {" "}
            · ICR {formatBps(e.icrBps, lang, 0)} → {formatBps(e.icrAfterBps, lang, 0)}
          </span>
        </>
      );
      break;
    case "skimmed":
      tag = <span className="rounded-md bg-tinta px-2 py-0.5 text-xs font-bold text-white">SKIM</span>;
      body = (
        <>
          {t("MON naik, Shadow bertambah", "MON rose, Shadow grew")} <Rp wei={e.amount} sign="+" showUsd={false} />
        </>
      );
      break;
    case "created":
      tag = <span className="rounded-md border border-tinta px-2 py-0.5 text-xs font-bold text-tinta">{t("JADWAL", "SCHEDULE")}</span>;
      body = (
        <>
          {t("Amplop baru", "New envelope")} <Rp wei={e.amount} showUsd={false} /> → {truncateAddress(e.recipient ?? "")}
        </>
      );
      break;
    case "cancelled":
      tag = <span className="rounded-md border border-line px-2 py-0.5 text-xs font-bold text-muted">{t("DIBATALKAN", "CANCELLED")}</span>;
      body = <>{t("Jadwal dibatalkan pemilik vault", "Schedule cancelled by the vault owner")}</>;
      break;
  }
  return (
    <li className="ledger-row grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 py-3 sm:grid-cols-[7.5rem_auto_1fr_auto] sm:items-center">
      <span className="col-span-2 font-mono text-xs text-muted tabular sm:col-span-1">{when(e.timestamp, lang)}</span>
      <span className="self-start sm:self-center">{tag}</span>
      <span className="min-w-0 text-sm leading-relaxed">{body}</span>
      {e.txHash ? (
        <a
          href={`${EXPLORER_URL}/tx/${e.txHash}`}
          target="_blank"
          rel="noreferrer"
          className="col-span-2 font-mono text-xs text-tinta underline-offset-2 hover:underline sm:col-span-1"
        >
          {e.txHash.slice(0, 10)}…
        </a>
      ) : e.kind === "paid" && e.timestamp !== undefined && e.dueAt !== undefined ? (
        <span className="col-span-2 text-xs text-muted tabular sm:col-span-1">{lateness(e.timestamp - e.dueAt, t)}</span>
      ) : (
        <span className="hidden sm:block" />
      )}
    </li>
  );
}

/** The passbook: every payment and hold from contract state, plus recent defends and skims, newest first. */
const KEY_KINDS: LedgerEntry["kind"][] = ["held", "defended", "created", "cancelled"];

export function Ledger({
  vault,
  limit = 30,
  keyFirst = false,
}: {
  vault: `0x${string}` | undefined;
  limit?: number;
  /** Open on the moments that matter (holds, defends, schedule changes) with a switch to everything. */
  keyFirst?: boolean;
}) {
  const { t } = useLang();
  const [all, setAll] = useState(false);
  const [onlyKey, setOnlyKey] = useState(keyFirst);
  const { data: raw, isLoading, isError, refetch } = useLedger(vault);
  const data = raw && onlyKey ? raw.filter((e) => KEY_KINDS.includes(e.kind)) : raw;
  return (
    <section aria-labelledby="ledger-title" className="rounded-3xl border border-cream-300 bg-surface shadow-soft p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="ledger-title" className="font-serif text-2xl font-medium tracking-[-0.02em] text-ink">
          {t("Buku ", "The ")}
          <em className="italic font-normal text-amber-600">{t("catatan", "passbook")}</em>
        </h2>
        {keyFirst && raw ? (
          <div className="inline-flex items-center gap-1 rounded-full border border-cream-300 bg-surface-soft p-0.5 text-xs font-medium">
            {[
              { on: true, label: t("Peristiwa penting", "Key moments") },
              { on: false, label: t(`Semua (${raw.length})`, `All (${raw.length})`) },
            ].map((o) => (
              <button
                key={String(o.on)}
                type="button"
                onClick={() => setOnlyKey(o.on)}
                aria-pressed={onlyKey === o.on}
                className={`h-7 rounded-full px-3 transition-colors ${onlyKey === o.on ? "bg-ink text-cream-50" : "text-muted hover:text-ink"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted">{t("dibaca dari kontrak, tanpa indexer", "read from the contract, no indexer")}</span>
        )}
      </div>
      {isLoading && <p className="mt-4 text-sm text-muted">{t("Membaca buku catatan dari Monad…", "Reading the passbook from Monad…")}</p>}
      {isError && (
        <p className="mt-4 text-sm text-stempel">
          {t("Gagal membaca dari RPC.", "Could not read from the RPC.")}{" "}
          <button type="button" onClick={() => refetch()} className="underline">
            {t("Coba lagi", "Retry")}
          </button>
        </p>
      )}
      {data && data.length === 0 && (
        <p className="mt-4 text-sm text-muted">{t("Belum ada catatan untuk vault ini.", "No entries for this vault yet.")}</p>
      )}
      {data && data.length > 0 && (
        <ol className="mt-3">
          {data.slice(0, all ? data.length : limit).map((e) => (
            <Row key={e.key} e={e} />
          ))}
        </ol>
      )}
      {data && data.length > limit && (
        <button type="button" onClick={() => setAll(!all)} className="mt-3 text-sm font-medium text-amber-600 hover:text-amber-700">
          {all ? t("Ringkas", "Show less") : t(`Tampilkan semua (${data.length})`, `Show all (${data.length})`)}
        </button>
      )}
    </section>
  );
}
