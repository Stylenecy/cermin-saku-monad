export interface VaultParams {
  targetLTV: number;
  defendICR: number;
  emergencyICR: number;
  skimThresholdBps: number;
  spendableShare: number;
}

export type RiskKey = "conservative" | "balanced" | "aggressive";
export type GoalLabel = "forever" | "spendNow";

export const PRESETS: Record<RiskKey, VaultParams> = {
  conservative: {
    targetLTV: 4_000,
    defendICR: 17_000,
    emergencyICR: 14_000,
    skimThresholdBps: 800,
    spendableShare: 3_000,
  },
  balanced: {
    targetLTV: 5_000,
    defendICR: 14_000,
    emergencyICR: 12_000,
    skimThresholdBps: 500,
    spendableShare: 5_000,
  },
  aggressive: {
    targetLTV: 7_000,
    defendICR: 12_500,
    emergencyICR: 11_800,
    skimThresholdBps: 300,
    spendableShare: 7_000,
  },
};

/** A UI string in both languages (Bahasa Indonesia first). */
export interface Bilingual {
  id: string;
  en: string;
}

// Goal is purely a UI framing — both branches use the same on-chain params.
export const GOAL_LABELS: Record<GoalLabel, { title: Bilingual; tagline: Bilingual; badge: Bilingual }> = {
  forever: {
    title: { id: "Uang Saku Selamanya", en: "Forever Allowance" },
    tagline: {
      id: "Hasil yang terus mengalir tanpa batas waktu. MON tidak dijual untuk membayarnya.",
      en: "Earn sustainable yield indefinitely. No MON is sold to pay for it.",
    },
    badge: { id: "Pensiun", en: "Pension" },
  },
  spendNow: {
    title: { id: "Pakai Sekarang, Lunasi Nanti", en: "Spend Now, Reclaim Later" },
    tagline: {
      id: "Pinjam MUSD dengan jaminan MON, lunasi sesuai waktumu.",
      en: "Borrow MUSD against MON; repay it on your timeline.",
    },
    badge: { id: "Target", en: "Goal" },
  },
};

// Display names for the three risk presets.
export const RISK_LABELS: Record<RiskKey, Bilingual> = {
  conservative: { id: "Hati-hati", en: "Conservative" },
  balanced: { id: "Seimbang", en: "Balanced" },
  aggressive: { id: "Berani", en: "Aggressive" },
};
