import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getChain } from '../chain.js';
import type { Config } from '../config.js';

export interface AgentClients {
  publicClient: PublicClient;
  walletClient: WalletClient;
}

export function createClients(config: Config): AgentClients {
  const transport = http(config.MONAD_RPC_URL, {
    batch: { batchSize: 100, wait: 16 },
    retryCount: 0,
  });
  const chain = getChain(config.CHAIN_ID);
  const publicClient = createPublicClient({ chain, transport });
  const account = privateKeyToAccount(config.PRIVATE_KEY);
  const walletClient = createWalletClient({ account, chain, transport });
  return { publicClient, walletClient };
}
