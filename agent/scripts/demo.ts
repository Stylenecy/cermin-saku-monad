/**
 * Cermin Saku demo CLI — drives the parent side of the story on Anvil or Monad
 * testnet. The keeper (src/index.ts) does the rest on its own.
 *
 *   npx tsx scripts/demo.ts <command> [--flags]
 *
 *   open      --mon 10 [--preset balanced]        parent opens a vault
 *   grant     --musd 20                            allow Saku to spend up to N MUSD
 *   schedule  --to 0x.. --musd 1.5 --period 600 --count 12 [--label "Uang saku Rara"]
 *   price     --usd 0.02                           move the SIMULATED price (MockPriceFeed owner)
 *   status                                         print vault, lines and schedules
 *
 * Env: DEPLOYMENT (path to the deploy JSON), RPC_URL, CHAIN_ID,
 *      PARENT_PRIVATE_KEY (vault owner), PRICE_OWNER_PRIVATE_KEY (MockPriceFeed owner).
 * Keys are read from env only and never printed.
 */
import { readFileSync } from 'node:fs';
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  parseEther,
  stringToHex,
  zeroAddress,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getChain } from '../src/chain.js';
import { CERMIN_FACTORY_ABI } from '../src/abis/CerminFactory.js';
import {
  CERMIN_LENS_ABI,
  CERMIN_SAKU_ABI,
  CERMIN_VAULT_V11_ABI,
  MOCK_PRICE_FEED_ABI,
} from '../src/abis/generated.js';
import { decodeLabel, SAKU_STATUS } from '../src/monitors/saku.js';

interface Deployment {
  chainId: number;
  CerminFactory: Hex;
  CerminSaku: Hex;
  CerminLens: Hex;
  PriceFeed: Hex;
  MUSD: Hex;
}

const PRESETS = {
  conservative: { targetLTV: 4000, defendICR: 17000, emergencyICR: 14000, skimThresholdBps: 800, spendableShare: 3000 },
  balanced: { targetLTV: 5000, defendICR: 14000, emergencyICR: 12000, skimThresholdBps: 500, spendableShare: 5000 },
  aggressive: { targetLTV: 7000, defendICR: 12500, emergencyICR: 11800, skimThresholdBps: 300, spendableShare: 7000 },
} as const;

function flag(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i > -1 && process.argv[i + 1] !== undefined) return process.argv[i + 1]!;
  if (fallback !== undefined) return fallback;
  throw new Error(`missing --${name}`);
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

const dep = JSON.parse(readFileSync(env('DEPLOYMENT'), 'utf8')) as Deployment;
const chain = getChain(Number(process.env['CHAIN_ID'] ?? dep.chainId));
const transport = http(env('RPC_URL'));
const pub = createPublicClient({ chain, transport });

function wallet(keyEnv: string) {
  const account = privateKeyToAccount(env(keyEnv) as Hex);
  return { account, client: createWalletClient({ account, chain, transport }) };
}

async function send(label: string, fn: () => Promise<Hex>): Promise<Hex> {
  const hash = await fn();
  const r = await pub.waitForTransactionReceipt({ hash });
  console.log(`${label}: ${r.status} · tx ${hash} · block ${r.blockNumber}`);
  if (r.status !== 'success') process.exit(1);
  return hash;
}

async function vaultOf(owner: Hex): Promise<Hex> {
  const v = await pub.readContract({ address: dep.CerminFactory, abi: CERMIN_FACTORY_ABI, functionName: 'vaultOf', args: [owner] });
  if (v === zeroAddress) throw new Error(`no vault for ${owner}; run "open" first`);
  return v as Hex;
}

const usd = (x: bigint) => Number(formatEther(x)).toLocaleString('en-US', { maximumSignificantDigits: 6 });

