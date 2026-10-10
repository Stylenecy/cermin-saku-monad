# Cermin Saku — threat model and known limits

Scope: `CerminSaku`, the Saku gates in `CerminVault` v1.1, `CerminLens`, and the keeper's allowance payer, as deployed
on Monad testnet (chain 10143). The underlying Cermin vault engine and the mock CDP are upstream (MIT). Not audited.

| Risk | What can happen | What the code does today | What production needs |
|---|---|---|---|
| **Bad or stale price** | A wrong price could let a payment through or hold it needlessly | On testnet the feed is a `MockPriceFeed` the deployer sets (seeded from Pyth MON/USD) so a crash can be demonstrated. `release()` reads the price, and the vault reads it again inside `withdrawSpendableFor` before moving money | A production oracle (e.g. Pyth or Chainlink on Monad) with staleness and deviation checks, and a defined behaviour when it is unavailable (hold, never pay) |
| **Spam on `release()`** | `release()` is permissionless, so anyone can call it while a payment is held | A held call moves no money; it costs the caller gas and emits `AllowanceHeld`. The keeper waits between retries of a held schedule (`SAKU_HOLD_COOLDOWN_MS`) | An on-chain retry interval per schedule or emitting a hold only when the reason changes, to keep event logs clean |
| **Keeper down** | Payments stop being released automatically; defense does not run | Correctness does not depend on the keeper: anyone can call `release()`, and the vault re-checks. Defense (`defend()`) does depend on someone running it | Several independent keepers or an automation network, with an incentive for whoever executes |
| **Crash larger than the reserve** | A fall beyond the stress assumption, or faster than the keeper reacts, can still reach liquidation on a real CDP | Gate 2 keeps enough for `defend()` to bring ICR back to `defendICR` (140%) after a further 30% fall (default; the owner can tune 10–70% with `setSakuPolicy` but cannot switch it off). Below the 120% emergency line `defend()` aims for 160% and spends everything available, so it may stop short of 160% but not below 140%; fuzzed in `test/saku/SakuStress.t.sol` | Stress values from real volatility data; share one helper for the defense target between `defend()` and the gate |
| **Interest while payments are held** | On a real lending backend, debt grows while allowances are paused | The mock CDP charges no interest, so the demo does not show this cost; Lens does not model interest yet | Model interest in Lens and in the gates' reserve calculation |
| **Stablecoin and off-ramp** | The recipient holds a stablecoin; it can depeg, and it is not Rupiah | MUSD is a test token. Rupiah amounts are display only (indicative rate) | A chosen production stablecoin, and Rupiah delivery only through a licensed partner |
| **Over-spending** | A schedule pays more than the owner allowed | The vault only lets CerminSaku spend within the owner's spend allowance; invariant tests check paid ≤ granted and allowance accounting | Same, plus an external audit |
| **Keeper workload** | Schedules are cheap to create; the keeper reads every schedule each cycle, so a flood of schedules slows it down | Off-chain only: no funds at risk, and anyone can still call `release()` | Index `ScheduleCreated` events, process a bounded batch per cycle, keep the defense loop separate |
| **Shared balance** | Two schedules from one vault compete for the same spendable balance and the same Saku allowance; a schedule does not reserve funds | By design in this version: the first due schedule released is paid first; the UI shows total vs spendable | Per-schedule earmarks or an explicit priority order |
| **Amount denomination** | The parent types Rupiah, but the contract stores a fixed MUSD amount, so the Rupiah value moves with the USD/IDR rate | The schedule form says the amount is stored in MUSD and its Rupiah value follows the rate | A choice between fixed-stablecoin and fixed-Rupiah delivery through a licensed partner |
| **Policy changes** | The owner can change the Saku policy within its bounds after schedules exist | Changes apply to future releases; bounds keep a minimum (5-point buffer, 10% stress) | A delay before a looser policy takes effect, or a policy snapshot per schedule |
| **Front-running `release()`** | Someone could call `release()` at a moment of their choosing | The recipient and amount are fixed in the schedule and the vault re-checks at the current price, so a caller can change timing, not who is paid or how much | Same, plus a production oracle |
| **Upgrades and admin keys** | An admin could change behaviour after deposit | Vaults are EIP-1167 clones of a fixed implementation; CerminSaku has no admin. Testnet-only mocks (price feed, CDP gas compensation) have an owner | No owner-controlled price or CDP parameters on mainnet |

What the tests prove: 7 invariants (64 runs × 64 random calls each) and fuzz tests show the gates and accounting hold
**given the price the feed returns and the mock CDP's behaviour**. They do not prove behaviour on a real CDP or under
oracle failure.

## Monad-specific notes (10–12 Oct 2026)

| Risk | What can happen | What the code does today | What production needs |
|---|---|---|---|
| **Passbook storage grows** | Every `release()` adds two storage slots, so a spammed held schedule grows its passbook | Holds only happen when a period is due and unsafe; the keeper records a hold at most once per cooldown. Anyone else spamming `release()` pays the gas for each line. Reads are paged (`passbook(id, offset, limit)`) | A per-schedule minimum interval between hold lines, or only recording a hold when its reason changes |
| **Punctuality depends on one keeper** | If the keeper is down, envelopes are paid late (never unsafely) | The passbook records due time and paid time, so lateness is visible, not hidden | Several keepers or an automation network; the passbook already measures how well they do |
| **Sync send times out** | `eth_sendRawTransactionSync` can return a timeout after the node accepted the transaction | The keeper then looks the receipt up by hash instead of re-sending; any other error is surfaced, not retried blindly | — |
| **Clock skew** | The keeper's local clock can drift from block time | The keeper wakes on the chain's clock (latest block timestamp minus local time), plus a small slack | — |

