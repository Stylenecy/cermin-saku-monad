# Cermin Contracts

> **Monad:** this repository now deploys to Monad testnet with `bash scripts/deploy-monad.sh` (rehearse first with `bash scripts/rehearse-fork.sh`). The BNB Chain instructions below are from the Cermin port and the BNB version of Cermin Saku; the variable names still apply except the RPC (`MONAD_RPC`).

Two-contract Foundry workspace for the Cermin lean architecture.

| Contract | Role |
|----------|------|
| `CerminVault` | Per-user proxy that wraps a single CDP trove (Liquity/Mezo-style interface) + sMUSD position. Cloned via EIP-1167. |
| `CerminFactory` | Deploys one vault per address; tracks `vaultOf[user]`. |

CDP addresses (BorrowerOperations / TroveManager / PriceFeed / MUSD / SavingsVault) are baked into the vault implementation as `immutable`, so every clone reads them from the impl bytecode.

## Common commands

```shell
# build
forge build

# run all tests (unit + integration)
forge test -vvv

# coverage
forge coverage

# format
forge fmt

# deploy to BSC testnet (see "Deploy" section below for env setup)
forge script script/Deploy.s.sol:Deploy \
  --rpc-url bsc_testnet \
  --private-key $PRIVATE_KEY \
  --broadcast
```

## Deploy to BNB Chain (BSC testnet)

Mezo's CDP stack does not exist on BNB Chain, so `Deploy.s.sol` deploys the
Liquity-style mock stack from `test/mocks` (MockMUSD, MockTroveManager,
MockBorrowerOperations, MockSavingsVault) plus a price feed (Chainlink
BNB/USD adapter if `CHAINLINK_BNB_USD_FEED` is set, otherwise an
owner-settable `MockPriceFeed`). Collateral is native tBNB. Point the
`CDP_*` env vars at a real Liquity-compatible deployment to skip the mocks.

```shell
cp .env.example .env && $EDITOR .env
set -a; source .env; set +a

# Dry-run (simulation only)
forge script script/Deploy.s.sol:Deploy --rpc-url bsc_testnet

# Broadcast + verify on BscScan
forge script script/Deploy.s.sol:Deploy \
  --rpc-url bsc_testnet \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify --etherscan-api-key $BSCSCAN_API_KEY
```

The script logs `CERMIN_FACTORY_ADDRESS`, `PRICE_FEED_ADDRESS`,
`MUSD_ADDRESS` and `SAVINGS_VAULT_ADDRESS` — copy them into the agent and
frontend env files.

Faucet for tBNB: https://www.bnbchain.org/en/testnet-faucet
Block explorer: https://testnet.bscscan.com

## Notes

- `via_ir = true` is enabled in `foundry.toml` to compile the vault under stack-deep inlining.
- The implementation contract calls `_initialized = true` in its constructor — only clones can be initialized.
- `defend()` is permissionless. Anyone can trigger it when ICR drops below `defendICR`.
- See the root `README.md` and `src/CerminVault.sol` for the full spec and validation rules.
