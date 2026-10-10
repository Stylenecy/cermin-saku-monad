"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { parseAbiItem, parseEventLogs, formatUnits, type PublicClient, type Abi } from "viem";
import { Card } from "@/components/ui/Card";
import { truncateAddress } from "@/lib/utils";
import { EXPLORER_URL } from "@/lib/chains";
import { useLang } from "@/lib/i18n";
import { Rp } from "@/components/saku/Money";
import { Activity, Zap, ShieldCheck, ArrowUpRight, Plus, Lock, Sparkles } from "lucide-react";

type EventKind = "Opened" | "Skimmed" | "Defended" | "Withdrawn" | "Deposited" | "Closed";
type Tone = "success" | "warning" | "info" | "amber" | "muted";

export interface FeedEvent {
  type: EventKind;
  txHash: string;
  blockNumber: bigint;
  title: string;
  detail: string;
  value: string;
  tone: Tone;
  /** MUSD amount behind `value`, so the feed can show it in Rupiah. */
  amountWei?: bigint;
  sign?: "+" | "−";
  /** Withdrawal recipient, so the detail line can be translated. */
  to?: `0x${string}`;
}

// Feed copy per event type (Bahasa Indonesia first). Resolved at render time so
// switching language never refetches the logs.
const TEXT: Record<EventKind, { title: [string, string]; detail?: [string, string] }> = {
  Opened: { title: ["Vault dibuka", "Vault opened"], detail: ["Shadow-mu mulai jalan", "Your Shadow went live"] },
  Skimmed: { title: ["Skim saat MON naik", "Skimmed on a peak"], detail: ["Shadow-mu bertambah", "Topped up your Shadow"] },
  Defended: { title: ["Keeper membela posisi", "Defended the dip"] },
  Withdrawn: { title: ["Tarik dari Shadow", "Withdrew from Shadow"] },
  Deposited: { title: ["Jaminan ditambah", "Added collateral"], detail: ["Bantalan aman makin tebal", "Raised your buffer"] },
  Closed: { title: ["Vault ditutup", "Vault closed"], detail: ["MON dikembalikan ke kamu", "MON returned to you"] },
};

// The vault only ever emits these events, so we can pull every log it produced
// and decode locally — no per-event filtering needed.
const VAULT_ABI = [
  parseAbiItem("event VaultOpened(address indexed owner, (uint16,uint16,uint16,uint16,uint16) params)"),
  parseAbiItem(
    "event Skimmed(uint256 priceAtSkim, uint256 toSpendable, uint256 toVault, uint256 newDebt)",
  ),
  parseAbiItem(
    "event Defended(uint256 icrBefore, uint256 icrAfter, uint256 repaid, uint256 fromVault, uint256 fromSpendable)",
  ),
  parseAbiItem("event SpendableWithdrawn(address indexed recipient, uint256 amount)"),
  parseAbiItem("event CollateralAdded(uint256 amount)"),
  parseAbiItem("event Closed(uint256 btcReturned, uint256 musdRemainder)"),
] as const satisfies Abi;

// Monad's public RPC answers eth_getLogs for at most 100 blocks (~40 s) per call,
// so we walk backwards in 100-block chunks, stopping at VaultOpened or after
// MAX_CHUNKS (~20 minutes of blocks). Allowance history does not depend on this:
// it lives in CerminSaku's passbook, read from contract state.
const CHUNK_BLOCKS = 99n;
const MAX_CHUNKS = 30;
const REFRESH_MS = 30_000;

