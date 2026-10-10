import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUsd(value: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatBtc(wei: bigint): string {
  const btc = Number(wei) / 1e18;
  return btc.toFixed(6) + " MON";
}

export function formatMusd(wei: bigint): string {
  const amount = Number(wei) / 1e18;
  return (
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + " MUSD"
  );
}

export function formatIcr(icrBps: bigint | number): string {
  const n = typeof icrBps === "bigint" ? Number(icrBps) : icrBps;
  return (n / 100).toFixed(1) + "%";
}

/** Hex stroke color for the ICR ring (warm semantic scale). */
export function icrToColor(icrBps: number): string {
  if (icrBps >= 20000) return "#17663E"; // sage
  if (icrBps >= 16000) return "#1E4A8F"; // amber
  if (icrBps >= 13500) return "#9A5B00"; // deep amber
  return "#B42318"; // brick
}

/** Tailwind text color class for the same threshold scale. */
export function icrToTextClass(icrBps: number): string {
  if (icrBps >= 20000) return "text-success";
  if (icrBps >= 16000) return "text-warning";
  if (icrBps >= 13500) return "text-amber-700";
  return "text-danger";
}

export function icrLabel(icrBps: number, lang: "id" | "en" = "id"): string {
  const id = lang === "id";
  if (icrBps >= 30000) return id ? "Sehat" : "Healthy";
  if (icrBps >= 20000) return id ? "Aman" : "Safe";
  if (icrBps >= 15000) return id ? "Waspada" : "Caution";
  if (icrBps >= 12500) return id ? "Bahaya" : "Danger";
  return id ? "Kritis" : "Critical";
}

export function truncateAddress(addr: string): string {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

/** Prefer viem's BaseError.shortMessage; fall back to a truncated message. */
export function formatTxError(err: unknown, max = 240): string {
  if (!err) return "";
  if (typeof err === "object" && err !== null) {
    const e = err as { shortMessage?: string; message?: string };
    if (e.shortMessage) return e.shortMessage;
    if (e.message) return e.message.length > max ? e.message.slice(0, max) + "…" : e.message;
  }
  const s = String(err);
  return s.length > max ? s.slice(0, max) + "…" : s;
}