async function main() {
  const cmd = process.argv[2];
  if (cmd === 'open') {
    const { account, client } = wallet('PARENT_PRIVATE_KEY');
    const preset = PRESETS[flag('preset', 'balanced') as keyof typeof PRESETS];
    await send('open vault', () =>
      client.writeContract({
        address: dep.CerminFactory,
        abi: CERMIN_FACTORY_ABI,
        functionName: 'createVault',
        args: [preset, 0n, zeroAddress, zeroAddress],
        value: parseEther(flag('mon')),
        chain,
        account,
      }),
    );
    console.log('vault:', await vaultOf(account.address));
  } else if (cmd === 'grant') {
    const { account, client } = wallet('PARENT_PRIVATE_KEY');
    const vault = await vaultOf(account.address);
    await send('grant allowance', () =>
      client.writeContract({
        address: vault,
        abi: CERMIN_VAULT_V11_ABI,
        functionName: 'setSpendAllowance',
        args: [dep.CerminSaku, parseEther(flag('musd'))],
        chain,
        account,
      }),
    );
  } else if (cmd === 'schedule') {
    const { account, client } = wallet('PARENT_PRIVATE_KEY');
    const label = flag('label', 'Uang saku');
    await send('create schedule', () =>
      client.writeContract({
        address: dep.CerminSaku,
        abi: CERMIN_SAKU_ABI,
        functionName: 'createSchedule',
        args: [
          flag('to') as Hex,
          parseEther(flag('musd')),
          BigInt(flag('period', '600')),
          Number(flag('count', '12')),
          0n,
          stringToHex(label, { size: 32 }),
        ],
        chain,
        account,
      }),
    );
  } else if (cmd === 'price') {
    const { account, client } = wallet('PRICE_OWNER_PRIVATE_KEY');
    await send(`set simulated price $${flag('usd')}`, () =>
      client.writeContract({
        address: dep.PriceFeed,
        abi: MOCK_PRICE_FEED_ABI,
        functionName: 'setPrice',
        args: [parseEther(flag('usd'))],
        chain,
        account,
      }),
    );
  } else if (cmd === 'fund') {
    const { account, client } = wallet('PARENT_PRIVATE_KEY');
    await send(`send ${flag('mon')} MON to ${flag('to')}`, () =>
      client.sendTransaction({ to: flag('to') as Hex, value: parseEther(flag('mon')), chain, account }),
    );
  } else if (cmd === 'status') {
    const owner = (process.env['PARENT_ADDRESS'] ?? wallet('PARENT_PRIVATE_KEY').account.address) as Hex;
    const vault = await vaultOf(owner);
    const price = await pub.readContract({ address: dep.PriceFeed, abi: MOCK_PRICE_FEED_ABI, functionName: 'fetchPrice' });
    const s = await pub.readContract({ address: dep.CerminLens, abi: CERMIN_LENS_ABI, functionName: 'snapshot', args: [vault, price] });
    console.log(`vault ${vault} · MON $${usd(price)}`);
    console.log(`  collateral ${formatEther(s.collateral)} MON · debt ${usd(s.debt)} MUSD · ICR ${(Number(s.icrBps) / 100).toFixed(1)}%`);
    console.log(`  spendable ${usd(s.spendable)} · savings ${usd(s.savings)} MUSD`);
    console.log(
      `  lines: liquidation $${usd(s.lines.liquidationPrice)} · defend $${usd(s.lines.defendPrice)} · saku pause $${usd(s.lines.sakuPausePrice)} · skim $${usd(s.lines.skimPrice)}`,
    );
    const ids = await pub.readContract({ address: dep.CerminSaku, abi: CERMIN_SAKU_ABI, functionName: 'schedulesOfVault', args: [vault] });
    for (const id of ids) {
      const sc = await pub.readContract({ address: dep.CerminSaku, abi: CERMIN_SAKU_ABI, functionName: 'getSchedule', args: [id] });
      const due = await pub.readContract({ address: dep.CerminSaku, abi: CERMIN_SAKU_ABI, functionName: 'dueCount', args: [id] });
      const [st] = await pub.readContract({
        address: vault,
        abi: CERMIN_VAULT_V11_ABI,
        functionName: 'sakuStatus',
        args: [dep.CerminSaku, sc.amount, price],
      });
      console.log(
        `  #${id} "${decodeLabel(sc.label)}" → ${sc.recipient} · ${usd(sc.amount)} MUSD every ${sc.period}s · paid ${sc.paid}/${sc.periods} · due ${due} · now: ${SAKU_STATUS[st]}${sc.cancelled ? ' · CANCELLED' : ''}`,
      );
    }
  } else {
    console.log('commands: open | grant | schedule | price | status (see header)');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
