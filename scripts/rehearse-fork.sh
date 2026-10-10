#!/usr/bin/env bash
# Dress rehearsal of scripts/deploy-monad.sh on a local fork of Monad testnet (chain 10143), no MON needed.
#   bash scripts/rehearse-fork.sh            (from the repo root; needs anvil on PATH)
# Same keys, same script, same Pyth seed as the real run. Output goes to
# contracts/deployments/anvil-fork10143.json and frontend/.env.local (both gitignored).
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${FORK_PORT:-8546}"
UPSTREAM="${MONAD_RPC_UPSTREAM:-https://testnet-rpc.monad.xyz}"
set -a; . ./wallets.env; set +a

if ! cast chain-id --rpc-url "http://127.0.0.1:$PORT" >/dev/null 2>&1; then
  echo "== starting anvil fork of Monad testnet on :$PORT"
  anvil --fork-url "$UPSTREAM" --port "$PORT" --block-time 1 --silent > /dev/null 2>&1 &
  until cast chain-id --rpc-url "http://127.0.0.1:$PORT" >/dev/null 2>&1; do sleep 1; done
fi
RPC="http://127.0.0.1:$PORT"
echo "== fork chain id $(cast chain-id --rpc-url "$RPC"), block $(cast block-number --rpc-url "$RPC")"
cast rpc anvil_setBalance "$DEPLOYER_ADDRESS" 0x6124FEE993BC0000 --rpc-url "$RPC" >/dev/null   # 7 MON

rm -f contracts/deployments/anvil-fork10143.json
MONAD_RPC="$RPC" DEPLOY_OUT_NAME=deployments/anvil-fork10143.json SKIP_SOURCIFY=1 REHEARSAL=1 \
  bash scripts/deploy-monad.sh
echo "== rehearsal done. Keeper: cd agent && npm run keeper · web: cd frontend && npm run dev"
