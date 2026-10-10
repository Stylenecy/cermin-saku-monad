// Monad addresses come from contracts/script/Deploy.s.sol output via
// NEXT_PUBLIC_* env vars. TODO: fill after deploying to Monad testnet — the
// zero-address fallbacks mean "not deployed yet".
export const CONTRACTS = {
  CERMIN_FACTORY: (process.env.NEXT_PUBLIC_CERMIN_FACTORY_ADDRESS ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
  MUSD: (process.env.NEXT_PUBLIC_MUSD_ADDRESS ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
  SAVINGS_VAULT: (process.env.NEXT_PUBLIC_SAVINGS_VAULT_ADDRESS ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
  PRICE_FEED: (process.env.NEXT_PUBLIC_PRICE_FEED_ADDRESS ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
};

export const VAULT_PARAMS_TUPLE = [
  { name: "targetLTV", type: "uint16" },
  { name: "defendICR", type: "uint16" },
  { name: "emergencyICR", type: "uint16" },
  { name: "skimThresholdBps", type: "uint16" },
  { name: "spendableShare", type: "uint16" },
] as const;

const VAULT_STATE_TUPLE = [
  { name: "lastSkimPrice", type: "uint256" },
  { name: "lastSeenPrice", type: "uint256" },
  { name: "spendableMusd", type: "uint256" },
  { name: "smusdShares", type: "uint256" },
  { name: "createdAt", type: "uint64" },
] as const;

export const CERMIN_FACTORY_ABI = [
  {
    type: "function",
    name: "createVault",
    inputs: [
      { name: "params", type: "tuple", components: VAULT_PARAMS_TUPLE },
      { name: "maxBorrow", type: "uint256" },
      { name: "upperHint", type: "address" },
      { name: "lowerHint", type: "address" },
    ],
    outputs: [{ name: "vault", type: "address" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "vaultOf",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allVaults",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "VaultCreated",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "vault", type: "address", indexed: true },
      { name: "params", type: "tuple", components: VAULT_PARAMS_TUPLE, indexed: false },
    ],
  },
] as const;

export const CERMIN_VAULT_ABI = [
  { type: "function", name: "owner", inputs: [], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
  { type: "function", name: "getICR", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getDebt", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getCollateral", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  {
    type: "function",
    name: "getShadow",
    inputs: [],
    outputs: [
      { name: "spendable", type: "uint256" },
      { name: "vaultValue", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "params",
    inputs: [],
    outputs: [{ name: "", type: "tuple", components: VAULT_PARAMS_TUPLE }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "state",
    inputs: [],
    outputs: [{ name: "", type: "tuple", components: VAULT_STATE_TUPLE }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "withdrawSpendable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "recipient", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "upperHint", type: "address" },
      { name: "lowerHint", type: "address" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "defend",
    inputs: [
      { name: "upperHint", type: "address" },
      { name: "lowerHint", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "close",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "Skimmed",
    inputs: [
      { name: "priceAtSkim", type: "uint256", indexed: false },
      { name: "toSpendable", type: "uint256", indexed: false },
      { name: "toVault", type: "uint256", indexed: false },
      { name: "newDebt", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Defended",
    inputs: [
      { name: "icrBefore", type: "uint256", indexed: false },
      { name: "icrAfter", type: "uint256", indexed: false },
      { name: "repaid", type: "uint256", indexed: false },
      { name: "fromVault", type: "uint256", indexed: false },
      { name: "fromSpendable", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SpendableWithdrawn",
    inputs: [
      { name: "recipient", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Closed",
    inputs: [
      { name: "btcReturned", type: "uint256", indexed: false },
      { name: "musdRemainder", type: "uint256", indexed: false },
    ],
  },
] as const;

export const PRICE_FEED_ABI = [
  // The CDP PriceFeed exposes fetchPrice() (non-view in the Mezo-derived
  // interface). We only ever read it via eth_call, which ignores
  // declared mutability, so we mark it "view" to satisfy useReadContract typing.
  {
    type: "function",
    name: "fetchPrice",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "lastGoodPrice",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// Cermin MockSavingsVault (mirror of Mezo MUSDSavingsRate) — claim-based (NOT ERC4626).
// sMUSD mints 1:1; yield accrues via index, claimed separately.
export const SAVINGS_VAULT_ABI = [
  { type: "function", name: "totalSupply", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "claimableYield",
    inputs: [{ name: "holder", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  { type: "function", name: "deposit", inputs: [{ name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "withdraw", inputs: [{ name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "claimYield", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "nonpayable" },
] as const;
