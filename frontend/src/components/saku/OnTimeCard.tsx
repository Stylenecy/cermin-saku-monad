"use client";

import { Zap } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useLedger } from "@/hooks/useSaku";
import { formatNum } from "@/lib/idr";

/**
 * How punctual the allowance has been, from the passbook's own two timestamps
 * per payment (when it was due, and the block it landed in). Nothing here is
 * typed in by us: it is read from contract state.
 */
export function OnTimeCard({ vault }: { vault: `0x${string}` | undefined }) {
  const { t, lang } = useLang();
  const { data } = useLedger(vault);
  const late = (data ?? [])
    .filter((e) => e.kind === "paid" && e.timestamp !== undefined && e.dueAt !== undefined)
    .map((e) => e.timestamp! - e.dueAt!)
    .sort((a, b) => a - b);
  if (late.length === 0) return null;
  const median = late[Math.floor((late.length - 1) / 2)]!;
  const onTime = late.filter((s) => s <= 2).length;
  const stats = [
    { value: formatNum(late.length, lang), label: t("pembayaran tercatat", "payments recorded") },
    { value: `${formatNum(median, lang)} ${t("dtk", "s")}`, label: t("median dari jatuh tempo ke blok pembayaran", "median from due time to the paying block") },
    { value: `${formatNum(onTime, lang)}/${formatNum(late.length, lang)}`, label: t("dibayar ≤ 2 dtk sesudah jatuh tempo", "paid ≤ 2 s after falling due") },
  ];
  return (
    <section aria-labelledby="ontime-title" className="rounded-3xl border border-cream-300 bg-surface shadow-soft p-6 sm:p-8">
      <div className="flex items-center gap-2 text-daun">
        <Zap className="h-4 w-4" aria-hidden />
        <span className="font-mono text-[11px] uppercase tracking-[0.18em]">{t("Tepat waktu di Monad", "On time on Monad")}</span>
      </div>
      <h2 id="ontime-title" className="mt-2 font-serif text-2xl font-medium tracking-[-0.02em] text-ink">
        {t("Amplop datang ", "Envelopes arrive ")}
        <em className="italic font-normal text-amber-600">{t("hitungan detik setelah jatuh tempo", "within seconds of falling due")}</em>
      </h2>
      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-surface-soft p-4">
            <dt className="text-xs text-muted">{s.label}</dt>
            <dd className="mt-1 font-serif text-3xl text-ink tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        {t(
          "Untuk tiap pembayaran, kontrak menyimpan kapan ia jatuh tempo dan kapan ia benar-benar dibayar; angka di atas dihitung dari dua cap waktu itu. Monad membuat blok kira-kira tiap 0,4 detik, jadi penjaga bangun tepat saat jatuh tempo dan pembayarannya masuk di blok-blok pertama yang boleh. Pembayaran yang ditahan karena posisi tidak aman ikut terhitung terlambat, dan itu disengaja.",
          "For each payment the contract stores when it fell due and when it was actually paid; the figures above come from those two timestamps. Monad makes a block about every 0.4 seconds, so the keeper wakes at the due time and the payment lands in the first blocks where it is allowed. Payments held because the position was unsafe count as late, by design.",
        )}
      </p>
    </section>
  );
}
