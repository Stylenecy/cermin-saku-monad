import pino, { type Logger } from 'pino';
import type { Hash } from 'viem';

import { loadConfig, type Config } from './config.js';
import { createClients, type AgentClients } from './rpc/clients.js';
import { mapWithLimit, withRetry } from './rpc/retry.js';
import { fetchPriceAndVaults, snapshotVault, decide } from './monitors/vaults.js';
import { executeSkim } from './executors/skim.js';
import { executeDefend } from './executors/defend.js';
import { executeAccrueYield } from './executors/accrueYield.js';
import { executeRelease } from './executors/release.js';
import { decideSaku, decodeLabel, earliestNextDue, listDueSchedules, msUntilNextSaku, previewStatus } from './monitors/saku.js';
import { initDb, recordAction, lastActionAt } from './storage/actionLog.js';
import { createMetrics, type Metrics } from './metrics.js';
import { startHealthServer } from './health.js';
import type { Action } from './types.js';
import { CERMIN_VAULT_ABI } from './abis/CerminVault.js';

interface Deps {
  config: Config;
  clients: AgentClients;
  logger: Logger;
  db: ReturnType<typeof initDb>;
  metrics: Metrics;
}

const VAULT_CONCURRENCY = 5;
// Sane band for the MON price feed (1e18-scaled USD): $0.0001 .. ~$10M. Outside
// this the reading is garbage; skim is paused but defend (ICR-based, read from
// the vault on-chain) still runs.
const MIN_SANE_PRICE = 10n ** 14n;
const MAX_SANE_PRICE = 10n ** 25n;

// Consecutive defend failures per vault — a sustained streak means a vault is
// drifting toward liquidation while our repair keeps failing (e.g. out of gas).
const defendFailures = new Map<string, number>();

// Monotonic cycle counter. A cycle abandoned by the watchdog (withTimeout) keeps
// running; guarding metric writes on the active seq stops that zombie cycle from
// clobbering the liveness/counters of the cycle that succeeds it.
let cycleSeq = 0;

async function processVault(deps: Deps, vault: `0x${string}`, price: bigint, priceSane: boolean): Promise<void> {
  const { clients, logger, db, metrics } = deps;
  let snap;
  try {
    snap = await snapshotVault(clients.publicClient, vault);
  } catch (err) {
    // A closed vault stays in allVaults(); its getICR() view overflows once the
    // trove has zero debt, so skip it instead of failing silently every cycle.
    const debt = await clients.publicClient
      .readContract({ address: vault, abi: CERMIN_VAULT_ABI, functionName: 'getDebt' })
      .catch(() => undefined);
    if (debt === 0n) {
      logger.debug({ vault }, 'vault closed (zero debt), skipping');
      return;
    }
    logger.error({ vault, err }, 'vault snapshot failed');
    throw err;
  }
  const decision = decide(snap, price, priceSane);
  const { action, reason } = decision;
  // icrBps is the LIVE ratio the decision acted on; cachedIcrBps is the vault's
  // getICR() view, surfaced so a divergence (stale cache) is visible in logs.
  logger.info({ vault, action, icrBps: decision.icrBps, cachedIcrBps: snap.icrBps }, reason);

  let txHash: Hash | undefined;
  try {
    if (action === 'DEFEND') {
      txHash = await executeDefend(clients.publicClient, clients.walletClient, vault);
      defendFailures.set(vault, 0);
    } else if (action === 'SKIM') {
      txHash = await executeSkim(clients.publicClient, clients.walletClient, vault);
    }
    if (txHash) {
      metrics.txSubmitted += 1;
      logger.info({ vault, action, txHash }, 'tx confirmed');
    }
  } catch (err) {
    metrics.txFailed += 1;
    metrics.lastError = err instanceof Error ? err.message : String(err);
    if (action === 'DEFEND') {
      const n = (defendFailures.get(vault) ?? 0) + 1;
      defendFailures.set(vault, n);
      logger.error(
        { vault, icrBps: decision.icrBps, consecutiveFailures: n, err },
        `LIQUIDATION RISK: defend failed ${n}x — ICR ${(decision.icrBps / 100).toFixed(1)}%`,
      );
    } else {
      logger.error({ vault, action, err }, 'tx execution failed');
    }
  }

  recordAction(db, {
    vault,
    action: action as Action,
    reason,
    txHash,
    timestamp: Date.now(),
  });
}

