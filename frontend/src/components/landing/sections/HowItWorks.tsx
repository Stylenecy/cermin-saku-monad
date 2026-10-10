"use client";

import { Layers, Coins, CalendarClock, ShieldCheck } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { Reveal } from "@/components/ui/Reveal";
import { Badge } from "@/components/ui/Badge";
import { IsoArt } from "@/components/landing/LandingArt";
import { Eyebrow } from "./Eyebrow";

export function HowItWorks() {
  const { t } = useLang();
  const steps = [
    {
      n: "001",
      title: t("Setor MON", "Deposit MON"),
      body: t(
        "Kunci MON di vault milikmu sendiri. MON itu tidak dijual untuk membayar uang saku; yang dipakai hanya dolar digital (MUSD) yang dipinjam di atasnya.",
        "Lock MON in a vault that is yours alone. No MON is sold to pay allowances; only the digital dollars (MUSD) borrowed against it are used.",
      ),
      icon: <Coins className="w-7 h-7" />,
      variant: "diamond" as const,
    },
    {
      n: "002",
      title: t("Jadwalkan uang saku", "Schedule the allowance"),
      body: t(
        "Tentukan nominal, seberapa sering, berapa kali, dan dompet penerimanya. Uang saku diambil dari saldo pakai vault, tidak pernah melebihi batas yang kamu izinkan.",
        "Choose the amount, how often, how many times, and the wallet that receives it. It is paid from the vault's spendable balance, never beyond the limit you allow.",
      ),
      icon: <CalendarClock className="w-7 h-7" />,
      variant: "square" as const,
    },
    {
      n: "003",
      title: t("Kontrak yang menjaga", "The contract keeps watch"),
      body: t(
        "Sebelum setiap pembayaran, kontrak memeriksa dua hal: posisinya sehat, dan cadangannya tetap cukup kalau MON turun 30% lagi. Kalau belum aman, uang saku ditahan, bukan hilang, lalu dibayar begitu pulih.",
        "Before every payment the contract checks two things: the position is healthy, and the reserve would survive another 30% fall in MON. If not, the allowance is held, not lost, and paid once it recovers.",
      ),
      icon: <ShieldCheck className="w-7 h-7" />,
      variant: "circle" as const,
    },
  ];

  return (
    <section id="how" className="relative overflow-hidden py-20 md:py-28 scroll-mt-16">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.55]"
          style={{ backgroundImage: "url(/saku-how-it-works-three-scenes.webp)" }}
        />
        <div className="absolute inset-0 bg-canvas/45" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-canvas to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-canvas to-transparent" />
      </div>
      <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="max-w-2xl mb-16">
          <Eyebrow icon={<Layers className="w-3.5 h-3.5" />} label={t("Cara kerja", "How it works")} note={t("setor → jadwal → aman", "deposit → schedule → safe")} />
          <h2 className="font-serif text-3xl md:text-[2.75rem] font-medium tracking-[-0.02em] leading-[1.08] text-balance mt-5">
            {t("Tiga langkah. Satu vault. ", "Three steps. One vault. ")}
            <em className="italic font-normal text-amber-600">{t("MON tetap utuh.", "MON stays put.")}</em>
          </h2>
          <p className="text-muted mt-4 text-pretty leading-relaxed">
            {t(
              "Orang tua menyetor sekali dan mengatur jadwal. Sisanya dikerjakan kontrak di Monad, termasuk tahu kapan harus berhenti.",
              "The parent deposits once and sets a schedule. The contracts on Monad do the rest, including knowing when to stop.",
            )}
          </p>
        </Reveal>

        <div className="space-y-16 md:space-y-24">
          {steps.map((s, i) => {
            const flip = i % 2 === 1;
            return (
              <div key={s.n} className="grid md:grid-cols-2 gap-8 md:gap-16 items-center">
                <Reveal className={flip ? "md:order-2" : ""}>
                  <IsoArt icon={s.icon} variant={s.variant} />
                </Reveal>
                <Reveal delay={120} className={flip ? "md:order-1" : ""}>
                  <div className="font-mono text-sm text-amber-500 tabular-nums mb-3">{s.n}</div>
                  <h3 className="font-serif text-2xl md:text-[2rem] font-medium tracking-[-0.01em] mb-3">
                    {s.title}
                  </h3>
                  <p className="text-muted leading-relaxed text-pretty max-w-md">{s.body}</p>
                  {i === 0 && (
                    <div className="mt-5 inline-flex items-center gap-2 text-xs text-muted font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-mint" />
                      {t("Mulai dari ±1 MON", "From about 1 MON")}
                    </div>
                  )}
                  {i === 1 && (
                    <div className="mt-5 flex flex-wrap gap-1.5">
                      <Badge variant="default">{t("Harian", "Daily")}</Badge>
                      <Badge variant="default">{t("Mingguan", "Weekly")}</Badge>
                      <Badge variant="amber">{t("Bulanan", "Monthly")} ⭐</Badge>
                    </div>
                  )}
                  {i === 2 && (
                    <div className="mt-5 inline-flex items-center gap-2 text-xs text-success font-mono">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {t("Ditahan otomatis saat bahaya", "Held automatically when unsafe")}
                    </div>
                  )}
                </Reveal>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
