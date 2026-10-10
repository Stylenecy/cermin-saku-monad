"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { VaultParamsData } from "@/hooks/useVault";
import { useLang } from "@/lib/i18n";
import { RISK_LABELS } from "@/lib/presets";
import { Clock, Bot } from "lucide-react";

interface StrategyCardProps {
  params: VaultParamsData;
  btcPriceUsd: number;
  lastSkimPrice: bigint;
  createdAt?: bigint;
}

function profileName(targetLTV: number, lang: "id" | "en"): string {
  if (targetLTV <= 4000) return RISK_LABELS.conservative[lang];
  if (targetLTV <= 5000) return RISK_LABELS.balanced[lang];
  if (targetLTV <= 7000) return RISK_LABELS.aggressive[lang];
  return lang === "id" ? "Kustom" : "Custom";
}

function formatAge(createdAtSec: number, lang: "id" | "en"): string {
  if (!createdAtSec) return "—";
  const s = Math.max(0, Math.floor(Date.now() / 1000) - createdAtSec);
  const d = Math.floor(s / 86400);
  if (d > 0) return lang === "id" ? `${d} hari` : `${d}d`;
  const h = Math.floor(s / 3600);
  if (h > 0) return lang === "id" ? `${h} jam` : `${h}h`;
  return lang === "id" ? `${Math.floor(s / 60)} menit` : `${Math.floor(s / 60)}m`;
}

export function StrategyCard({ params, btcPriceUsd, lastSkimPrice, createdAt }: StrategyCardProps) {
  const { t, lang } = useLang();
  const targetLtv = params.targetLTV / 100;
  const spendable = params.spendableShare / 100;
  const vaultPct = 100 - spendable;
  const skim = params.skimThresholdBps / 100;
  const defendIcr = params.defendICR / 100;
  const emergencyIcr = params.emergencyICR / 100;
  const profile = profileName(params.targetLTV, lang);
  const age = formatAge(Number(createdAt ?? 0n), lang);

  const lastSkim = Number(lastSkimPrice) / 1e18;
  const movePct = lastSkim > 0 && btcPriceUsd > 0 ? ((btcPriceUsd - lastSkim) / lastSkim) * 100 : 0;
  const skimProgress = skim > 0 ? Math.max(0, Math.min(1, movePct / skim)) : 0;
  const skimReady = movePct >= skim && skim > 0;

  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setGrown(true), 240);
    return () => clearTimeout(id);
  }, []);

  return (
    <Card className="relative overflow-hidden flex flex-col">
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs text-amber-500 tabular-nums">003</span>
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted font-medium">{t("Strategi", "Strategy")}</p>
            <p className="text-muted-2 text-xs">{t("Aturan yang jalan sendiri", "Self-driving rules")}</p>
          </div>
        </div>
        <Badge variant="amber">{profile}</Badge>
      </div>

      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
        {/* params */}
        <div className="space-y-2.5">
          <Row label="Target LTV" value={`${targetLtv.toFixed(0)}%`} />
          <Row label={t("Bela di bawah", "Defend below")} value={`${defendIcr.toFixed(0)}%`} tone="text-warning" />
          <Row label={t("Darurat di bawah", "Emergency below")} value={`${emergencyIcr.toFixed(0)}%`} tone="text-danger" />
          <Row label={t("Skim saat MON naik", "Skim on MON rise")} value={`+${skim.toFixed(1)}%`} />
        </div>

        {/* allocation + skim */}
        <div className="space-y-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-2 font-mono mb-2">
              {t("Setiap pinjaman dibagi ke", "Each borrow splits into")}
            </p>
            <div className="flex h-2 rounded-full overflow-hidden gap-px bg-cream-300">
              <div
                className="bg-amber-400 rounded-l-full transition-[width] duration-[1100ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                style={{ width: `${grown ? spendable : 0}%` }}
              />
              <div
                className="bg-success rounded-r-full transition-[width] duration-[1100ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                style={{ width: `${grown ? vaultPct : 0}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-amber-600 tabular-nums">
                {t("Saldo pakai", "Spendable")} {spendable.toFixed(0)}%
              </span>
              <span className="text-[10px] text-success tabular-nums">
                {t("Tabungan", "Savings")} {vaultPct.toFixed(0)}%
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[10px] font-mono mb-1.5">
              <span className="uppercase tracking-[0.12em] text-muted-2">
                {skimReady ? t("Siap skim", "Skim armed") : t("Skim otomatis berikutnya", "Next auto-skim")}
              </span>
              <span className={`tabular-nums ${skimReady ? "text-success" : "text-muted"}`}>
                +{movePct > 0 ? movePct.toFixed(1) : "0.0"}% / +{skim.toFixed(1)}%
              </span>
            </div>
            <div className="h-1 rounded-full bg-cream-300 overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width] duration-[1100ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] ${skimReady ? "bg-success" : "bg-amber-400"}`}
                style={{ width: `${grown ? skimProgress * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto pt-4 border-t border-line flex items-center justify-between text-[11px] font-mono text-muted-2">
        <span className="inline-flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5 text-amber-500" /> {t("Keeper berjalan", "Keeper running")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="w-3 h-3" /> {t(`umur ${age}`, `${age} old`)}
        </span>
      </div>
    </Card>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-xs font-mono tabular-nums ${tone ?? "text-ink"}`}>{value}</span>
    </div>
  );
}
