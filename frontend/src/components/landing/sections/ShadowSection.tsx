"use client";

import { Moon } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { Reveal } from "@/components/ui/Reveal";
import { Card } from "@/components/ui/Card";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Eyebrow } from "./Eyebrow";

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 transition-colors hover:bg-white/[0.08]">
      <div className="text-xs text-white/50 font-mono">{label}</div>
      <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
      <div className="text-xs text-white/40 mt-0.5">{sub}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className={`text-ink ${mono ? "font-mono" : "font-medium"}`}>{value}</span>
    </div>
  );
}

export function ShadowSection() {
  const { t } = useLang();
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <Card variant="ink" className="!p-8 md:!p-12 relative">
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-60"
                style={{ backgroundImage: "url(/saku-shadow-night-warmth.webp)" }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-shadow-900 via-shadow-900/85 to-shadow-900/60" />
            </div>
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-amber-500/40 blur-3xl pointer-events-none animate-float" />
            <div className="relative grid md:grid-cols-2 gap-8 items-center">
              <div>
                <Eyebrow tone="light" icon={<Moon className="w-3.5 h-3.5" />} label={t("Saat pasar jatuh", "When the market falls")} />
                <h2 className="font-serif text-3xl md:text-[2.75rem] font-medium tracking-[-0.02em] leading-[1.08] text-balance mt-5">
                  {t("Kamu tidur. ", "You sleep. ")}
                  <em className="italic font-normal text-amber-300">{t("Kontraknya tetap terjaga.", "The contract stays awake.")}</em>
                </h2>
                <p className="text-white/70 mt-4 text-pretty leading-relaxed">
                  {t(
                    "Tidak perlu memantau grafik. Setiap amplop diperiksa kontrak di harga saat itu. Kalau posisinya terlalu dekat zona bahaya, amplop dicap DITAHAN dan cadangan dipakai untuk membela vault lebih dulu.",
                    "No chart-watching. Every envelope is checked by the contract at that moment's price. If the position is too close to danger, the envelope is stamped HELD and the reserve defends the vault first.",
                  )}
                </p>
                <div className="grid grid-cols-2 gap-3 mt-7 max-w-md">
                  <Stat label={t("Uang saku berhenti", "Allowance pauses")} value="< 150%" sub={t("rasio jaminan", "collateral ratio")} />
                  <Stat label={t("Penjaga membela", "Guard defends")} value="140%" sub={t("dari tabungan cadangan", "from the savings reserve")} />
                  <Stat label={t("Uji tahan", "Stress test")} value="−30%" sub={t("cadangan harus tahan", "the reserve must survive")} />
                  <Stat label={t("Likuidasi", "Liquidation")} value="110%" sub={t("dijaga jauh di atasnya", "kept well above it")} />
                </div>
              </div>
              <div className="bg-surface rounded-3xl p-6 shadow-pop relative">
                <div className="text-xs uppercase tracking-[0.18em] text-amber-600 font-mono mb-1">
                  {t("Uang saku Rara", "Rara's allowance")}
                </div>
                <AnimatedNumber
                  value={500000}
                  durationMs={1400}
                  format={(n) => "Rp " + Math.round(n).toLocaleString("id-ID")}
                  className="block text-4xl sm:text-5xl whitespace-nowrap font-semibold tabular-nums tracking-tight text-ink"
                />
                <div className="text-sm text-muted mt-1">{t("tiap bulan · ke dompet anak", "every month · to the child's wallet")}</div>
                <div className="grid grid-cols-3 gap-2 mt-6">
                  {[t("Dibayar", "Paid"), t("Ditahan", "Held"), t("Dibayar", "Paid")].map((a, i) => (
                    <div
                      key={i}
                      className={`rounded-2xl py-3 px-2 text-center text-sm font-medium transition-colors ${
                        i === 1 ? "bg-stempel-soft text-danger" : "bg-leaf-50 text-leaf-700"
                      }`}
                    >
                      {a}
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-5 border-t border-line space-y-3">
                  <Row label={t("MON terkunci", "MON locked")} value="1,68 MON" />
                  <Row label={t("Cadangan pembela", "Defense reserve")} value="Rp 6.000.000" />
                  <Row label={t("Rasio · status", "Ratio · status")} value={t("200% · Aman", "200% · Safe")} mono />
                </div>
              </div>
            </div>
          </Card>
        </Reveal>
      </div>
    </section>
  );
}
