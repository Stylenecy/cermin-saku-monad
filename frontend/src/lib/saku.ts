import { hexToString, isAddress, stringToHex, zeroAddress } from "viem";

const addr = (v: string | undefined) =>
  (v && isAddress(v) ? v : zeroAddress) as `0x${string}`;

/** Addresses from contracts/script/Deploy.s.sol (NEXT_PUBLIC_* at build time). */
export const SAKU = {
  SAKU: addr(process.env.NEXT_PUBLIC_SAKU_ADDRESS),
  LENS: addr(process.env.NEXT_PUBLIC_LENS_ADDRESS),
  /** The public demo vault shown on /bukti (read-only, no wallet needed). */
  DEMO_VAULT: addr(process.env.NEXT_PUBLIC_DEMO_VAULT),
  DEPLOY_BLOCK: BigInt(process.env.NEXT_PUBLIC_DEPLOY_BLOCK || "0"),
};

export const sakuDeployed = () => SAKU.SAKU !== zeroAddress && SAKU.LENS !== zeroAddress;

/** Mirrors ICerminVault.SakuStatus (uint8). */
export const SAKU_STATUS = ["Ok", "AllowanceExceeded", "InsufficientSpendable", "IcrBelowFloor", "ReserveTooThin"] as const;
export type SakuStatusName = (typeof SAKU_STATUS)[number];

export const STATUS_TEXT: Record<SakuStatusName, { id: string; en: string; tone: "ok" | "held" | "warn" }> = {
  Ok: { id: "Aman — akan dibayar", en: "Safe — will be paid", tone: "ok" },
  AllowanceExceeded: {
    id: "Ditahan — izin belanja Saku sudah habis",
    en: "Held — Saku's spend allowance is used up",
    tone: "warn",
  },
  InsufficientSpendable: {
    id: "Ditahan — saldo pakai di vault tidak cukup",
    en: "Held — not enough spendable balance in the vault",
    tone: "warn",
  },
  IcrBelowFloor: {
    id: "Ditahan — posisi terlalu dekat zona bahaya, pertahanan didahulukan",
    en: "Held — position too close to danger, defense comes first",
    tone: "held",
  },
  ReserveTooThin: {
    id: "Ditahan — cadangan tidak akan cukup bila MON jatuh lagi",
    en: "Held — the reserve would not survive another drop",
    tone: "held",
  },
};

export function statusName(code: number): SakuStatusName {
  return SAKU_STATUS[code] ?? "Ok";
}

export const PERIOD_PRESETS = [
  { seconds: 60, id: "Tiap menit (demo)", en: "Every minute (demo)" },
  { seconds: 120, id: "2 menit (demo)", en: "2 min (demo)" },
  { seconds: 600, id: "10 menit (demo)", en: "10 min (demo)" },
  { seconds: 86_400, id: "Harian", en: "Daily" },
  { seconds: 604_800, id: "Mingguan", en: "Weekly" },
  { seconds: 2_592_000, id: "Bulanan (30 hari)", en: "Monthly (30 days)" },
] as const;

export function periodLabel(seconds: bigint | number, lang: "id" | "en"): string {
  const s = Number(seconds);
  const p = PERIOD_PRESETS.find((x) => x.seconds === s);
  if (p) return lang === "id" ? p.id : p.en;
  if (s % 86_400 === 0) return lang === "id" ? `tiap ${s / 86_400} hari` : `every ${s / 86_400} days`;
  if (s % 3_600 === 0) return lang === "id" ? `tiap ${s / 3_600} jam` : `every ${s / 3_600} h`;
  if (s % 60 === 0) return lang === "id" ? `tiap ${s / 60} menit` : `every ${s / 60} min`;
  return lang === "id" ? `tiap ${s} detik` : `every ${s} s`;
}

export function encodeLabel(text: string): `0x${string}` {
  // bytes32: keep at most 31 UTF-8 bytes so multi-byte characters never split.
  let t = text.trim();
  while (new TextEncoder().encode(t).length > 31) t = t.slice(0, -1);
  return stringToHex(t, { size: 32 });
}

export function decodeLabel(hex: `0x${string}`): string {
  try {
    return hexToString(hex, { size: 32 }).replace(/\u0000+$/, "");
  } catch {
    return "";
  }
}

export const bps = (v: bigint | number) => Number(v) / 100;