// Stand in for protocol fees on testnet (mock savings vault): drip a small, timestamp-proportional
// amount of MUSD into the (mock) savings vault each window so sMUSD holders
// see a realistic ~APR. Off unless YIELD_ENABLED and the signer holds MUSD.
async function runYieldAccrual(deps: Deps): Promise<void> {
  const { config, clients, logger, db } = deps;
  if (!config.YIELD_ENABLED) return;
  if (!config.SAVINGS_VAULT_ADDRESS || !config.MUSD_ADDRESS) {
    logger.warn('YIELD_ENABLED but SAVINGS_VAULT_ADDRESS / MUSD_ADDRESS unset — skipping yield accrual');
    return;
  }

  const vault = config.SAVINGS_VAULT_ADDRESS;
  const musdAddress = config.MUSD_ADDRESS;
  const now = Date.now();
  const last = lastActionAt(db, vault, 'ACCRUE');

  // First run: record a baseline so dt is measured from agent start, not the
  // epoch (which would inject one enormous catch-up amount).
  if (last === null) {
    recordAction(db, { vault, action: 'ACCRUE', reason: 'baseline (agent start)', timestamp: now });
    return;
  }

  const elapsed = now - last;
  if (elapsed < config.YIELD_MIN_INTERVAL_MS) return;
  const dtMs = Math.min(elapsed, config.YIELD_MAX_CATCHUP_MS);

  try {
    const res = await executeAccrueYield(clients.publicClient, clients.walletClient, {
      savingsVault: vault,
      musd: musdAddress,
      aprBps: config.YIELD_APR_BPS,
      dtSeconds: dtMs / 1000,
    });
    const musd = (Number(res.amount) / 1e18).toFixed(6);
    if (res.skipped) {
      // Leave the last-accrual timestamp untouched so dt keeps accumulating.
      logger.info({ savingsVault: vault, amountMusd: musd }, `yield accrual skipped: ${res.skipped}`);
      return;
    }
    logger.info({ savingsVault: vault, amountMusd: musd, txHash: res.txHash }, 'yield accrued');
    recordAction(db, {
      vault,
      action: 'ACCRUE',
      reason: `+${musd} MUSD (~${(config.YIELD_APR_BPS / 100).toFixed(1)}% APR · ${(dtMs / 3_600_000).toFixed(1)}h)`,
      txHash: res.txHash,
      timestamp: now,
    });
  } catch (err) {
    logger.error({ savingsVault: vault, err }, 'yield accrual failed');
  }
}

const SAKU_MAX_PAYMENTS_PER_CYCLE = 6;

// The vault loop and the on-time Saku timer can both reach runSaku; run one at a
// time so two passes never race to release the same period.
let sakuLock: Promise<void> = Promise.resolve();
function runSaku(deps: Deps, price: bigint): Promise<void> {
  const next = sakuLock.then(() => runSakuOnce(deps, price));
  sakuLock = next.catch(() => undefined);
  return next;
}

