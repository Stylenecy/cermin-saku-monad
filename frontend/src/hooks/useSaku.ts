"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient, useReadContract, useReadContracts } from "wagmi";
import { zeroAddress, type PublicClient } from "viem";
import { CERMIN_LENS_ABI, CERMIN_SAKU_ABI, CERMIN_VAULT_V11_ABI } from "@/lib/abis.generated";
import { SAKU, sakuDeployed } from "@/lib/saku";
import { CONTRACTS, PRICE_FEED_ABI } from "@/lib/contracts";

const REFRESH = 15_000;

export interface ScheduleRow {
  id: bigint;
  vault: `0x${string}`;
  recipient: `0x${string}`;
  amount: bigint;
  period: bigint;
  start: bigint;
  periods: number;
  paid: number;
  cancelled: boolean;
  label: `0x${string}`;
  due: number;
  nextDueAt: bigint;
}

/** Live MON/USD from the price feed (simulated MockPriceFeed on testnet). */
export function useFeedPrice() {
  const enabled = CONTRACTS.PRICE_FEED !== zeroAddress;
  const { data, isLoading, isError } = useReadContract({
    address: CONTRACTS.PRICE_FEED,
    abi: PRICE_FEED_ABI,
    functionName: "fetchPrice",
    query: { enabled, refetchInterval: REFRESH },
  });
  return { price: data as bigint | undefined, isLoading: enabled && isLoading, isError: enabled && isError };
}

/** Everything Lens knows about a vault at a (hypothetical) price. */
export function useLensSnapshot(vault: `0x${string}` | undefined, price: bigint | undefined) {
  const enabled = !!vault && vault !== zeroAddress && !!price && price > 0n && sakuDeployed();
  return useReadContract({
    address: SAKU.LENS,
    abi: CERMIN_LENS_ABI,
    functionName: "snapshot",
    args: enabled ? [vault!, price!] : undefined,
    query: { enabled, refetchInterval: REFRESH },
  });
}

/** What defend() and a Saku payment would do at a hypothetical price. */
export function useLensWhatIf(
  vault: `0x${string}` | undefined,
  price: bigint | undefined,
  sakuAmount: bigint,
) {
  const enabled = !!vault && vault !== zeroAddress && !!price && price > 0n && sakuDeployed();
  const { data, isLoading, isError } = useReadContracts({
    contracts: enabled
      ? [
          { address: SAKU.LENS, abi: CERMIN_LENS_ABI, functionName: "previewDefend", args: [vault!, price!] },
          {
            address: SAKU.LENS,
            abi: CERMIN_LENS_ABI,
            functionName: "previewSaku",
            args: [vault!, SAKU.SAKU, sakuAmount, price!],
          },
          { address: SAKU.LENS, abi: CERMIN_LENS_ABI, functionName: "snapshot", args: [vault!, price!] },
        ]
      : [],
    query: { enabled, placeholderData: (prev) => prev },
  });
  return {
    defend: data?.[0]?.result,
    saku: data?.[1]?.result as readonly [number, bigint, bigint, bigint] | undefined,
    snapshot: data?.[2]?.result,
    isLoading,
    isError,
  };
}

/** Saku schedules paid by a vault, with due counts. */
export function useVaultSchedules(vault: `0x${string}` | undefined) {
  const client = usePublicClient();
  const enabled = !!client && !!vault && vault !== zeroAddress && sakuDeployed();
  return useQuery({
    queryKey: ["saku-schedules", vault],
    enabled,
    refetchInterval: REFRESH,
    queryFn: () => readSchedules(client!, "schedulesOfVault", vault!),
  });
}

/** Saku schedules that pay a recipient (the child's view). */
export function useRecipientSchedules(recipient: `0x${string}` | undefined) {
  const client = usePublicClient();
  const enabled = !!client && !!recipient && recipient !== zeroAddress && sakuDeployed();
  return useQuery({
    queryKey: ["saku-recipient", recipient],
    enabled,
    refetchInterval: REFRESH,
    queryFn: () => readSchedules(client!, "schedulesOfRecipient", recipient!),
  });
}

