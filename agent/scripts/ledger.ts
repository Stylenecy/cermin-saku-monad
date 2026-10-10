/**
 * Print a vault's on-chain passbook as JSON: every Saku payment, hold, schedule
 * change, and the vault's own defend/skim, plus the simulated price moves, read
 * straight from event logs. Read-only, no key needed. Monad's public RPC serves
 * logs 100 blocks at a time, so this walks the range in 100-block windows
 * (fine for an evidence export; the web app reads the passbook from state).
 *
 *   DEPLOYMENT=../contracts/deployments/monad-testnet.json RPC_URL=… npx tsx scripts/ledger.ts [vault]
 *
 * The vault defaults to the deployer's (the public demo vault).
 */
import { readFileSync } from 'node:fs';
import { createPublicClient, http, type Hex } from 'viem';
import { getChain } from '../src/chain.js';
import { CERMIN_FACTORY_ABI } from '../src/abis/CerminFactory.js';
import { CERMIN_SAKU_ABI, CERMIN_VAULT_V11_ABI, MOCK_PRICE_FEED_ABI } from '../src/abis/generated.js';

interface Deployment {
  chainId: number;
  deployer: Hex;
  deployBlock: number;
  CerminFactory: Hex;
  CerminSaku: Hex;
  PriceFeed: Hex;
}

const dep = JSON.parse(readFileSync(process.env['DEPLOYMENT'] ?? '../contracts/deployments/monad-testnet.json', 'utf8')) as Deployment;
const pub = createPublicClient({ chain: getChain(dep.chainId), transport: http(process.env['RPC_URL'] ?? 'https://testnet-rpc.monad.xyz') });
const CHUNK = 99n;

const big = (_k: string, v: unknown) => (typeof v === 'bigint' ? v.toString() : v);

async function main() {
  const vault =
    (process.argv[2] as Hex | undefined) ??
    ((await pub.readContract({ address: dep.CerminFactory, abi: CERMIN_FACTORY_ABI, functionName: 'vaultOf', args: [dep.deployer] })) as Hex);
  const latest = await pub.getBlockNumber();
  const rows: Record<string, unknown>[] = [];
  for (let from = BigInt(dep.deployBlock); from <= latest; from += CHUNK + 1n) {
    const to = from + CHUNK > latest ? latest : from + CHUNK;
    if (Number(from - BigInt(dep.deployBlock)) % 5_000 < 100) console.error(`… block ${from}`);
    const [saku, v, price] = await Promise.all([
      pub.getContractEvents({ address: dep.CerminSaku, abi: CERMIN_SAKU_ABI, fromBlock: from, toBlock: to }),
      pub.getContractEvents({ address: vault, abi: CERMIN_VAULT_V11_ABI, fromBlock: from, toBlock: to }),
      pub.getContractEvents({ address: dep.PriceFeed, abi: MOCK_PRICE_FEED_ABI, eventName: 'PriceSet', fromBlock: from, toBlock: to }),
    ]);
    for (const l of [...saku, ...v, ...price]) {
      const args = (l as { args?: Record<string, unknown> }).args ?? {};
      if ('vault' in args && String(args['vault']).toLowerCase() !== vault.toLowerCase()) continue;
      rows.push({ event: (l as { eventName?: string }).eventName, block: l.blockNumber, logIndex: l.logIndex, tx: l.transactionHash, args });
    }
  }
  rows.sort((a, b) => Number((a['block'] as bigint) - (b['block'] as bigint)) || (a['logIndex'] as number) - (b['logIndex'] as number));
  const times = new Map<bigint, number>();
  for (const b of new Set(rows.map((r) => r['block'] as bigint))) times.set(b, Number((await pub.getBlock({ blockNumber: b })).timestamp));
  for (const r of rows) r['time'] = times.get(r['block'] as bigint);
  // The passbook as stored in CerminSaku's state (paid and held lines, with due and paid times).
  const ids = (await pub.readContract({ address: dep.CerminSaku, abi: CERMIN_SAKU_ABI, functionName: 'schedulesOfVault', args: [vault] })) as readonly bigint[];
  const passbook: Record<string, unknown>[] = [];
  for (const id of ids) {
    const len = await pub.readContract({ address: dep.CerminSaku, abi: CERMIN_SAKU_ABI, functionName: 'passbookLength', args: [id] });
    const lines = await pub.readContract({ address: dep.CerminSaku, abi: CERMIN_SAKU_ABI, functionName: 'passbook', args: [id, 0n, len] });
    for (const l of lines) passbook.push({ schedule: id, ...l });
  }
  console.log(JSON.stringify({ chainId: dep.chainId, vault, readAtBlock: latest, rows, passbook }, big, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
