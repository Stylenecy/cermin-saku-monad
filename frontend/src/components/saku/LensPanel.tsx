"use client";

import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/i18n";
import { useLensWhatIf } from "@/hooks/useSaku";
import { STATUS_TEXT, statusName } from "@/lib/saku";
import { formatBps, formatIdr, musdToIdr, useUsdIdr } from "@/lib/idr";
import { cn } from "@/lib/utils";
import { Rp } from "./Money";

type Zone = "safe" | "held" | "defend" | "liquidation";

const ZONE_TEXT: Record<Zone, { id: string; en: string; cls: string }> = {
  safe: { id: "Aman · uang saku jalan", en: "Safe · allowance flows", cls: "bg-daun-soft text-daun border-daun/30" },
  held: { id: "Uang saku DITAHAN", en: "Allowance HELD", cls: "bg-stempel-soft text-stempel border-stempel/30" },
  defend: {
    id: "Keeper membela posisi · uang saku DITAHAN",
    en: "Keeper defends · allowance HELD",
    cls: "bg-kunyit-soft text-kunyit border-kunyit/30",
  },
  liquidation: {
    id: "Zona likuidasi (aturan CDP 110%)",
    en: "Liquidation zone (CDP 110% rule)",
    cls: "bg-stempel text-white border-stempel",
  },
};

/**
 * "Kalau MON turun ke Rp X…" — every number below the slider is computed by
 * the CerminLens contract through eth_call at the hypothetical price. The page
 * does not re-implement the vault's math.
 */