async function readSchedules(
  client: PublicClient,
  fn: "schedulesOfVault" | "schedulesOfRecipient",
  who: `0x${string}`,
): Promise<ScheduleRow[]> {
  const ids = (await client.readContract({
    address: SAKU.SAKU,
    abi: CERMIN_SAKU_ABI,
    functionName: fn,
    args: [who],
  })) as readonly bigint[];
  const rows = await Promise.all(
    ids.map(async (id) => {
      const [s, due, next] = await Promise.all([
        client.readContract({ address: SAKU.SAKU, abi: CERMIN_SAKU_ABI, functionName: "getSchedule", args: [id] }),
        client.readContract({ address: SAKU.SAKU, abi: CERMIN_SAKU_ABI, functionName: "dueCount", args: [id] }),
        client.readContract({ address: SAKU.SAKU, abi: CERMIN_SAKU_ABI, functionName: "nextDueAt", args: [id] }),
      ]);
      return { id, ...s, due: Number(due), nextDueAt: next } as ScheduleRow;
    }),
  );
  return rows.reverse();
}

/** Owner-granted allowance and policy for Saku on a vault. */
export function useSakuAllowance(vault: `0x${string}` | undefined) {
  const enabled = !!vault && vault !== zeroAddress && sakuDeployed();
  const { data, refetch } = useReadContracts({
    contracts: enabled
      ? [
          { address: vault!, abi: CERMIN_VAULT_V11_ABI, functionName: "spendAllowance", args: [SAKU.SAKU] },
          { address: vault!, abi: CERMIN_VAULT_V11_ABI, functionName: "sakuPolicy" },
          { address: vault!, abi: CERMIN_VAULT_V11_ABI, functionName: "owner" },
        ]
      : [],
    query: { enabled, refetchInterval: REFRESH },
  });
  return {
    allowance: data?.[0]?.result as bigint | undefined,
    policy: data?.[1]?.result as { floorBufferBps: number; stressBps: number } | undefined,
    owner: data?.[2]?.result as `0x${string}` | undefined,
    refetch,
  };
}

export type LedgerKind = "paid" | "held" | "defended" | "skimmed" | "created" | "cancelled";

export interface LedgerEntry {
  kind: LedgerKind;
  /** Stable React key. */
  key: string;
  /** Only for entries read from event logs (defend, skim). */
  txHash?: `0x${string}`;
  scheduleId?: bigint;
  amount?: bigint;
  recipient?: `0x${string}`;
  paymentNo?: number;
  reason?: number;
  icrBps?: bigint;
  icrAfterBps?: bigint;
  price?: bigint;
  timestamp?: number;
  /** When the period paid or held was due (passbook lines only). */
  dueAt?: number;
}

const PASSBOOK_PAGE = 200n;
// Monad's public RPC answers eth_getLogs for at most 100 blocks per call.
const LOG_WINDOW = 99n;
const RECENT_BLOCKS = 1_000n;

/**
 * The passbook for a vault.
 *
 * - Saku payments and holds come from CerminSaku's passbook in contract state:
 *   complete, one call per schedule, no indexer, however old the vault is.
 * - The vault's own defend/skim events come from event logs, but Monad's public
 *   RPC serves logs 100 blocks (~40 s) at a time, so only two places are read:
 *   the blocks listed in NEXT_PUBLIC_LEDGER_BLOCKS (the demo's recorded defends)
 *   and the last ~1,000 blocks.
 */
export function useLedger(vault: `0x${string}` | undefined) {
  const client = usePublicClient();
  const enabled = !!client && !!vault && vault !== zeroAddress && sakuDeployed();
  return useQuery({
    queryKey: ["saku-ledger", vault],
    enabled,
    refetchInterval: 15_000,
    queryFn: async (): Promise<LedgerEntry[]> => {
      const c = client!;
      const [book, events] = await Promise.all([readPassbook(c, vault!), readVaultEvents(c, vault!)]);
      const out = [...book, ...events];
      // Newest first; a line without a time (a cancellation) sits on top.
      out.sort((x, y) => (y.timestamp ?? Infinity) - (x.timestamp ?? Infinity));
      return out;
    },
  });
}

