import {
  decodeEventLog,
  encodeFunctionData,
  formatTransactionReceipt,
  keccak256,
  type Hash,
  type PublicClient,
  type TransactionReceipt,
  type WalletClient,
} from 'viem';
import { CERMIN_SAKU_ABI } from '../abis/generated.js';
import { withRetry } from '../rpc/retry.js';
import { enqueueWrite } from '../rpc/txQueue.js';

const RECEIPT_TIMEOUT_MS = 120_000;

export interface ReleaseResult {
  hash: Hash;
  /** 'paid' = AllowancePaid emitted; 'held' = AllowanceHeld emitted. */
  outcome: 'paid' | 'held';
  /** Milliseconds from handing the signed transaction to the RPC until its receipt was in hand. */
  confirmMs: number;
  /** 'sync' = eth_sendRawTransactionSync answered with the receipt; 'poll' = sent, then polled for it. */
  via: 'sync' | 'poll';
}

/**
 * Call CerminSaku.release(id). Permissionless: the keeper can only trigger a
 * payment the vault itself approves (or record that it was held).
 *
 * On Monad the transaction goes out through eth_sendRawTransactionSync, which
 * returns the receipt in the same round trip once the block is in, so the
 * keeper knows the outcome in about a block time instead of polling for it.
 * RPCs without that method fall back to send + poll.
 */
export async function executeRelease(
  publicClient: PublicClient,
  walletClient: WalletClient,
  saku: `0x${string}`,
  id: bigint,
): Promise<ReleaseResult> {
  const account = walletClient.account;
  if (!account) throw new Error('walletClient has no account');

  await withRetry(() =>
    publicClient.simulateContract({
      address: saku,
      abi: CERMIN_SAKU_ABI,
      functionName: 'release',
      args: [id],
      account,
    }),
  );
  const data = encodeFunctionData({ abi: CERMIN_SAKU_ABI, functionName: 'release', args: [id] });

  return enqueueWrite(async () => {
    // Monad charges the gas limit, not the gas used, so keep viem's exact estimate (no padding).
    const prepared = await walletClient.prepareTransactionRequest({ to: saku, data, account, chain: walletClient.chain });
    const serializedTransaction = await walletClient.signTransaction(prepared as never);
    const hash = keccak256(serializedTransaction);

    const t0 = performance.now();
    let receipt: TransactionReceipt;
    let via: ReleaseResult['via'] = 'sync';
    try {
      const raw = await publicClient.request({
        method: 'eth_sendRawTransactionSync',
        params: [serializedTransaction],
      } as never);
      receipt = formatTransactionReceipt(raw as never);
    } catch (err) {
      via = 'poll';
      // Not supported here: send it the classic way. Any other error (a timeout,
      // a dropped connection) may come after the node accepted it, so look it up by hash.
      if (isUnsupported(err)) await publicClient.sendRawTransaction({ serializedTransaction });
      else if (!isTimeout(err)) throw err;
      receipt = await withRetry(() =>
        publicClient.waitForTransactionReceipt({ hash, timeout: RECEIPT_TIMEOUT_MS, pollingInterval: 100 }),
      );
    }
    const confirmMs = Math.round(performance.now() - t0);

    if (receipt.status === 'reverted') throw new Error(`release reverted on-chain (${hash})`);
    let outcome: ReleaseResult['outcome'] = 'held';
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== saku.toLowerCase()) continue;
      try {
        const ev = decodeEventLog({ abi: CERMIN_SAKU_ABI, data: log.data, topics: log.topics });
        if (ev.eventName === 'AllowancePaid') outcome = 'paid';
      } catch {
        // not a Saku event
      }
    }
    return { hash, outcome, confirmMs, via };
  });
}

function errorText(err: unknown): { code?: number; message: string } {
  const e = err as { code?: number; cause?: { code?: number }; message?: string; details?: string };
  return { code: e.code ?? e.cause?.code, message: `${e.message ?? ''} ${e.details ?? ''}`.toLowerCase() };
}

export function isUnsupported(err: unknown): boolean {
  const { code, message } = errorText(err);
  return code === -32601 || message.includes('method not found') || message.includes('not supported');
}

export function isTimeout(err: unknown): boolean {
  const { code, message } = errorText(err);
  return code === 4 || message.includes('timeout') || message.includes('timed out');
}
