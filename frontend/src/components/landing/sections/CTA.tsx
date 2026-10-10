"use client";

import { ConnectButton } from "@/components/wallet/Connect";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { Reveal } from "@/components/ui/Reveal";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function CTA({
  launchHref,
  onLaunch,
}: {
  launchHref: string | null;
  onLaunch?: () => void;
}) {
  const { t } = useLang();
  return (
    <section className="relative overflow-hidden py-16 md:py-24">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.5]"
          style={{ backgroundImage: "url(/saku-cta-dawn-path.webp)" }}
        />
        <div className="absolute inset-0 bg-canvas/45" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-canvas to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-canvas to-transparent" />
      </div>
      <div className="relative z-10 mx-auto max-w-5xl px-5 sm:px-8">
        <Reveal>
          <Card variant="accent" className="!p-10 md:!p-16 text-center relative">
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-70"
                style={{ backgroundImage: "url(/saku-cta-dawn-path.webp)" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-shadow-900 via-shadow-900/80 to-shadow-900/65" />
            </div>
            <div className="relative z-10">
              <h2 className="font-serif text-3xl md:text-5xl font-medium tracking-[-0.02em] text-white text-balance leading-[1.06]">
                {t("Kirim uang saku pertama ", "Send the first allowance ")}
                <em className="italic font-normal text-amber-200">{t("dalam satu menit.", "in a minute.")}</em>
              </h2>
              <p className="text-white/85 mt-5 max-w-xl mx-auto leading-relaxed">
                {t("Masuk dengan Google atau dompet, setor MON, atur jadwal. MON-mu tetap utuh.", "Sign in with Google or a wallet, deposit MON, set a schedule. Your MON stays whole.")}
              </p>
              <div className="mt-8 flex flex-col items-center gap-4">
                {launchHref && onLaunch ? (
                  <Button variant="secondary" size="xl" onClick={onLaunch}>
                    {t("Buka dasbor", "Open dashboard")}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <ConnectButton.Custom>
                    {({ openConnectModal }) => (
                      <Button variant="secondary" size="xl" onClick={openConnectModal}>
                        {t("Buka aplikasi", "Launch app")}
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    )}
                  </ConnectButton.Custom>
                )}
                <Link href="/demo" className="text-sm text-white/75 hover:text-white transition-colors">
                  {t("atau lihat vault demo, tanpa dompet →", "or look at the demo vault, no wallet →")}
                </Link>
              </div>
            </div>
          </Card>
        </Reveal>
      </div>
    </section>
  );
}
