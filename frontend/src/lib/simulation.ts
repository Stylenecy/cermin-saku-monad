import type { VaultParams } from "./presets";

export interface SimulationResult {
  totalBorrowed: number;
  spendableNow: number;
  inVault: number;
  monthlyIncome: number;
  annualIncome: number;
  /** Fractional MON price drop before defendICR triggers (0–1). */
  btcDropTolerance: number;
}

const BPS = 10_000;

export function simulate(
  btcAmount: number,
  btcPriceUsd: number,
  params: VaultParams,
  vaultApr = 0.05,
  borrowRate = 0.01,
): SimulationResult {
  const btcValueUsd = btcAmount * btcPriceUsd;
  if (btcValueUsd <= 0) {
    return {
      totalBorrowed: 0,
      spendableNow: 0,
      inVault: 0,
      monthlyIncome: 0,
      annualIncome: 0,
      btcDropTolerance: 0,
    };
  }

  const totalBorrowed = btcValueUsd * (params.targetLTV / BPS);
  const spendableNow = totalBorrowed * (params.spendableShare / BPS);
  const inVault = totalBorrowed - spendableNow;

  const grossYield = inVault * vaultApr;
  const borrowCost = totalBorrowed * borrowRate;
  const annualIncome = Math.max(0, grossYield - borrowCost);
  const monthlyIncome = annualIncome / 12;

  // ICR at open = BPS² / targetLTV. Defense fires when ICR < defendICR.
  // MON drop tolerance = 1 - defendICR / openICR.
  const openICR = (BPS * BPS) / params.targetLTV;
  const btcDropTolerance = Math.max(0, 1 - params.defendICR / openICR);

  return {
    totalBorrowed,
    spendableNow,
    inVault,
    monthlyIncome,
    annualIncome,
    btcDropTolerance,
  };
}
