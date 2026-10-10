"use client";

import { useRef } from "react";
import { ConnectButton } from "@/components/wallet/Connect";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, ArrowDown } from "lucide-react";
import { fadeUp } from "@/lib/motion";
import { Button } from "@/components/ui/Button";
import { LineShadowText } from "@/components/ui/LineShadowText";
import { useLang } from "@/lib/i18n";

function scrollToId(id: string) {
  if (typeof document === "undefined") return;
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function Hero({
  launchHref,
  onLaunch,
}: {
  launchHref: string | null;
  onLaunch?: () => void;
}) {
  const { t, lang } = useLang();
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const sceneY = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "16%"]);
  const sceneScale = useTransform(scrollYProgress, [0, 1], [1.06, reduce ? 1.06 : 1.2]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -64]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.85], [1, reduce ? 1 : 0]);
  const bloomY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 130]);

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.12, delayChildren: 0.08 } },
  };

  return (
    <section
      id="launch"
      ref={ref}
      className="relative flex flex-col min-h-[calc(100svh_-_8.5rem)] overflow-hidden"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <motion.div
          style={{ y: bloomY }}
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[55rem] h-[34rem] rounded-full bg-amber-200/30 blur-[130px]"
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(rgba(92,84,72,0.10) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            maskImage: "radial-gradient(120% 65% at 50% 12%, black, transparent 60%)",
            WebkitMaskImage: "radial-gradient(120% 65% at 50% 12%, black, transparent 60%)",
          }}
        />
      </div>

      {/* content fills the space above the image and stays centered */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        style={{ y: contentY, opacity: contentOpacity }}
        className="relative z-10 flex-1 flex flex-col items-center justify-center text-center w-full max-w-5xl mx-auto px-5 sm:px-8 py-6"
      >
        <motion.h1
          variants={fadeUp}
          className="font-serif font-medium text-ink text-[2.1rem] sm:text-4xl md:text-5xl lg:text-[3.5rem] tracking-[-0.03em] leading-[1.05] text-balance"
        >
          {lang === "id" ? (
            <>
              MON-mu tetap <em className="font-normal italic">utuh</em>.
              <br />
              <LineShadowText as="span" shadowColor="#35648F" className="font-normal italic text-ink">
                Uang saku
              </LineShadowText>{" "}
              anakmu tetap <em className="font-normal italic text-amber-600">jalan</em>.
            </>
          ) : (
            <>
              Your MON stays <em className="font-normal italic">whole</em>.
              <br />
              <span className="font-normal italic text-muted-2">Your child&apos;s </span>
              <LineShadowText as="span" shadowColor="#35648F" className="font-normal italic text-ink">
                allowance
              </LineShadowText>{" "}
              keeps <em className="font-normal italic text-amber-600">coming</em>.
            </>
          )}
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="mt-5 text-sm sm:text-base md:text-lg text-muted max-w-2xl mx-auto text-pretty leading-relaxed"
        >
          {t(
            "Setor MON sekali. Cermin Saku meminjam dolar di atasnya dan mengirim uang saku ke dompet anakmu hitungan detik setelah jatuh tempo, di Monad. Saat MON jatuh terlalu dalam, kontraknya sendiri menahan pembayaran sampai aman lagi.",
            "Deposit MON once. Cermin Saku borrows dollars against it and sends your child's allowance within seconds of falling due, on Monad. When MON falls too far, the contract itself holds the payment until it is safe again.",
          )}
        </motion.p>

        <motion.div variants={fadeUp} className="mt-7 flex flex-col items-center gap-3">
          {launchHref && onLaunch ? (
            <Button variant="primary" size="xl" onClick={onLaunch}>
              {t("Buka dasbor", "Open dashboard")}
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <ConnectButton.Custom>
              {({ openConnectModal }) => (
                <Button variant="primary" size="xl" onClick={openConnectModal}>
                  {t("Buka aplikasi", "Launch app")}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </ConnectButton.Custom>
          )}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
            <button
              onClick={() => scrollToId("how")}
              className="inline-flex items-center gap-1.5 text-muted hover:text-ink transition-colors"
            >
              {t("Lihat cara kerjanya", "See how it works")} <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <Link href="/demo" className="inline-flex items-center gap-1.5 text-muted hover:text-ink transition-colors">
              {t("Coba tanpa dompet", "Try it without a wallet")} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </motion.div>
      </motion.div>

      {/* landscape sits at the bottom of the first screen — parallax drift on scroll */}
      <div
        aria-hidden
        className="relative w-full h-[30svh] sm:h-[35svh] md:h-[40svh] shrink-0 overflow-hidden"
      >
        <motion.div
          style={{
            y: sceneY,
            scale: sceneScale,
            backgroundImage: "url(/saku-hero-horizon-figure.webp)",
            maskImage:
              "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.4) 16%, #000 38%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.4) 16%, #000 38%)",
          }}
          className="absolute inset-0 bg-cover bg-bottom origin-bottom will-change-transform"
        />
        <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-canvas to-transparent" />
      </div>
    </section>
  );
}
