"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Bot, Sparkles, Lock, PauseCircle, Wallet, BookOpen } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { Reveal } from "@/components/ui/Reveal";
import { Card } from "@/components/ui/Card";
import { Eyebrow } from "./Eyebrow";
import { GateVisual } from "./GateVisual";

type Tone = "sage" | "amber" | "info" | "peach";

interface Feature {
  icon: ReactNode;
  title: string;
  body: string;
  tone: Tone;
  span: string;
  layout: "big" | "banner" | "compact";
  visual?: ReactNode;
}

const TONES: Record<Tone, string> = {
  sage: "bg-success/15 text-success",
  amber: "bg-amber-50 text-amber-700",
  info: "bg-info/12 text-info",
  peach: "bg-peach-200 text-amber-700",
};

function IconTile({ icon, tone }: { icon: ReactNode; tone: Tone }) {
  return (
    <div
      className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3 ${TONES[tone]}`}
    >
      {icon}
    </div>
  );
}

/* A slice of the passbook: the same envelope, paid, held, paid again, in Rupiah. */
function PassbookVisual() {
  const { t } = useLang();
  const rows = [
    { m: t("Okt", "Oct"), v: "Rp 500.000", s: t("dibayar", "paid"), c: "text-leaf-700 bg-leaf-50 border-leaf-100" },
    { m: t("Nov", "Nov"), v: "Rp 500.000", s: t("ditahan", "held"), c: "text-danger bg-stempel-soft border-danger/20" },
    { m: t("Nov", "Nov"), v: "Rp 500.000", s: t("dibayar", "paid"), c: "text-leaf-700 bg-leaf-50 border-leaf-100" },
  ];
  return (
    <div className="relative h-full w-full min-h-[96px] rounded-2xl bg-surface border border-cream-300 overflow-hidden px-4 py-2 bg-ledger">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between gap-3 py-1.5 text-xs">
          <span className="font-mono text-muted-2 w-8">{r.m}</span>
          <span className="flex-1 font-medium text-ink tabular-nums">{r.v}</span>
          <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${r.c}`}>{r.s}</span>
        </div>
      ))}
    </div>
  );
}

function FeatureCard({
  index,
  icon,
  title,
  body,
  tone,
  layout,
  visual,
}: Feature & { index: string }) {
  if (layout === "banner") {
    return (
      <Card className="!p-6 group h-full flex flex-col md:flex-row md:items-center gap-6" interactive>
        <div className="md:flex-1">
          <div className="flex items-center justify-between mb-4">
            <IconTile icon={icon} tone={tone} />
            <span className="font-mono text-xs text-muted-2 tabular-nums">{index}</span>
          </div>
          <h3 className="font-semibold text-lg tracking-tight">{title}</h3>
          <p className="text-sm text-muted mt-2 leading-relaxed text-pretty max-w-md">{body}</p>
        </div>
        <div className="md:w-[42%] shrink-0 h-28 md:h-full md:max-h-[128px]">{visual}</div>
      </Card>
    );
  }
  if (layout === "big") {
    return (
      <Card className="!p-6 group h-full flex flex-col" interactive>
        <div className="flex items-center justify-between mb-4">
          <IconTile icon={icon} tone={tone} />
          <span className="font-mono text-xs text-muted-2 tabular-nums">{index}</span>
        </div>
        <h3 className="font-semibold text-lg tracking-tight">{title}</h3>
        <p className="text-sm text-muted mt-2 leading-relaxed text-pretty max-w-sm">{body}</p>
        <div className="mt-5 flex-1 min-h-[140px]">{visual}</div>
      </Card>
    );
  }
  return (
    <Card className="!p-6 group h-full flex flex-col" interactive>
      <div className="flex items-center justify-between mb-4">
        <IconTile icon={icon} tone={tone} />
        <span className="font-mono text-xs text-muted-2 tabular-nums">{index}</span>
      </div>
      <h3 className="font-semibold text-base tracking-tight">{title}</h3>
      <p className="text-sm text-muted mt-1.5 leading-relaxed text-pretty flex-1">{body}</p>
    </Card>
  );
}