function musd(wei: bigint): string {
  return parseFloat(formatUnits(wei, 18)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function toFeedEvent(log: {
  eventName: string;
  args: Record<string, unknown>;
  transactionHash: string | null;
  blockNumber: bigint | null;
}): FeedEvent | null {
  const base = {
    txHash: log.transactionHash ?? "",
    blockNumber: log.blockNumber ?? 0n,
  };
  const a = log.args;
  switch (log.eventName) {
    case "Skimmed": {
      const toSpendable = (a.toSpendable as bigint) ?? 0n;
      const toVault = (a.toVault as bigint) ?? 0n;
      return {
        ...base,
        type: "Skimmed",
        title: "Skimmed on a peak",
        detail: "Topped up your Shadow",
        value: `+$${musd(toSpendable + toVault)}`,
        tone: "success",
        amountWei: toSpendable + toVault,
        sign: "+",
      };
    }
    case "Defended": {
      const repaid = (a.repaid as bigint) ?? 0n;
      const icrBefore = Number((a.icrBefore as bigint) ?? 0n) / 100;
      const icrAfter = Number((a.icrAfter as bigint) ?? 0n) / 100;
      return {
        ...base,
        type: "Defended",
        title: "Defended the dip",
        detail: `ICR ${icrBefore.toFixed(0)}% → ${icrAfter.toFixed(0)}%`,
        value: `−$${musd(repaid)}`,
        tone: "warning",
        amountWei: repaid,
        sign: "−",
      };
    }
    case "SpendableWithdrawn": {
      const amt = (a.amount as bigint) ?? 0n;
      const to = (a.recipient as `0x${string}`) ?? "0x";
      return {
        ...base,
        type: "Withdrawn",
        title: "Withdrew from Shadow",
        detail: `To ${truncateAddress(to)}`,
        value: `−$${musd(amt)}`,
        tone: "info",
        amountWei: amt,
        sign: "−",
        to,
      };
    }
    case "CollateralAdded": {
      const amt = (a.amount as bigint) ?? 0n;
      return {
        ...base,
        type: "Deposited",
        title: "Added collateral",
        detail: "Raised your buffer",
        value: `+${(Number(amt) / 1e18).toFixed(4)} MON`,
        tone: "amber",
      };
    }
    case "Closed": {
      const btc = (a.btcReturned as bigint) ?? 0n;
      return {
        ...base,
        type: "Closed",
        title: "Vault closed",
        detail: "MON returned to you",
        value: `${(Number(btc) / 1e18).toFixed(4)} MON`,
        tone: "muted",
      };
    }
    case "VaultOpened":
      return {
        ...base,
        type: "Opened",
        title: "Vault opened",
        detail: "Your Shadow went live",
        value: "",
        tone: "info",
      };
    default:
      return null;
  }
}

async function fetchActivity(
  client: PublicClient,
  vaultAddress: `0x${string}`,
): Promise<FeedEvent[]> {
  const latest = await client.getBlockNumber();
  const parsed: FeedEvent[] = [];

  // Walk backwards in <=10k-block windows until we reach the vault's opening
  // block (or run out of history), so even days-old skims/defenses show up.
  let toBlock = latest;
  for (let chunk = 0; chunk < MAX_CHUNKS && toBlock > 0n; chunk++) {
    const fromBlock = toBlock > CHUNK_BLOCKS ? toBlock - CHUNK_BLOCKS : 0n;
    const logs = await client.getLogs({ address: vaultAddress, fromBlock, toBlock });
    const decoded = parseEventLogs({ abi: VAULT_ABI, logs });

    let reachedOpen = false;
    for (const log of decoded) {
      const ev = toFeedEvent(log as Parameters<typeof toFeedEvent>[0]);
      if (ev) parsed.push(ev);
      if (log.eventName === "VaultOpened") reachedOpen = true;
    }

    if (reachedOpen) break;
    if (fromBlock === 0n) break;
    toBlock = fromBlock - 1n;
  }

  parsed.sort((a, b) => Number(b.blockNumber - a.blockNumber));
  return parsed.slice(0, 20);
}

const ICONS: Record<EventKind, React.ReactNode> = {
  Opened: <Sparkles className="w-4 h-4" />,
  Skimmed: <Zap className="w-4 h-4" />,
  Defended: <ShieldCheck className="w-4 h-4" />,
  Withdrawn: <ArrowUpRight className="w-4 h-4" />,
  Deposited: <Plus className="w-4 h-4" />,
  Closed: <Lock className="w-4 h-4" />,
};

const CHIP: Record<Tone, string> = {
  success: "bg-success/12 text-success",
  warning: "bg-amber-50 text-amber-700",
  info: "bg-info/12 text-info",
  amber: "bg-amber-50 text-amber-600",
  muted: "bg-surface-soft text-muted-2",
};

const VALUE: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  amber: "text-amber-700",
  muted: "text-muted",
};

export function ActivityFeed({
  vaultAddress,
  previewEvents,
}: {
  vaultAddress: `0x${string}`;
  previewEvents?: FeedEvent[];
}) {
  const client = usePublicClient();
  const { t, lang } = useLang();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["activity", vaultAddress],
    queryFn: () => fetchActivity(client as PublicClient, vaultAddress),
    enabled: !previewEvents && !!vaultAddress && !!client,
    refetchInterval: REFRESH_MS,
    staleTime: REFRESH_MS / 2,
    retry: 2,
  });

  const events = useMemo(() => previewEvents ?? data ?? [], [previewEvents, data]);
  const loading = !previewEvents && isLoading;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-mono text-xs text-amber-500 tabular-nums shrink-0">004</span>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted font-medium">{t("Aktivitas", "Activity")}</p>
            <p className="text-muted-2 text-xs truncate">
              {t("Semua yang dilakukan vault-mu, tercatat on-chain", "Everything your vault does, on-chain")}
            </p>
          </div>
        </div>
        {events.length > 0 && (
          <span className="flex items-center gap-1.5 shrink-0 font-mono text-[11px] text-muted-2 tabular-nums">
            {!previewEvents && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
            )}
            {events.length} {lang === "id" ? "kejadian" : events.length === 1 ? "event" : "events"}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-1 py-1.5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-r from-cream-200 via-cream-100 to-cream-200 bg-[length:200%_100%] animate-shimmer" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-1/3 rounded bg-gradient-to-r from-cream-200 via-cream-100 to-cream-200 bg-[length:200%_100%] animate-shimmer" />
                <div className="h-2.5 w-1/4 rounded bg-gradient-to-r from-cream-200 via-cream-100 to-cream-200 bg-[length:200%_100%] animate-shimmer" />
              </div>
              <div className="h-3 w-14 rounded bg-gradient-to-r from-cream-200 via-cream-100 to-cream-200 bg-[length:200%_100%] animate-shimmer" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-10">
          <p className="text-danger text-sm">{t("Aktivitas gagal dimuat", "Couldn't load activity")}</p>
          <p className="text-muted-2 text-xs mt-1">
            {t("RPC mungkin sedang tidak tersedia. Mencoba lagi.", "RPC may be temporarily unavailable — retrying.")}
          </p>
        </div>
      ) : events.length === 0 ? (
        <div className="py-8 flex flex-col items-center text-center">
          <span className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mb-4 animate-float">
            <Activity className="w-6 h-6" />
          </span>
          <p className="text-ink text-sm font-medium">{t("Belum ada aktivitas", "No activity yet")}</p>
          <p className="text-muted-2 text-xs mt-1 max-w-xs leading-relaxed">
            {t(
              "Skim, pembelaan posisi, penarikan, dan setoran muncul di sini begitu tercatat on-chain.",
              "Skims, defenses, withdrawals and deposits stream in here the moment they settle on-chain.",
            )}
          </p>
          <div className="mt-6 w-full max-w-md space-y-2.5" aria-hidden>
            {[80, 64, 72].map((w, i) => (
              <div key={i} className="flex items-center gap-3 opacity-40">
                <span className="w-9 h-9 rounded-full bg-cream-200 flex-shrink-0" />
                <span className="h-2.5 rounded-full bg-cream-200" style={{ width: `${w}%` }} />
                <span className="h-2.5 w-12 rounded-full bg-cream-200 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="relative -mx-1">
          {/* Scroll affordance: fade the timeline in and out at the edges. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-surface to-transparent z-10" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-surface to-transparent z-10" />
          {/* data-lenis-prevent lets this list scroll natively under Lenis smooth scroll. */}
          <ol
            data-lenis-prevent
            className="relative max-h-[20rem] sm:max-h-[24rem] overflow-y-auto overscroll-contain px-1 py-1 scrollbar-thin"
          >
            {events.map((ev, i) => {
              const first = i === 0;
              const last = i === events.length - 1;
              const copy = TEXT[ev.type];
              const title = copy ? t(copy.title[0], copy.title[1]) : ev.title;
              const detail = copy?.detail
                ? t(copy.detail[0], copy.detail[1])
                : ev.type === "Withdrawn" && ev.to
                  ? `${t("Ke", "To")} ${truncateAddress(ev.to)}`
                  : ev.detail;
              return (
                <li key={`${ev.txHash}-${i}`} className="relative">
                  <a
                    href={ev.txHash ? `${EXPLORER_URL}/tx/${ev.txHash}` : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group grid grid-cols-[2.25rem_1fr] gap-3 sm:gap-4 rounded-2xl px-2 py-2.5 transition-colors hover:bg-surface-soft"
                  >
                    {/* Node + continuous timeline rail. */}
                    <span className="relative flex justify-center">
                      <span
                        aria-hidden
                        className={`absolute left-1/2 w-px -translate-x-1/2 bg-line ${first ? "top-1/2" : "top-0"} ${last ? "bottom-1/2" : "bottom-0"}`}
                      />
                      <span
                        className={`relative z-[1] mt-0.5 flex h-9 w-9 items-center justify-center rounded-full ring-4 ring-surface ${CHIP[ev.tone]}`}
                      >
                        {ICONS[ev.type]}
                      </span>
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <p className="flex-1 truncate text-sm font-medium text-ink">{title}</p>
                        {ev.amountWei !== undefined ? (
                          <Rp
                            wei={ev.amountWei}
                            sign={ev.sign}
                            showUsd={false}
                            className={`shrink-0 text-sm font-semibold ${VALUE[ev.tone]}`}
                          />
                        ) : (
                          ev.value && (
                            <span className={`shrink-0 text-sm font-semibold tabular-nums ${VALUE[ev.tone]}`}>
                              {ev.value}
                            </span>
                          )
                        )}
                        <ArrowUpRight className="hidden h-3.5 w-3.5 shrink-0 text-muted-2 opacity-0 transition-opacity group-hover:opacity-100 sm:block" />
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-2">
                        <span className="truncate">{detail}</span>
                        {ev.amountWei !== undefined && (
                          <>
                            <span className="text-cream-300">·</span>
                            <span className="shrink-0 tabular-nums">≈ {musd(ev.amountWei)} MUSD</span>
                          </>
                        )}
                        <span className="text-cream-300">·</span>
                        <span className="shrink-0 font-mono tabular-nums">#{ev.blockNumber.toString()}</span>
                      </div>
                    </div>
                  </a>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </Card>
  );
}
