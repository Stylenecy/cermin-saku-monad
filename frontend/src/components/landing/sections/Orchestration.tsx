"use client";

import { Network } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { Reveal } from "@/components/ui/Reveal";
import { OrchestrationDiagram } from "@/components/landing/LandingArt";
import { Eyebrow } from "./Eyebrow";

export function Orchestration() {
  const { t } = useLang();
  return (
    <section className="relative py-20 md:py-28 border-y border-line/60 bg-surface/30">
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="max-w-2xl mb-12">
          <Eyebrow icon={<Network className="w-3.5 h-3.5" />} label={t("Di balik layar", "Under the hood")} note="on-chain" />
          <h2 className="font-serif text-3xl md:text-[2.75rem] font-medium tracking-[-0.02em] leading-[1.08] text-balance mt-5">
            {t("Kamu cukup mengatur sekali. ", "You set it once. ")}
            <em className="italic font-normal text-amber-600">{t("Kontraknya yang berjaga.", "The contract keeps watch.")}</em>
          </h2>
          <p className="text-muted mt-4 text-pretty leading-relaxed">
            {t(
              "Cermin Saku tidak memegang danamu. Ia merangkai vault MON, dolar pinjaman, tabungan cadangan, dan harga on-chain, lalu menambahkan satu aturan: uang saku keluar hanya kalau posisinya aman.",
              "Cermin Saku never holds your funds. It wires together the MON vault, borrowed dollars, a savings reserve and an on-chain price, then adds one rule: an allowance goes out only while the position is safe.",
            )}
          </p>
        </Reveal>
        <Reveal>
          <OrchestrationDiagram />
        </Reveal>
      </div>
    </section>
  );
}