async function readPassbook(c: PublicClient, vault: `0x${string}`): Promise<LedgerEntry[]> {
  const ids = (await c.readContract({
    address: SAKU.SAKU,
    abi: CERMIN_SAKU_ABI,
    functionName: "schedulesOfVault",
    args: [vault],
  })) as readonly bigint[];
  const out: LedgerEntry[] = [];
  await Promise.all(
    ids.map(async (id) => {
      const [s, len] = await Promise.all([
        c.readContract({ address: SAKU.SAKU, abi: CERMIN_SAKU_ABI, functionName: "getSchedule", args: [id] }),
        c.readContract({ address: SAKU.SAKU, abi: CERMIN_SAKU_ABI, functionName: "passbookLength", args: [id] }),
      ]);
      out.push({
        kind: "created",
        key: `created-${id}`,
        scheduleId: id,
        amount: s.amount,
        recipient: s.recipient,
        timestamp: Number(s.start),
      });
      if (s.cancelled) out.push({ kind: "cancelled", key: `cancelled-${id}`, scheduleId: id });
      for (let off = 0n; off < len; off += PASSBOOK_PAGE) {
        const page = await c.readContract({
          address: SAKU.SAKU,
          abi: CERMIN_SAKU_ABI,
          functionName: "passbook",
          args: [id, off, PASSBOOK_PAGE],
        });
        page.forEach((e, i) => {
          const paid = e.paymentNo > 0;
          out.push({
            kind: paid ? "paid" : "held",
            key: `book-${id}-${off + BigInt(i)}`,
            scheduleId: id,
            amount: e.amount,
            recipient: s.recipient,
            paymentNo: paid ? e.paymentNo : undefined,
            reason: paid ? undefined : Number(e.status),
            icrBps: BigInt(e.icrBps),
            price: e.price,
            timestamp: Number(e.at),
            dueAt: Number(e.dueAt),
          });
        });
      }
    }),
  );
  return out;
}

function ledgerHintBlocks(): bigint[] {
  return (process.env.NEXT_PUBLIC_LEDGER_BLOCKS || "")
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => BigInt(b));
}

async function readVaultEvents(c: PublicClient, vault: `0x${string}`): Promise<LedgerEntry[]> {
  const latest = await c.getBlockNumber();
  const ranges: [bigint, bigint][] = ledgerHintBlocks().map((b) => [b, b]);
  const floor = latest > RECENT_BLOCKS ? latest - RECENT_BLOCKS : 0n;
  for (let f = floor; f <= latest; f += LOG_WINDOW + 1n) ranges.push([f, f + LOG_WINDOW > latest ? latest : f + LOG_WINDOW]);
  const logs = (
    await Promise.all(
      ranges.map(([fromBlock, toBlock]) =>
        c.getContractEvents({ address: vault, abi: CERMIN_VAULT_V11_ABI, fromBlock, toBlock }).catch(() => []),
      ),
    )
  ).flat();
  const seen = new Set<string>();
  const out: (LedgerEntry & { blockNumber: bigint })[] = [];
  for (const l of logs) {
    const key = `${l.transactionHash}-${l.logIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const a = l.args as Record<string, unknown>;
    const base = { key, txHash: l.transactionHash!, blockNumber: l.blockNumber! };
    if (l.eventName === "Defended")
      out.push({ ...base, kind: "defended", amount: a.repaid as bigint, icrBps: a.icrBefore as bigint, icrAfterBps: a.icrAfter as bigint });
    else if (l.eventName === "Skimmed")
      out.push({ ...base, kind: "skimmed", amount: (a.toSpendable as bigint) + (a.toVault as bigint), price: a.priceAtSkim as bigint });
  }
  const times = new Map<bigint, number>();
  await Promise.all(
    [...new Set(out.map((e) => e.blockNumber))].map(async (b) => {
      times.set(b, Number((await c.getBlock({ blockNumber: b })).timestamp));
    }),
  );
  return out.map(({ blockNumber, ...e }) => ({ ...e, timestamp: times.get(blockNumber) }));
}
