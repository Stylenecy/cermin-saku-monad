# Cermin Keeper Agent

A deterministic ~200-LOC service that keeps every Cermin vault healthy. No LLM,
no indexer. Each cycle it:

1. Reads the MON/USD price (`PriceFeed.fetchPrice`) and lists vaults (`factory.allVaults`).
2. Snapshots each vault and decides — purely from on-chain params:
   - `ICR < defendICR` → `vault.defend()` (repay debt from the vault's own Shadow)
   - else MON moved past `skimThresholdBps` since `lastSkimPrice` → `vault.skim()`
   - else `HOLD`
3. Logs one decision per vault to SQLite.

Calls are simulated first, so a doomed `skim`/`defend` never spends gas.

## Environment

| Var | Example | Notes |
|-----|---------|-------|
| `CHAIN_ID` | `10143` | Monad: `10143` testnet (default), `143` mainnet, `31337` Anvil |
| `MONAD_RPC_URL` | `https://testnet-rpc.monad.xyz` | Monad RPC (supports `eth_sendRawTransactionSync`) |
| `SAKU_ON_TIME` | `true` | wake when the next allowance falls due (chain clock) instead of on the poll interval |
| `SAKU_DUE_SLACK_MS` / `SAKU_RECHECK_MS` | `600` / `15000` | release this long after the due time / re-check a held payment this often |
| `PRIVATE_KEY` | `0x…` (64 hex) | **Keeper signer.** Funds gas + triggers tx. Never commit. |
| `CERMIN_FACTORY_ADDRESS` | `0x…` | From `contracts/script/Deploy.s.sol` output |
| `PRICE_FEED_ADDRESS` | `0x…` | Price feed from deploy output (mock or Chainlink adapter) |
| `SORTED_TROVES_ADDRESS` | `0x…` | Optional; unused while hints are `0x0` (MVP) |
| `POLL_INTERVAL_MS` | `600000` | Cycle interval (10 min) |
| `DB_PATH` | `/data/cermin.db` | Action-log SQLite (Docker sets this) |
| `LOG_LEVEL` | `info` | `debug`/`info`/`warn`/`error` |
| `GAS_WARN_THRESHOLD_WEI` | `1000000000000000` | Warn below this signer balance (0.001 BNB) |
| `HEALTH_PORT` / `PORT` | `8080` | Liveness server; Railway injects `PORT` and probes `/health` |
| `CYCLE_TIMEOUT_MS` | `300000` | Watchdog: a cycle over this is reported unhealthy |

The keeper key only signs the permissionless `skim`/`defend` — it can't move
funds anywhere except per the vault's own logic. Fund it with a little testnet
MON for gas: <https://faucet.monad.xyz>.

## Run locally

```bash
cp .env.example .env   # fill PRIVATE_KEY + addresses
npm install
npm run dev            # tsx watch, one cycle then every POLL_INTERVAL_MS
```

## Deploy on Railway (always-on daemon)

1. **New Project → Deploy from GitHub repo** → pick this repo.
2. **Settings → Root Directory = `agent`** (monorepo). Railway uses `agent/Dockerfile`.
3. **Variables** — add every row from the table above. Paste `PRIVATE_KEY`
   from your local `agent/.env` (do **not** commit it).
4. *(Optional)* **Add a Volume** mounted at `/data` so the action log survives
   redeploys. Skipping it is fine — the agent reads vault state fresh each cycle.
5. **Deploy.** Watch the logs for `cycle complete`. Restart policy is
   `ON_FAILURE` (see `railway.json`).

Build/run: the multi-stage Dockerfile compiles in a `builder` stage (with the
toolchain `better-sqlite3` needs), prunes devDeps, and copies only `dist/` +
production `node_modules` into a slim `runner` stage that runs `node dist/index.js`.

## Health & ops

- **Liveness:** `GET /health` returns `200` with a JSON metrics snapshot
  (cycles run/failed, tx submitted/failed, keeper balance, last success) and
  `503` when a cycle has hung past `CYCLE_TIMEOUT_MS` or no cycle has succeeded
  for too long. Railway probes it automatically (`healthcheckPath` in
  `railway.json`).
- **Gas:** the keeper warns each cycle when its MON balance falls below
  `GAS_WARN_THRESHOLD_WEI`. A failed `defend` logs a `LIQUIDATION RISK` line with
  a consecutive-failure count.
- **Nonce safety:** all on-chain writes funnel through a serial queue and await
  their receipt, so concurrent per-vault processing never collides nonces.

## Test

```bash
npm test     # node:test unit tests for the decide() policy
npm run lint # tsc --noEmit
```
