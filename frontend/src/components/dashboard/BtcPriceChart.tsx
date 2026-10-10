"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { formatUsd } from "@/lib/utils";
import { formatIdr, useUsdIdr } from "@/lib/idr";
import { useLang } from "@/lib/i18n";
import { Activity } from "lucide-react";

interface BtcPriceChartProps {
  currentPrice: number;
  liquidationPrice: number;
  defensePrice: number;
}

interface Pt {
  t: number;
  p: number;
}

async function fetchHistory(): Promise<Pt[]> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/coins/monad/market_chart?vs_currency=usd&days=30",
  );
  if (!res.ok) throw new Error(`coingecko ${res.status}`);
  const json = (await res.json()) as { prices: [number, number][] };
  // ~daily granularity for 30d; thin to keep the path light.
  const pts = json.prices.map(([t, p]) => ({ t, p }));
  return pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1);
}

const W = 900;
const H = 300;
const PADX = 10;
const TOP = 18;
const PLOT_BOTTOM = 248;

function smooth(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const xm = (pts[i].x + pts[i + 1].x) / 2;
    const ym = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q ${pts[i].x} ${pts[i].y} ${xm} ${ym}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export function BtcPriceChart({ currentPrice, liquidationPrice, defensePrice }: BtcPriceChartProps) {
  const { t, lang } = useLang();
  const { rate } = useUsdIdr();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["mon-history-30d"],
    queryFn: fetchHistory,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
  });

  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (!data) return;
    setDrawn(false);
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, [data]);

  const model = useMemo(() => {
    if (!data || data.length < 2) return null;
    const prices = data.map((d) => d.p);
    const lo = Math.min(...prices, liquidationPrice > 0 ? liquidationPrice : Infinity);
    const hi = Math.max(...prices, defensePrice, currentPrice);
    const pad = (hi - lo) * 0.08 || hi * 0.02;
    const yMin = Math.max(0, lo - pad);
    const yMax = hi + pad;
    const yOf = (p: number) =>
      PLOT_BOTTOM - ((p - yMin) / (yMax - yMin)) * (PLOT_BOTTOM - TOP);
    const xOf = (i: number) => PADX + (i / (data.length - 1)) * (W - 2 * PADX);
    const pts = data.map((d, i) => ({ x: xOf(i), y: yOf(d.p) }));
    const line = smooth(pts);
    const area = `${line} L ${pts[pts.length - 1].x} ${PLOT_BOTTOM} L ${pts[0].x} ${PLOT_BOTTOM} Z`;
    const change = data[0].p !== 0 ? ((data[data.length - 1].p - data[0].p) / data[0].p) * 100 : 0;
    const ticks = [0, Math.floor(data.length / 2), data.length - 1].map((i) => ({
      x: xOf(i),
      label: new Date(data[i].t).toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { month: "short", day: "numeric" }),
    }));
    return { yOf, pts, line, area, change, last: pts[pts.length - 1], ticks };
  }, [data, liquidationPrice, defensePrice, currentPrice, lang]);

  return (
    <Card className="relative overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs text-amber-500 tabular-nums">◆</span>
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted font-medium">
              {t("Harga MON", "MON price")}
            </p>
            <p className="text-muted-2 text-xs">
              {t(
                "30 hari terakhir · harga sekarang dari feed simulasi testnet",
                "Last 30 days · current price from the simulated testnet feed",
              )}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tabular-nums text-ink leading-none">
            {formatIdr(currentPrice * rate)}
          </div>
          <div className="text-xs tabular-nums text-muted mt-1">≈ {formatUsd(currentPrice, 0)}</div>
          {model && (
            <div
              className={`text-xs font-medium tabular-nums mt-1 ${model.change >= 0 ? "text-success" : "text-danger"}`}
            >
              {model.change >= 0 ? "▲" : "▼"} {Math.abs(model.change).toFixed(1)}% · {t("30 hari", "30d")}
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="h-[clamp(180px,26vw,260px)] rounded-2xl bg-gradient-to-r from-cream-200 via-cream-100 to-cream-200 bg-[length:200%_100%] animate-shimmer" />
      ) : isError || !model ? (
        <div className="h-[200px] flex flex-col items-center justify-center text-center">
          <Activity className="w-6 h-6 text-muted-2 mb-2" />
          <p className="text-sm text-muted">{t("Grafik harga belum bisa dimuat", "Live price chart unavailable")}</p>
          <p className="text-[11px] text-muted-2 mt-1">
            {t("Likuidasi di", "Liquidation at")} {formatIdr(liquidationPrice * rate)} ·{" "}
            {t("sekarang", "current")} {formatIdr(currentPrice * rate)}
          </p>
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={t("Grafik harga MON", "MON price chart")}>
          <defs>
            <linearGradient id="btcArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1E4A8F" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#1E4A8F" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* defense + liquidation reference lines */}
          {defensePrice > 0 && (
            <ReferenceLine y={model.yOf(defensePrice)} color="#1E4A8F" label={`${t("Garis bela", "Defense")} ${formatIdr(defensePrice * rate)}`} />
          )}
          {liquidationPrice > 0 && (
            <ReferenceLine y={model.yOf(liquidationPrice)} color="#B42318" label={`${t("Likuidasi", "Liquidation")} ${formatIdr(liquidationPrice * rate)}`} />
          )}

          <path d={model.area} fill="url(#btcArea)" opacity={drawn ? 1 : 0} style={{ transition: "opacity 0.9s ease 0.3s" }} />
          <path
            d={model.line}
            fill="none"
            stroke="#3F68AB"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={drawn ? 0 : 1}
            style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)" }}
          />
          {/* current dot */}
          <circle cx={model.last.x} cy={model.last.y} r="4.5" fill="#17663E" opacity={drawn ? 1 : 0} style={{ transition: "opacity 0.5s ease 1.1s" }} />
          <circle cx={model.last.x} cy={model.last.y} r="4.5" fill="none" stroke="#17663E" opacity="0.5">
            <animate attributeName="r" values="4.5;11;4.5" dur="2.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0;0.5" dur="2.4s" repeatCount="indefinite" />
          </circle>
          {model.ticks.map((t, i) => (
            <text
              key={i}
              x={t.x}
              y={H - 6}
              textAnchor={i === 0 ? "start" : i === model.ticks.length - 1 ? "end" : "middle"}
              fontSize="11"
              fontFamily="var(--font-geist-mono), monospace"
              fill="#56657B"
            >
              {t.label}
            </text>
          ))}
        </svg>
      )}
    </Card>
  );
}

function ReferenceLine({ y, color, label }: { y: number; color: string; label: string }) {
  return (
    <g>
      <line x1={PADX} y1={y} x2={W - PADX} y2={y} stroke={color} strokeWidth="1" strokeDasharray="5 5" opacity="0.5" />
      <text x={W - PADX} y={y - 5} textAnchor="end" fontSize="11" fontFamily="var(--font-geist-mono), monospace" fill={color}>
        {label}
      </text>
    </g>
  );
}
