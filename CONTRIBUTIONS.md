# Contributions

This repository starts from **Cermin** by Yeheskiel Yunus Tame, MIT
([original](https://github.com/yeheskieltame/Cermin), Mezo Hackathon 2, May 2026; BNB Chain port by its author, late September 2026).
Commit [`e767fde`](https://github.com/Stylenecy/cermin-saku-monad/commit/e767fde) is the original published code, unchanged
(source: `bcc-ukdw/seed-bnb` at `52671ce`, folder `Cermin/`; the Mezo pitch deck, Mezo logo files, a blog copy and
three Mezo-era screenshots were left out of the import).

Everything below was built by **Dex Bennett** inside the Monad Metropolis build window (1 Sep – 13 Oct 2026), in two steps:

1. **5–7 October 2026: Cermin Saku on BNB Chain**, submitted to the Indonesia Web3 Hackathon 2026 (that version stays at
   [Stylenecy/cermin-saku](https://github.com/Stylenecy/cermin-saku)). Tables "What is new" and the commit log up to `ac9fba6`.
2. **10–12 October 2026: Cermin Saku on Monad**, this repository. Section "Monad port" below.
To see exactly what changed in the original files: `git diff e767fde -- contracts/src agent/src frontend/src`.

## What is new (5–7 Oct, BNB Chain version)

| Area | New | Changed from Cermin |
|---|---|---|
| Contracts | `CerminSaku.sol` (schedules, permissionless `release`, holds), `CerminLens.sol` (price lines, previews) | `CerminVault.sol` v1.1: spend allowance for a delegated spender, the two Saku safety gates (`_sakuStatus`), Saku policy, min debt / gas compensation as deploy-time immutables. `ICerminVault.sol` extended. Mocks: admin functions made owner-only; gas compensation configurable. `Deploy.s.sol` rewritten for the full stack + JSON manifest |
| Tests | `test/saku/`: 28 Saku unit + fuzz, 2 crash-reserve stress tests (`SakuStress.t.sol`), 7 Lens (preview equals execution, exact pause-price boundary), 8 in the invariant suite: 7 invariants (paid ≤ granted, allowance accounting, no unsafe payment, ledger = balances, BNB never decreases, spendable backed, periods bounded) + 1 positive control | The original 33 tests kept; only `setUp` adapted to the new constructors (logic untouched) |
| Keeper | `monitors/saku.ts`, `executors/release.ts`, `scripts/demo.ts`, `abis/generated.ts`, 6 node:test cases | `index.ts` runs Saku after skim/defend; `config.ts` (SAKU_ADDRESS, hold cooldown, chain 31337); `chain.ts` (Anvil) |
| Web | `/demo` (no-wallet demo vault), `/saku` (schedule envelopes), `/terima` (recipient view), Lens panel, on-chain passbook, Google / email sign-in (Privy, wallet created on login), ID/EN switch, Rupiah display with a labelled indicative rate, landing copy and sections rewritten for Cermin Saku (calculator, gate visual), wallet balance checks in onboarding | Cermin's own design system kept (Fraunces + Geist, paper, components, watercolour illustrations) and recoloured to blue, green and brown (`scripts/recolor-art.py`); Cermin's dashboard and onboarding translated and extended |
| Ops | GitHub Actions CI, local Anvil rehearsal, fork rehearsal, one-command deploy + wiring (`scripts/`), BSC testnet deployment from Dex's own fresh deployer, on-chain demo run (`docs/TESTNET-DEPLOY.md`), passbook export (`agent/scripts/ledger.ts`) | The original port notes moved to `docs/upstream-*` |

## Monad port (10–12 Oct)

| Area | New | Changed |
|---|---|---|
| Contracts | Passbook in `CerminSaku` state: `Entry` (paid/held, due time, paid time, ICR, amount, price), `passbookLength`, `passbook(id, offset, limit)`; `test/saku/SakuPassbook.t.sol` (7 tests incl. a fuzz) | `release()` writes one passbook line per call; events unchanged |
| Keeper | On-time mode (`earliestNextDue`, `msUntilNextSaku`, wake on the chain clock), `eth_sendRawTransactionSync` with measured receipt time and send + poll fallback, 3 timing tests | Monad chains (`chain.ts`), `MONAD_RPC_URL`, MON price sanity band, one Saku pass at a time |
| Web | `useConfirmTimer` + `ConfirmedIn` (measured confirmation badge), `OnTimeCard` (punctuality from the passbook), one-minute envelope preset, "Why Monad?" FAQ, new link preview image | Monad chains, 150 ms receipt polling, passbook read from state, activity feed in 100-block windows, MON copy and example amounts |
| Ops | `scripts/deploy-monad.sh` (Pyth MON/USD seed, sizes from balance, 10% gas padding), `rehearse-fork.sh` on a Monad fork, `docs/MONAD-DEPLOY.md` | `post-deploy.mjs` for Monad; BSC deploy script removed (history in git) |

## Commit log (newest last)

<!-- COMMITS:START -->
| Commit | Date (WIB) | What |
|---|---|---|
| `e767fde` | 5 Oct 03:54 | Import Cermin, unchanged |
| `c913c57` | 5 Oct 04:14 | feat(contracts): Cermin Saku — safety-gated scheduled al... |
| `a40687f` | 5 Oct 04:46 | feat(keeper): pay due Saku allowances, record holds on-c... |
| `8c15ca2` | 5 Oct 04:46 | docs+ci: proof-first README, provenance, CI, local rehea... |
| `d7b0d29` | 5 Oct 04:58 | chore: one-shot testnet deploy, Sourcify verify, CI on N... |
| `330b173` | 6 Oct 12:25 | feat(web): Bahasa Indonesia + Rupiah interface, Saku pages |
| `cca3be4` | 6 Oct 12:25 | chore(scripts): one-command deploy wiring and fork rehea... |
| `d1ea739` | 6 Oct 12:25 | chore: keep LF endings for shell scripts |
| `d2a3813` | 6 Oct 12:53 | fix(web): passbook stays fast weeks after deploy; cleare... |
| `af56f63` | 6 Oct 12:57 | fix(web): one DITAHAN stamp across the held run in the h... |
| `198f6f1` | 6 Oct 13:02 | chore: deploy Cermin Saku to BSC testnet |
| `16f6605` | 6 Oct 13:19 | docs: on-chain demo run on BSC testnet; ledger export sc... |
| `09a2566` | 6 Oct 13:19 | docs(readme): link the on-chain demo run |
| `a883420` | 6 Oct 13:26 | docs(readme): say 7 invariants + 1 positive control |
| `bd7fea8` | 6 Oct 13:52 | docs: full dated commit log, precise wording on who buil... |
| `41e3fda` | 6 Oct 13:59 | fix(web): fonts load everywhere, passbook-ink connect bu... |
| `d413e7b` | 6 Oct 14:07 | fix(web): Lens tests the last envelope once every schedu... |
| `60c1a9d` | 6 Oct 14:26 | docs: link the live app (cermin-saku.vercel.app) and its... |
| `11936a5` | 6 Oct 19:15 | feat(web): back to Cermin's own design, in Cermin Saku's... |
| `2d62120` | 6 Oct 19:40 | feat(web): the app behind "Launch app" in Cermin's style... |
| `cbb3171` | 6 Oct 21:29 | feat(web): sign in with Google or email through Privy, w... |
| `f33ff29` | 6 Oct 21:39 | feat(web): turn on Privy sign-in (public app id) |
| `fcf7ebe` | 6 Oct 22:02 | copy(web): sign in with Google or a wallet, not only con... |
| `ceb9f13` | 6 Oct 22:28 | docs: point the judge path at /demo (the old /bukti stil... |
| `3b6662d` | 7 Oct 04:26 | docs: Google / email sign-in through Privy in the README... |
| `5b9c0c2` | 7 Oct 16:16 | docs: link the demo video |
<!-- COMMITS:END -->
