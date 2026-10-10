# Local rehearsal (Anvil)

> Historical: this rehearsal ran on 5 Oct 2026 for the BNB Chain version (prices in BNB). For Monad, `bash scripts/rehearse-fork.sh` runs the same deploy on a local fork of Monad testnet.

The whole Cermin Saku loop on a local chain, with the real contracts and the real keeper. Run on 5 Oct 2026
(numbers below are from that run; Anvil dev accounts, simulated price seeded at the Chainlink BNB/USD testnet
value of that morning, $792.56).

```bash
anvil --block-time 1                                   # terminal 1

cd contracts                                           # terminal 2
PRIVATE_KEY=<anvil key 0> MOCK_BNB_PRICE=792560000000000000000 \
MIN_DEBT=20000000000000000000 GAS_COMP=2000000000000000000 \
DEPLOY_OUT=./deployments/anvil.json \
forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 --broadcast

cd ../agent
export DEPLOYMENT=../contracts/deployments/anvil.json RPC_URL=http://127.0.0.1:8545 CHAIN_ID=31337 \
       PARENT_PRIVATE_KEY=<anvil key 0> PRICE_OWNER_PRIVATE_KEY=<anvil key 0>
npx tsx scripts/demo.ts open --bnb 0.1
npx tsx scripts/demo.ts grant --musd 20
npx tsx scripts/demo.ts schedule --to <child address> --musd 1.5 --period 60 --count 12 --label "Uang saku Rara"

# terminal 3: the keeper (skim/defend + Saku)
PRIVATE_KEY=<anvil key 1> CHAIN_ID=31337 BSC_RPC_URL=http://127.0.0.1:8545 \
CERMIN_FACTORY_ADDRESS=… PRICE_FEED_ADDRESS=… SAKU_ADDRESS=… \
POLL_INTERVAL_MS=15000 SAKU_HOLD_COOLDOWN_MS=60000 npx tsx src/index.ts

npx tsx scripts/demo.ts price --usd 560   # ICR 141% < 150% Saku floor
npx tsx scripts/demo.ts price --usd 520   # ICR 131% < 140% defend line
npx tsx scripts/demo.ts price --usd 800   # recovery
npx tsx scripts/demo.ts status
```

## What happened

| Step | Chain state | Saku |
|---|---|---|
| open 0.1 BNB @ $792.56, Balanced | debt 39.63 MUSD, ICR 200%, spendable 19.81, savings 19.81 | — |
| grant 20 MUSD, schedule 1.5 MUSD / 60 s × 12 | lines: liquidation $435.91 · defend $554.79 · **Saku pause $594.42** · skim $832.19 | keeper paid #1 and #2 |
| price → $560 | ICR 141.31% | `AllowanceHeld(reason = 3 IcrBelowFloor, icr 14131, price 560e18)`; no MUSD moved |
| price → $520 | keeper `defend()`: debt 39.63 → 37.14, savings 19.81 → 17.33, ICR back to 140.0% | still held; dues accumulate (`dueCount` 3) |
| price → $800 | ICR 215.4% | keeper paid the owed envelopes; finally `paid 12/12`, child balance **18 MUSD** |

The BNB collateral stayed 0.1 BNB throughout.
