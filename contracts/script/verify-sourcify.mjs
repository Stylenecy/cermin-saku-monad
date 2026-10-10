// Verify every contract of a deployment on Sourcify (no API key needed).
//   cd contracts && forge build && node script/verify-sourcify.mjs deployments/monad-testnet.json
// Uses Sourcify API v2: POST /v2/verify/metadata/{chainId}/{address} with the
// compiler metadata from Foundry's artifacts and the exact source files.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCIFY = process.env.SOURCIFY_URL ?? 'https://sourcify.dev/server';
const dep = JSON.parse(readFileSync(join(root, process.argv[2] ?? 'deployments/monad-testnet.json'), 'utf8'));

const ARTIFACTS = {
  CerminFactory: 'CerminFactory.sol/CerminFactory.json',
  CerminVaultImpl: 'CerminVault.sol/CerminVault.json',
  CerminSaku: 'CerminSaku.sol/CerminSaku.json',
  CerminLens: 'CerminLens.sol/CerminLens.json',
  PriceFeed: 'MockPriceFeed.sol/MockPriceFeed.json',
  MUSD: 'MockMUSD.sol/MockMUSD.json',
  TroveManager: 'MockTroveManager.sol/MockTroveManager.json',
  BorrowerOperations: 'MockBorrowerOperations.sol/MockBorrowerOperations.json',
  SavingsVault: 'MockSavingsVault.sol/MockSavingsVault.json',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function verify(name, address) {
  const art = JSON.parse(readFileSync(join(root, 'out', ARTIFACTS[name]), 'utf8'));
  const metadata = JSON.parse(art.rawMetadata);
  const sources = {};
  for (const path of Object.keys(metadata.sources)) sources[path] = readFileSync(join(root, path), 'utf8');

  const res = await fetch(`${SOURCIFY}/v2/verify/metadata/${dep.chainId}/${address}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sources, metadata }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 409) return `${name} ${address}: already verified`;
  if (!res.ok) return `${name} ${address}: HTTP ${res.status} ${JSON.stringify(body).slice(0, 200)}`;

  for (let i = 0; i < 30; i++) {
    await sleep(3000);
    const job = await (await fetch(`${SOURCIFY}/v2/verify/${body.verificationId}`)).json();
    if (job.isJobCompleted) {
      if (job.error) return `${name} ${address}: FAILED ${job.error.customCode ?? ''} ${job.error.message ?? ''}`.trim();
      return `${name} ${address}: ${job.contract?.match ?? 'done'} (creation ${job.contract?.creationMatch}, runtime ${job.contract?.runtimeMatch})`;
    }
  }
  return `${name} ${address}: still pending (job ${body.verificationId})`;
}

for (const name of Object.keys(ARTIFACTS)) {
  if (!dep[name]) continue;
  console.log(await verify(name, dep[name]));
}
