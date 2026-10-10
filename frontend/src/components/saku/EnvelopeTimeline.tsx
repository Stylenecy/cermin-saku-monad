"use client";

import { useLang } from "@/lib/i18n";
import { Envelope, type EnvelopeState } from "./Envelope";

/**
 * Mechanism illustration for the hero (labelled as an illustration): a MON
 * price line over eight scheduled envelopes. Where the price sits under the
 * Saku line, the envelope is stamped DITAHAN; once the price recovers, the
 * held envelopes are paid. The real, on-chain version lives on /bukti.
 */
const PRICE = [100, 104, 97, 84, 78, 88, 99, 103]; // % of opening price (illustrative)
const SAKU_LINE = 90;
const STATES: EnvelopeState[] = ["paid", "paid", "paid", "held", "held", "paid", "due", "upcoming"];
const HELD_CENTER = ((STATES.indexOf("held") + STATES.lastIndexOf("held") + 1) / 2 / STATES.length) * 100;

export function EnvelopeTimeline() {
  const { t } = useLang();
  const w = 560;
  const h = 150;
  const x = (i: number) => 35 + i * ((w - 70) / (PRICE.length - 1));
  const y = (p: number) => h - ((p - 70) / 40) * (h - 20) - 10;
  const path = PRICE.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");

  return (
    <figure className="rounded-3xl border border-cream-300 bg-surface shadow-soft p-4 sm:p-6">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={t("Ilustrasi: harga MON turun di bawah garis saku, dua amplop ditahan, lalu dibayar setelah pulih", "Illustration: MON price dips under the Saku line, two envelopes are held, then paid after recovery")}>
        <line x1="20" x2={w - 10} y1={y(SAKU_LINE)} y2={y(SAKU_LINE)} className="stroke-tinta" strokeWidth="1.5" strokeDasharray="6 5" />
        <text x={w - 12} y={y(SAKU_LINE) - 6} textAnchor="end" className="fill-tinta text-[11px] font-semibold">
          {t("garis saku", "saku line")}
        </text>
        <path d={path} fill="none" className="stroke-ink" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {PRICE.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p)} r="4" className={p < SAKU_LINE ? "fill-stempel" : "fill-ink"} />
        ))}
        <text x="20" y="14" className="fill-muted text-[11px]">
          {t("harga MON", "MON price")}
        </text>
      </svg>
      <div className="relative mt-2">
        <div className="grid grid-cols-8 gap-1.5 sm:gap-3">
          {STATES.map((s, i) => (
            <Envelope key={i} state={s} quiet />
          ))}
        </div>
        {/* one stamp across the held run; the envelopes are too small for one each */}
        <span
          className="stamp stamp-in pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface/90 text-stempel text-[10px] sm:text-xs"
          style={{ left: `${HELD_CENTER}%` }}
          aria-hidden
        >
          Ditahan
        </span>
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>
          <span className="font-bold text-daun">●</span> {t("dibayar", "paid")}
        </span>
        <span>
          <span className="font-bold text-stempel">DITAHAN</span> {t("posisi tidak aman, uang tidak bergerak", "unsafe, no money moves")}
        </span>
        <span>{t("Ilustrasi mekanisme; data asli di halaman Bukti.", "Mechanism illustration; real data on the Proof page.")}</span>
      </figcaption>
    </figure>
  );
}
