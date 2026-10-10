import type { PublicClient } from 'viem';
import { CERMIN_SAKU_ABI, CERMIN_VAULT_V11_ABI } from '../abis/generated.js';
import { withRetry } from '../rpc/retry.js';

/** Mirrors ICerminVault.SakuStatus. */
export const SAKU_STATUS = [
  'Ok',
  'AllowanceExceeded',
  'InsufficientSpendable',
  'IcrBelowFloor',
  'ReserveTooThin',
] as const;
export type SakuStatus = (typeof SAKU_STATUS)[number];

export interface SakuSchedule {
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
}

export interface DueSchedule {
  schedule: SakuSchedule;
  due: number;
}

export type SakuAction = 'RELEASE' | 'RECORD_HOLD' | 'WAIT';

export interface SakuDecision {
  action: SakuAction;
  status: SakuStatus;
  reason: string;
}

const STATUS_REASON: Record<SakuStatus, string> = {
  Ok: 'position is safe — paying the allowance',
  AllowanceExceeded: 'the owner\'s spend allowance for Saku is used up',
  InsufficientSpendable: 'not enough spendable MUSD in the vault',
  IcrBelowFloor: 'ICR is below the Saku floor (defendICR + buffer) — defense comes first',
  ReserveTooThin: 'paying would leave too little reserve to survive the stress drop',
};

export function statusReason(status: SakuStatus): string {
  return STATUS_REASON[status];
}

/**
 * Decide what the keeper does with one due schedule.
 *
 * - Safe → RELEASE (money moves).
 * - Unsafe → the contract would only emit AllowanceHeld. We still send that
 *   release once per `holdCooldownMs` so the refusal is on-chain evidence, but
 *   not every cycle (no spam, no wasted gas). In between: WAIT.
 */
export function decideSaku(
  status: SakuStatus,
  lastHoldAt: number | undefined,
  now: number,
  holdCooldownMs: number,
): SakuDecision {
  if (status === 'Ok') return { action: 'RELEASE', status, reason: statusReason(status) };
  if (lastHoldAt === undefined || now - lastHoldAt >= holdCooldownMs) {
    return { action: 'RECORD_HOLD', status, reason: `HOLD: ${statusReason(status)}` };
  }
  return { action: 'WAIT', status, reason: `HOLD (already recorded): ${statusReason(status)}` };
}

/** All schedules that have at least one payment due right now. */
export async function listDueSchedules(client: PublicClient, saku: `0x${string}`): Promise<DueSchedule[]> {
  const count = await withRetry(() =>
    client.readContract({ address: saku, abi: CERMIN_SAKU_ABI, functionName: 'scheduleCount' }),
  );
  const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i));
  const rows = await Promise.all(
    ids.map(async id => {
      const [s, due] = await Promise.all([
        withRetry(() => client.readContract({ address: saku, abi: CERMIN_SAKU_ABI, functionName: 'getSchedule', args: [id] })),
        withRetry(() => client.readContract({ address: saku, abi: CERMIN_SAKU_ABI, functionName: 'dueCount', args: [id] })),
      ]);
      const schedule: SakuSchedule = {
        id,
        vault: s.vault,
        recipient: s.recipient,
        amount: s.amount,
        period: s.period,
        start: s.start,
        periods: s.periods,
        paid: s.paid,
        cancelled: s.cancelled,
        label: s.label,
      };
      return { schedule, due: Number(due) };
    }),
  );
  return rows.filter(r => r.due > 0 && !r.schedule.cancelled && r.schedule.paid < r.schedule.periods);
}

/** The vault's own verdict on paying `amount` through Saku at `price`. */
export async function previewStatus(
  client: PublicClient,
  saku: `0x${string}`,
  s: SakuSchedule,
  price: bigint,
): Promise<{ status: SakuStatus; icrBps: bigint }> {
  const [status, icrBps] = await withRetry(() =>
    client.readContract({
      address: s.vault,
      abi: CERMIN_VAULT_V11_ABI,
      functionName: 'sakuStatus',
      args: [saku, s.amount, price],
    }),
  );
  return { status: SAKU_STATUS[status] ?? 'Ok', icrBps };
}

/** bytes32 label → readable string (trailing zero bytes dropped). */
export function decodeLabel(label: `0x${string}`): string {
  const hex = label.slice(2).replace(/(00)+$/, '');
  return Buffer.from(hex, 'hex').toString('utf8');
}

/**
 * Earliest `nextDueAt` (unix seconds) over schedules that still have payments
 * left, or undefined when none do. A due time in the past means a payment is
 * owed but was held or is waiting.
 */
export async function earliestNextDue(client: PublicClient, saku: `0x${string}`): Promise<bigint | undefined> {
  const count = await withRetry(() =>
    client.readContract({ address: saku, abi: CERMIN_SAKU_ABI, functionName: 'scheduleCount' }),
  );
  const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i));
  const dues = await Promise.all(
    ids.map(id =>
      withRetry(() => client.readContract({ address: saku, abi: CERMIN_SAKU_ABI, functionName: 'nextDueAt', args: [id] })),
    ),
  );
  let best: bigint | undefined;
  for (const d of dues) if (d > 0n && (best === undefined || d < best)) best = d;
  return best;
}

/**
 * How long the keeper sleeps before the next Saku check.
 *
 * - Next payment in the future: wake `slackMs` after it falls due on the
 *   chain's clock (`chainOffsetMs` = chain time − local time), so the release
 *   lands in the first blocks where it is payable.
 * - Already due (held, or waiting for a safe price): re-check every `recheckMs`.
 * - Nothing scheduled: `idleMs`.
 * Always capped at `idleMs`, so a schedule created meanwhile is picked up.
 */
export function msUntilNextSaku(
  nextDue: bigint | undefined,
  nowMs: number,
  chainOffsetMs: number,
  opts: { slackMs: number; recheckMs: number; idleMs: number },
): number {
  if (nextDue === undefined) return opts.idleMs;
  const dueLocalMs = Number(nextDue) * 1000 - chainOffsetMs;
  const wait = dueLocalMs - nowMs;
  if (wait <= 0) return Math.min(opts.recheckMs, opts.idleMs);
  return Math.min(wait + opts.slackMs, opts.idleMs);
}