export function Features() {
  const { t } = useLang();
  const features: Feature[] = [
    {
      icon: <PauseCircle className="w-5 h-5" />,
      title: t("Berhenti sendiri saat pasar jatuh", "Pauses itself when the market falls"),
      body: t(
        "Kalau MON turun sampai posisimu mendekati bahaya, uang saku berikutnya ditahan oleh kontrak, bukan oleh aplikasi. Begitu pulih, yang tertunda dibayar.",
        "If MON falls far enough to put the position near danger, the next allowance is held by the contract, not by the app. Once it recovers, what was owed is paid.",
      ),
      tone: "amber",
      span: "sm:col-span-2 lg:col-span-2 lg:row-span-2",
      layout: "big",
      visual: <GateVisual />,
    },
    {
      icon: <ShieldCheck className="w-5 h-5" />,
      title: t("MON tidak disentuh", "MON stays untouched"),
      body: t("Jaminan tidak pernah keluar dari vault. Yang bergerak hanya dolar pinjaman.", "Collateral never leaves the vault. Only the borrowed dollars move."),
      tone: "sage",
      span: "",
      layout: "compact",
    },
    {
      icon: <Lock className="w-5 h-5" />,
      title: t("Batas izin yang keras", "A hard spending cap"),
      body: t("Kamu tentukan batas total yang boleh dikirim. Kontrak tidak akan melewatinya.", "You set the most that may ever be sent. The contract never goes past it."),
      tone: "peach",
      span: "",
      layout: "compact",
    },
    {
      icon: <Bot className="w-5 h-5" />,
      title: t("Penjaga anti-likuidasi", "A guard against liquidation"),
      body: t("Penjaga otomatis mencicil utang dari tabungan cadangan jauh sebelum garis likuidasi.", "An automatic guard repays debt from the savings reserve well before the liquidation line."),
      tone: "info",
      span: "",
      layout: "compact",
    },
    {
      icon: <Wallet className="w-5 h-5" />,
      title: t("Kamu yang pegang kendali", "You stay in control"),
      body: t("Setiap vault adalah kontrak milikmu. Jadwal bisa dibatalkan kapan saja.", "Every vault is your own contract. Any schedule can be cancelled at any time."),
      tone: "sage",
      span: "",
      layout: "compact",
    },
    {
      icon: <BookOpen className="w-5 h-5" />,
      title: t("Buku tabungan dalam Rupiah", "A passbook in Rupiah"),
      body: t(
        "Setiap pembayaran dan penahanan tercatat on-chain dan tampil dalam Rupiah, jadi orang tua dan anak membaca angka yang sama.",
        "Every payment and every hold is recorded on-chain and shown in Rupiah, so parent and child read the same numbers.",
      ),
      tone: "amber",
      span: "sm:col-span-2 lg:col-span-4",
      layout: "banner",
      visual: <PassbookVisual />,
    },
  ];
  return (
    <section id="features" className="relative overflow-hidden py-20 md:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.5]"
          style={{ backgroundImage: "url(/saku-features-tranquil-town.webp)" }}
        />
        <div className="absolute inset-0 bg-canvas/45" />
      </div>
      <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="max-w-2xl mb-14">
          <Eyebrow icon={<Sparkles className="w-3.5 h-3.5" />} label={t("Kenapa Cermin Saku", "Why Cermin Saku")} />
          <h2 className="font-serif text-3xl md:text-[2.75rem] font-medium tracking-[-0.02em] leading-[1.08] text-balance mt-5">
            {t("Uang saku yang ", "An allowance that ")}
            <em className="italic font-normal text-amber-600">{t("tahu kapan menahan diri.", "knows when to hold back.")}</em>
          </h2>
        </Reveal>

        <motion.div
          variants={staggerContainer(0.08)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:auto-rows-[200px]"
        >
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              whileHover={{ y: -5, transition: { type: "spring", stiffness: 400, damping: 26 } }}
              className={`${f.span} [&>*]:h-full`}
            >
              <FeatureCard index={String(i + 1).padStart(3, "0")} {...f} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
