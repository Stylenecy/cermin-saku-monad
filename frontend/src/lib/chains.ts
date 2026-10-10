import { monad, monadTestnet } from "viem/chains";

// Monad: testnet (10143) by default, mainnet (143) when NEXT_PUBLIC_CHAIN_ID=143.
export const activeChain =
  process.env.NEXT_PUBLIC_CHAIN_ID === "143" ? monad : monadTestnet;

export const EXPLORER_URL = activeChain.blockExplorers.default.url;

// Monad makes a block about every 400 ms and finalizes in about a second, so the
// app polls for receipts every 150 ms instead of wagmi's default of 4 seconds.
// Without this, a payment that settled in under a second would still look slow.
export const POLL_MS = 150;