// Cermin Saku: pay every due allowance the vault approves at the live price.
// Runs AFTER the vault loop, so a defend in the same cycle always comes first.
async function runSakuOnce(deps: Deps, price: bigint): Promise<void> {
  const { config, clients, logger, db, metrics } = deps;
  const saku = config.SAKU_ADDRESS;
  if (!saku) return;

  const due = await listDueSchedules(clients.publicClient, saku);
  if (due.length === 0) {
    logger.info('saku: no allowance due');
    return;
  }
  // One at a time: payments from the same vault must see each other's effect.
  for (const { schedule, due: n } of due) {
    const key = `saku:${schedule.id}`;
    const ctx = {
      schedule: schedule.id.toString(),
      label: decodeLabel(schedule.label),
      vault: schedule.vault,
      recipient: schedule.recipient,
      amountMusd: (Number(schedule.amount) / 1e18).toFixed(2),
      due: n,
    };
    try {
      // Catch up missed periods (keeper was down, or payments were held), but
      // re-check safety before every single payment and cap work per cycle.
      for (let k = 0; k < Math.min(n, SAKU_MAX_PAYMENTS_PER_CYCLE); k++) {
        const { status, icrBps } = await previewStatus(clients.publicClient, saku, schedule, price);
        const decision = decideSaku(status, lastActionAt(db, key, 'SAKU_HELD') ?? undefined, Date.now(), config.SAKU_HOLD_COOLDOWN_MS);
        logger.info({ ...ctx, status, icrBps: Number(icrBps), action: decision.action }, `saku: ${decision.reason}`);
        if (decision.action === 'WAIT') break;

        const res = await executeRelease(clients.publicClient, clients.walletClient, saku, schedule.id);
        metrics.txSubmitted += 1;
        const action = res.outcome === 'paid' ? 'SAKU_PAID' : 'SAKU_HELD';
        logger.info(
          { ...ctx, txHash: res.hash, outcome: res.outcome, confirmMs: res.confirmMs, via: res.via },
          `saku: allowance ${res.outcome}, receipt in ${res.confirmMs} ms (${res.via})`,
        );
        recordAction(db, {
          vault: key as `0x${string}`,
          action,
          reason: `${decision.reason} · receipt ${res.confirmMs} ms (${res.via})`,
          txHash: res.hash,
          timestamp: Date.now(),
        });
        if (res.outcome !== 'paid') break;
      }
    } catch (err) {
      metrics.txFailed += 1;
      metrics.lastError = err instanceof Error ? err.message : String(err);
      logger.error({ ...ctx, err }, 'saku: release failed');
    }
  }
}

// Read the keeper's gas balance and warn when it's running low. An empty signer
// makes every skim/defend revert — and a missed defend can let a vault liquidate.
async function checkKeeperGas(deps: Deps): Promise<void> {
  const { clients, config, logger, metrics } = deps;
  const keeper = clients.walletClient.account?.address;
  if (!keeper) return;
  metrics.keeper = keeper;
  const balance = await withRetry(() => clients.publicClient.getBalance({ address: keeper }));
  metrics.keeperBalanceWei = balance.toString();
  metrics.lowGas = balance < config.GAS_WARN_THRESHOLD_WEI;
  if (metrics.lowGas) {
    logger.warn(
      {
        keeper,
        balanceBtc: (Number(balance) / 1e18).toFixed(6),
        thresholdBtc: (Number(config.GAS_WARN_THRESHOLD_WEI) / 1e18).toFixed(6),
      },
      'keeper gas balance low — fund the signer or skim/defend will fail',
    );
  }
}

async function runCycle(deps: Deps, seq: number): Promise<void> {
  const { clients, config, logger, metrics } = deps;
  const start = Date.now();
  const active = () => seq === cycleSeq;
  if (active()) {
    metrics.running = true;
    metrics.lastCycleStart = start;
  }

  try {
    await checkKeeperGas(deps);

    const { price, vaults } = await fetchPriceAndVaults(clients.publicClient, config);
    const priceSane = price >= MIN_SANE_PRICE && price <= MAX_SANE_PRICE;
    if (!priceSane) {
      logger.warn(
        { price: price.toString() },
        'MON price feed out of sane band — pausing skim this cycle (defend still active)',
      );
    }
    logger.info({ monUsd: (Number(price) / 1e18).toFixed(5), vaults: vaults.length, priceSane }, 'cycle start');
    if (active()) metrics.vaultsSeen = vaults.length;

    await runYieldAccrual(deps);

    if (vaults.length === 0) {
      logger.info('no vaults yet, skipping');
    } else {
      const results = await mapWithLimit(vaults, VAULT_CONCURRENCY, vault =>
        processVault(deps, vault, price, priceSane),
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      logger.info(
        { durationMs: Date.now() - start, vaults: vaults.length, failed },
        'cycle complete',
      );
    }

    await runSaku(deps, price);

    if (active()) {
      metrics.cyclesRun += 1;
      metrics.lastSuccessAt = Date.now();
    }
  } catch (err) {
    if (active()) {
      metrics.cyclesFailed += 1;
      metrics.lastError = err instanceof Error ? err.message : String(err);
    }
    throw err;
  } finally {
    if (active()) {
      metrics.lastCycleEnd = Date.now();
      metrics.lastCycleMs = metrics.lastCycleEnd - start;
      metrics.running = false;
    }
  }
}

// Reject the cycle promise if it overruns, so a wedged RPC call can't pin the
// loop forever. The underlying work is abandoned; the next tick starts clean.
function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([p.finally(() => clearTimeout(timer)), timeout]);
}

