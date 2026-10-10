"use client";

import { useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Logo } from "@/components/ui/Logo";
import { fadeUp, staggerContainer, EASE_OUT } from "@/lib/motion";
import {
  Vault,
  DollarSign,
  Activity,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useLang } from "@/lib/i18n";

/* ── Isometric line-art slab ──────────────────────────────────────────────
   A blueprint-style iso platform with a floating motif and an overlaid icon.
   Used as the illustration beside each "how it works" step. */
export function IsoArt({
  icon,
  variant = "diamond",
  className,
}: {
  icon: React.ReactNode;
  variant?: "diamond" | "circle" | "square";
  className?: string;
}) {
  const float =
    variant === "circle" ? (
      <circle cx="160" cy="95" r="30" stroke="#35648F" strokeWidth="1.5" strokeDasharray="4 4" />
    ) : variant === "square" ? (
      <rect x="130" y="65" width="60" height="60" rx="8" stroke="#35648F" strokeWidth="1.5" strokeDasharray="4 4" />
    ) : (
      <path d="M160 65 L206 95 L160 125 L114 95 Z" stroke="#35648F" strokeWidth="1.5" strokeDasharray="4 4" />
    );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.7, ease: EASE_OUT }}
      className={`relative w-full max-w-[320px] mx-auto ${className ?? ""}`}
    >
      <svg viewBox="0 0 320 280" fill="none" className="block w-full">
        <ellipse cx="160" cy="240" rx="98" ry="20" fill="#1F1B17" opacity="0.06" />
        {/* slab faces */}
        <path d="M68 200 L68 216 L160 256 L160 240 Z" fill="#E6E0D4" stroke="#3A3530" strokeWidth="1.25" strokeLinejoin="round" />
        <path d="M160 240 L160 256 L252 216 L252 200 Z" fill="#D2C8B6" stroke="#3A3530" strokeWidth="1.25" strokeLinejoin="round" />
        <path d="M160 160 L252 200 L160 240 L68 200 Z" fill="#FCFBF8" stroke="#3A3530" strokeWidth="1.5" strokeLinejoin="round" />
        {/* faint grid lines on top face */}
        <path d="M114 180 L206 220 M206 180 L114 220" stroke="#3A3530" strokeWidth="0.75" opacity="0.25" />
        {/* dotted trajectory */}
        <circle cx="160" cy="134" r="1.6" fill="#35648F" />
        <circle cx="160" cy="146" r="1.6" fill="#35648F" opacity="0.7" />
        <circle cx="160" cy="158" r="1.6" fill="#35648F" opacity="0.4" />
        {/* floating motif — gentle hover */}
        <motion.g
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        >
          {float}
        </motion.g>
      </svg>
      <motion.span
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-1/2 top-[34%] -translate-x-1/2 -translate-y-1/2 text-amber-600"
      >
        {icon}
      </motion.span>
    </motion.div>
  );
}

/* ── Orchestration diagram ────────────────────────────────────────────────
   Cermin at the hub, CDP primitives on an arc, connectors that draw in when
   the section enters view. A toggle reframes the same vault for two audiences. */
type Persona = "parents" | "children";

type Node = { id: string; label: string; sub: string; icon: React.ReactNode; x: number; y: number };

const nodes = (t: (id: string, en: string) => string): Node[] => [
  { id: "vault", label: t("Vault MON", "MON vault"), sub: t("jaminan, tidak dijual", "collateral, never sold"), icon: <Vault className="w-5 h-5" />, x: 150, y: 250 },
  { id: "musd", label: "MUSD", sub: t("dolar pinjaman", "borrowed dollars"), icon: <DollarSign className="w-5 h-5" />, x: 322, y: 138 },
  { id: "feed", label: t("Harga MON", "MON price"), sub: t("dibaca on-chain", "read on-chain"), icon: <Activity className="w-5 h-5" />, x: 500, y: 98 },
  { id: "saku", label: t("Amplop", "Envelopes"), sub: t("jadwal uang saku", "allowance schedule"), icon: <Mail className="w-5 h-5" />, x: 678, y: 138 },
  { id: "guard", label: t("Penjaga", "Guard"), sub: t("bela sebelum likuidasi", "defends before liquidation"), icon: <ShieldCheck className="w-5 h-5" />, x: 850, y: 250 },
];

const CENTER = { x: 500, y: 430 };