export function LensPanel({
  vault,
  livePrice,
  sakuAmount,
  sakuPending = true,
  compact = false,
}: {
  vault: `0x${string}` | undefined;
  livePrice: bigint | undefined;
  sakuAmount: bigint; // next allowance (MUSD wei) to test against
  /** false when every schedule is finished: the amount is then the last envelope, tested as if scheduled again */
  sakuPending?: boolean;
  compact?: boolean;
}) {
  const { t, lang } = useLang();
  const { rate } = useUsdIdr();
  const [pct, setPct] = useState(100); // % of live price
  const [debounced, setDebounced] = useState(100);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(pct), 120);
    return () => clearTimeout(h);
  }, [pct]);

  const price = useMemo(
    () => (livePrice ? (livePrice * BigInt(debounced)) / 100n : undefined),
    [livePrice, debounced],
  );
  const { defend, saku, snapshot, isError } = useLensWhatIf(vault, price, sakuAmount);
  const lines = snapshot?.lines;

  const zone: Zone | undefined = useMemo(() => {
    if (!snapshot || !price) return undefined;
    if (price < lines!.liquidationPrice) return "liquidation";
    if (price < lines!.defendPrice) return "defend";
    if (price < lines!.sakuPausePrice) return "held";
    return "safe";
  }, [snapshot, lines, price]);

  if (!vault || !livePrice) {
    return (
      <div className="rounded-3xl border border-cream-300 bg-surface shadow-soft p-6 text-sm text-muted">
        {t("Lens butuh vault dan harga feed. Belum ada data.", "Lens needs a vault and a feed price. No data yet.")}
      </div>
    );
  }

  const priceIdr = price ? musdToIdr(price, rate) : 0;
  const sakuStatus = saku ? statusName(Number(saku[0])) : undefined;
  const markers = lines
    ? [
        { key: "liq", p: lines.liquidationPrice, label: t("likuidasi", "liquidation"), cls: "bg-stempel" },
        { key: "def", p: lines.defendPrice, label: t("keeper membela", "keeper defends"), cls: "bg-kunyit" },
        { key: "pause", p: lines.sakuPausePrice, label: t("saku berhenti", "saku pauses"), cls: "bg-tinta" },
      ]
    : [];
  const minP = (livePrice * 30n) / 100n;
  const maxP = (livePrice * 150n) / 100n;
  const pos = (p: bigint) => {
    const v = Number(((p - minP) * 10_000n) / (maxP - minP)) / 100;
    return Math.min(100, Math.max(0, v));
  };
  const bands = lines
    ? [
        { key: "liq", from: 0, to: pos(lines.liquidationPrice), cls: "bg-stempel/70" },
        { key: "def", from: pos(lines.liquidationPrice), to: pos(lines.defendPrice), cls: "bg-kunyit/60" },
        { key: "held", from: pos(lines.defendPrice), to: pos(lines.sakuPausePrice), cls: "bg-stempel/25" },
        { key: "safe", from: pos(lines.sakuPausePrice), to: 100, cls: "bg-daun/45" },
      ]
    : [];

  return (
    <section
      aria-labelledby="lens-title"
      className={cn("rounded-3xl border border-cream-300 bg-surface shadow-soft", compact ? "p-5" : "p-6 sm:p-8")}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="lens-title" className="text-xl sm:text-2xl text-ink">
          {t("Kalau MON jadi", "If MON goes to")}{" "}
          <span className="text-tinta tabular">{formatIdr(priceIdr)}</span>
        </h2>
        <span className="text-sm text-muted tabular">
          {pct}% {t("dari harga sekarang", "of today's price")}
        </span>
      </div>

      <label htmlFor="lens-slider" className="sr-only">
        {t("Harga MON hipotetis, persen dari harga sekarang", "Hypothetical MON price, percent of today's")}
      </label>
      <input
        id="lens-slider"
        type="range"
        min={30}
        max={150}
        step={1}
        value={pct}
        onChange={(e) => setPct(Number(e.target.value))}
        className="mt-5 w-full accent-[#1e4a8f] h-2 cursor-pointer"
      />

      {/* zones and the vault's own price lines, read from CerminLens */}
      <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
        {bands.map((b) => (
          <span key={b.key} className={cn("absolute inset-y-0", b.cls)} style={{ left: `${b.from}%`, width: `${Math.max(0, b.to - b.from)}%` }} />
        ))}
      </div>
      {/* The lines can sit a few pixels apart, so the axis carries ticks only
          and the names and prices go in a legend that wraps on small screens. */}
      <div className="relative h-9" aria-hidden>
        {markers.map((m) => (
          <span key={m.key} className={cn("absolute top-0 h-3 w-0.5 -translate-x-1/2", m.cls)} style={{ left: `${pos(m.p)}%` }} />
        ))}
        <div className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${pos(livePrice)}%` }}>
          <span className="h-4 w-0.5 bg-ink" />
          <span className="whitespace-nowrap text-[11px] font-semibold text-ink">{t("sekarang", "now")}</span>
        </div>
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted">
        {markers.map((m) => (
          <li key={m.key} className="flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", m.cls)} aria-hidden />
            {m.label} <span className="font-semibold text-ink tabular">{formatIdr(musdToIdr(m.p, rate))}</span>
          </li>
        ))}
      </ul>

      {isError && (
        <p className="mt-3 text-sm text-stempel">
          {t("Kontrak Lens tidak terjangkau (RPC). Coba lagi sebentar.", "Lens contract unreachable (RPC). Try again shortly.")}
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className={cn("rounded-xl border px-4 py-3", zone ? ZONE_TEXT[zone].cls : "border-line")}>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] opacity-80">{t("Keadaan", "State")}</p>
          <p className="mt-1 font-bold">{zone ? (lang === "id" ? ZONE_TEXT[zone].id : ZONE_TEXT[zone].en) : "…"}</p>
          <p className="mt-0.5 text-sm tabular">
            ICR {formatBps(snapshot?.icrBps, lang, 1)}
          </p>
        </div>
        <div className="rounded-xl border border-line px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            {sakuPending
              ? t("Uang saku berikutnya", "Next allowance")
              : t("Kalau amplop ini dijadwalkan lagi", "If this envelope were scheduled again")}
          </p>
          {sakuAmount > 0n ? (
            <>
              <p className="mt-1 font-bold text-ink">
                <Rp wei={sakuAmount} showUsd={false} />
              </p>
              <p className={cn("mt-0.5 text-sm", sakuStatus === "Ok" ? "text-daun" : "text-stempel")}>
                {sakuStatus ? (lang === "id" ? STATUS_TEXT[sakuStatus].id : STATUS_TEXT[sakuStatus].en) : "…"}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">{t("Belum ada amplop terjadwal.", "No envelope scheduled yet.")}</p>
          )}
        </div>
        <div className="rounded-xl border border-line px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{t("Kalau keeper membela", "If the keeper defends")}</p>
          {defend?.wouldDefend ? (
            <>
              <p className="mt-1 font-bold text-ink">
                {t("cicil", "repay")} <Rp wei={defend.repay} showUsd={false} />
              </p>
              <p className="mt-0.5 text-sm text-muted">
                {t("dari tabungan", "from savings")} <Rp wei={defend.fromSavings} showUsd={false} /> ·{" "}
                {t("ICR jadi", "ICR to")} {formatBps(defend.icrAfterBps, lang, 0)}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">{t("Tidak perlu — ICR masih di atas garis bela.", "Not needed — ICR is above the defend line.")}</p>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-muted">
        {t(
          "Angka di atas dihitung kontrak CerminLens lewat eth_call pada harga hipotetis: tanpa transaksi, tanpa gas. Cermin sendiri tidak pernah menjual MON; di bawah garis likuidasi, CDP sungguhan bisa menyita jaminan, karena itu keeper membela lebih awal.",
          "Figures above are computed by the CerminLens contract via eth_call at the hypothetical price: no transaction, no gas. Cermin itself never sells MON; below the liquidation line a real CDP could seize collateral, which is why the keeper defends earlier.",
        )}
      </p>
    </section>
  );
}