async function main(): Promise<void> {
  const config = loadConfig();
  const isProd = process.env['NODE_ENV'] === 'production';
  const logger = pino({
    level: config.LOG_LEVEL,
    transport: isProd ? undefined : { target: 'pino-pretty', options: { colorize: true } },
  });
  const db = initDb(config.DB_PATH);
  const clients = createClients(config);
  const metrics = createMetrics();
  const deps: Deps = { config, clients, logger, db, metrics };

  const port = Number(process.env['PORT']) || config.HEALTH_PORT;
  const healthServer = startHealthServer(
    port,
    metrics,
    {
      cycleTimeoutMs: config.CYCLE_TIMEOUT_MS,
      maxSilenceMs: config.POLL_INTERVAL_MS * 2 + config.CYCLE_TIMEOUT_MS,
    },
    logger,
  );

  logger.info({ rpc: config.MONAD_RPC_URL, chainId: config.CHAIN_ID, intervalMs: config.POLL_INTERVAL_MS }, 'Cermin agent starting');

  let running = false;
  let stopped = false;

  const tick = async (): Promise<void> => {
    if (stopped || running) {
      if (running) logger.warn('previous cycle still running, skipping');
      return;
    }
    running = true;
    cycleSeq += 1;
    const seq = cycleSeq;
    try {
      await withTimeout(runCycle(deps, seq), config.CYCLE_TIMEOUT_MS, 'cycle exceeded CYCLE_TIMEOUT_MS');
    } catch (err) {
      logger.error({ err }, 'cycle error');
    } finally {
      running = false;
    }
  };

  await tick();
  const handle = setInterval(tick, config.POLL_INTERVAL_MS);

  // Saku on time: instead of waiting up to POLL_INTERVAL_MS for the next cycle,
  // sleep until the next allowance falls due (on the chain's clock) and release
  // it in the first blocks where it is payable. Defend stays on the main cycle.
  let sakuTimer: ReturnType<typeof setTimeout> | undefined;
  const sakuTick = async (): Promise<void> => {
    if (stopped || !config.SAKU_ADDRESS) return;
    let wait = config.SAKU_RECHECK_MS;
    try {
      const { price } = await fetchPriceAndVaults(clients.publicClient, config);
      await runSaku(deps, price);
      const [nextDue, block] = await Promise.all([
        earliestNextDue(clients.publicClient, config.SAKU_ADDRESS),
        withRetry(() => clients.publicClient.getBlock()),
      ]);
      const chainOffsetMs = Number(block.timestamp) * 1000 - Date.now();
      wait = msUntilNextSaku(nextDue, Date.now(), chainOffsetMs, {
        slackMs: config.SAKU_DUE_SLACK_MS,
        recheckMs: config.SAKU_RECHECK_MS,
        idleMs: config.POLL_INTERVAL_MS,
      });
      logger.debug({ nextDue: nextDue?.toString(), waitMs: wait }, 'saku: next check');
    } catch (err) {
      logger.error({ err }, 'saku timer error');
    }
    if (!stopped) sakuTimer = setTimeout(() => void sakuTick(), wait);
  };
  if (config.SAKU_ON_TIME) void sakuTick();

  const shutdown = (signal: string): void => {
    if (stopped) return;
    stopped = true;
    logger.info({ signal }, 'shutting down');
    clearInterval(handle);
    if (sakuTimer) clearTimeout(sakuTimer);
    healthServer.close();
    db.close();
    // Give in-flight tx a brief grace period before exit.
    setTimeout(() => process.exit(0), running ? 5_000 : 0).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
