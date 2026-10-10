#!/usr/bin/env bash
# Cermin Saku — one-shot Monad testnet deployment + demo setup.
#   bash scripts/deploy-monad.sh            (from the repo root)
# Reads keys from ./wallets.env (gitignored). Never prints a key: keys are only
# passed through environment variables, never on a command line or to stdout.
#
# Sizes follow the deployer's balance, because testnet MON comes from faucets
# in small amounts: ~1.2 MON of gas for the deploy, KEEPER_MON for the keeper,
# GAS_RESERVE_MON kept back for the demo transactions, the rest into the demo vault.
set -euo pipefail
cd "$(dirname "$0")/.."

RPC="${MONAD_RPC:-https://testnet-rpc.monad.xyz}"
OUT="${DEPLOY_OUT_NAME:-deployments/monad-testnet.json}"
CHAIN="${CHAIN_ID_OVERRIDE:-10143}"
PYTH_MON_USD="31491744e2dbf6df7fcf4ac0820d18a609b49076d45066d3568424e62f686cd1"

set -a; . ./wallets.env; set +a
: "${DEPLOYER_PRIVATE_KEY:?}" "${KEEPER_ADDRESS:?}" "${CHILD_ADDRESS:?}" "${DEPLOYER_ADDRESS:?}"

wei2mon() { python -c "print(f'{int($1)/1e18:.4f}')"; }
echo "== deployer $DEPLOYER_ADDRESS"
bal=$(cast balance "$DEPLOYER_ADDRESS" --rpc-url "$RPC")
echo "   balance $(wei2mon "$bal") MON"
MIN_WEI="${MIN_DEPLOYER_WEI:-3500000000000000000}"   # 3.5 MON
if [ ! -f "contracts/$OUT" ] && ! python -c "import sys; sys.exit(0 if int('$bal') >= int('$MIN_WEI') else 1)"; then
  echo "!! deployer needs >= $(wei2mon "$MIN_WEI") MON (faucet: https://faucet.monad.xyz)"; exit 2
fi

# Seed the simulated feed with today's Pyth MON/USD (price * 10^expo -> 1e18).
price=$(curl -s "https://hermes.pyth.network/v2/updates/price/latest?ids[]=$PYTH_MON_USD" \
  | python -c "import sys,json; p=json.load(sys.stdin)['parsed'][0]['price']; print(int(int(p['price'])*10**(18+int(p['expo']))))" 2>/dev/null || true)
if [ -z "$price" ]; then price="${FALLBACK_MON_USD_WEI:-24430000000000000}"; echo "   (Pyth not readable, using fallback)"; fi
echo "== Pyth MON/USD: $(python -c "print(int('$price')/1e18)") -> MockPriceFeed seed"

if [ ! -f "contracts/$OUT" ]; then
  # Monad charges the gas limit, so pad forge's estimates by 10% instead of 30%.
  (cd contracts && PRIVATE_KEY="$DEPLOYER_PRIVATE_KEY" MOCK_BNB_PRICE="$price" \
    MIN_DEBT="${MIN_DEBT:-10000000000000000}" GAS_COMP="${GAS_COMP:-1000000000000000}" DEPLOY_OUT="./$OUT" \
    forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC" --broadcast --slow --gas-estimate-multiplier 110 2>&1 \
    | grep -E "Cermin|PriceFeed|MUSD|Wrote|ONCHAIN|Error|error" )
else
  echo "== $OUT exists, skipping deploy"
fi
cat "contracts/$OUT"

echo "== Sourcify"
if [ -z "${SKIP_SOURCIFY:-}" ]; then (cd contracts && node script/verify-sourcify.mjs "$OUT") || echo "   (sourcify step failed; retry later)"; fi

export DEPLOYMENT="../contracts/$OUT" RPC_URL="$RPC" CHAIN_ID="$CHAIN" \
  PARENT_PRIVATE_KEY="$DEPLOYER_PRIVATE_KEY" PRICE_OWNER_PRIVATE_KEY="$DEPLOYER_PRIVATE_KEY"
cd agent

echo "== fund keeper (${KEEPER_MON:-0.6} MON)"
kb=$(cast balance "$KEEPER_ADDRESS" --rpc-url "$RPC")
if [ "$kb" = "0" ]; then npx tsx scripts/demo.ts fund --to "$KEEPER_ADDRESS" --mon "${KEEPER_MON:-0.6}"; fi

echo "== demo vault + allowance"
if ! npx tsx scripts/demo.ts status >/dev/null 2>&1; then
  bal=$(cast balance "$DEPLOYER_ADDRESS" --rpc-url "$RPC")
  demo_mon="${DEMO_MON:-$(python -c "print(f'{max(int($bal)/1e18 - float('${GAS_RESERVE_MON:-0.8}'), 0):.3f}')")}"
  echo "   vault collateral $demo_mon MON"
  npx tsx scripts/demo.ts open --mon "$demo_mon"
  # Balanced: borrow 50% of the collateral value, half of it spendable. Grant all
  # of the spendable; pay it as 12 envelopes of ~1/16 each, one a minute.
  spend=$(python -c "print(float('$demo_mon') * int('$price')/1e18 * 0.5 * 0.5)")
  per=$(python -c "print(f'{$spend/16:.6f}')")
  npx tsx scripts/demo.ts grant --musd "$(python -c "print(f'{$spend:.6f}')")"
  npx tsx scripts/demo.ts schedule --to "$CHILD_ADDRESS" --musd "${DEMO_MUSD:-$per}" --period "${DEMO_PERIOD:-60}" --count "${DEMO_COUNT:-12}" --start-in "${DEMO_START_IN:-180}" --label "Uang saku Rara"
fi
npx tsx scripts/demo.ts status

echo "== wire web app + keeper + README"
cd ..
node scripts/post-deploy.mjs "$OUT" ${REHEARSAL:+--local} ${SITE_URL:+--site "$SITE_URL"} ${VIDEO_URL:+--video "$VIDEO_URL"}
