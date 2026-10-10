import { defineChain, type Chain } from 'viem';
import { anvil } from 'viem/chains';

// Monad. Testnet (10143) by default; CHAIN_ID=143 for mainnet, 31337 for a
// local Anvil rehearsal. Defined here rather than imported so the keeper does
// not depend on the viem release that first shipped Monad.
export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Testnet MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } },
  blockExplorers: { default: { name: 'Monadscan', url: 'https://testnet.monadscan.com' } },
  testnet: true,
});

export const monad = defineChain({
  id: 143,
  name: 'Monad',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.monad.xyz'] } },
  blockExplorers: { default: { name: 'Monadscan', url: 'https://monadscan.com' } },
});

export function getChain(chainId: number): Chain {
  if (chainId === anvil.id) return anvil;
  return chainId === monad.id ? monad : monadTestnet;
}