const captions = (t: (id: string, en: string) => string): Record<Persona, string> => ({
  parents: t(
    "Setor sekali, atur jadwal, selesai. Uang saku terkirim tiap periode, MON-mu tetap utuh, dan pembayaran berhenti sendiri saat posisimu butuh dibela.",
    "Deposit once, set a schedule, done. The allowance goes out every period, your MON stays whole, and payments pause on their own when the position needs defending.",
  ),
  children: t(
    "Uang saku masuk ke dompetmu sesuai jadwal. Kalau sedang ditahan, kamu bisa lihat alasannya, dan amplopnya tetap terutang sampai dibayar.",
    "Your allowance lands in your wallet on schedule. If one is held, you can see why, and the envelope stays owed until it is paid.",
  ),
});

function arc(x: number, y: number) {
  const cx = (CENTER.x + x) / 2;
  const cy = Math.min(CENTER.y, y) - 30;
  return `M${CENTER.x} ${CENTER.y} Q ${cx} ${cy} ${x} ${y}`;
}

const drawParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};

const drawPath: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  show: { pathLength: 1, opacity: 0.55, transition: { duration: 0.9, ease: [0.2, 0.8, 0.2, 1] } },
};

export function OrchestrationDiagram() {
  const { t } = useLang();
  const [persona, setPersona] = useState<Persona>("parents");
  const NODES = nodes(t);
  const CAPTIONS = captions(t);

  return (
    <div>
      <div className="relative w-full aspect-[25/14] sm:aspect-[25/12] rounded-3xl border border-cream-300 bg-surface/40 overflow-hidden">
        {/* atmosphere */}
        <div className="absolute inset-0 bg-grid-soft opacity-50" />
        <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_110%,rgba(53,100,143,0.12),transparent_60%)]" />

        {/* connectors — draw in on view */}
        <motion.svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 1000 480"
          fill="none"
          variants={drawParent}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
        >
          {NODES.map((n) => (
            <motion.path
              key={n.id}
              d={arc(n.x, n.y)}
              stroke="#35648F"
              strokeWidth="1.5"
              strokeLinecap="round"
              variants={drawPath}
            />
          ))}
        </motion.svg>

        {/* primitive nodes — staggered fade-up */}
        <motion.div
          className="absolute inset-0"
          variants={staggerContainer(0.09, 0.25)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
        >
          {NODES.map((n) => (
            <div
              key={n.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${(n.x / 1000) * 100}%`, top: `${(n.y / 480) * 100}%` }}
            >
              <motion.div variants={fadeUp} className="flex flex-col items-center text-center">
                <span className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-surface border border-cream-300 shadow-soft flex items-center justify-center text-ink">
                  {n.icon}
                </span>
                <span className="mt-2 text-xs font-semibold text-ink leading-none">{n.label}</span>
                <span className="mt-0.5 text-[10px] text-muted-2 font-mono hidden sm:block">{n.sub}</span>
              </motion.div>
            </div>
          ))}
        </motion.div>

        {/* hub */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${(CENTER.x / 1000) * 100}%`, top: `${(CENTER.y / 480) * 100}%` }}
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.6 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.1 }}
            className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-shadow-900 shadow-pop"
          >
            <span className="absolute inset-0 rounded-2xl bg-amber-500/30 blur-xl" />
            <Logo withWordmark={false} size={36} className="relative" />
          </motion.span>
        </div>
      </div>

      {/* persona toggle + caption */}
      <div className="mt-7 flex flex-col items-center">
        <div className="inline-flex items-center gap-1 rounded-full bg-surface-soft border border-cream-300 p-1">
          {(["parents", "children"] as Persona[]).map((p) => {
            const isActive = persona === p;
            return (
              <button
                key={p}
                onClick={() => setPersona(p)}
                className={`relative px-4 h-9 rounded-full text-sm font-medium transition-colors duration-200 ${
                  isActive ? "text-white" : "text-muted hover:text-ink"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="personaPill"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className="absolute inset-0 rounded-full bg-ink shadow-soft"
                  />
                )}
                <span className="relative z-10">{p === "parents" ? t("Untuk orang tua", "For parents") : t("Untuk anak", "For children")}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-5 max-w-2xl min-h-[3.5rem]">
          <AnimatePresence mode="wait">
            <motion.p
              key={persona}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: EASE_OUT }}
              className="text-center text-muted text-pretty leading-relaxed"
            >
              {CAPTIONS[persona]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
