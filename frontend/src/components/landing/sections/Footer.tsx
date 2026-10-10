"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { useLang } from "@/lib/i18n";

export function Footer() {
  const { t } = useLang();
  return (
    <footer className="border-t border-line/60 bg-surface/50 py-10">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="text-xs text-muted">{t("Uang saku dari MON, di Monad", "Allowances from MON, on Monad")}</span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
          <Link href="/demo" className="hover:text-ink transition-colors">
            {t("Vault demo", "Demo vault")}
          </Link>
          <a href="https://github.com/Stylenecy/cermin-saku-monad" target="_blank" rel="noopener noreferrer" className="hover:text-ink transition-colors">
            {t("Kode terbuka (MIT) ↗", "Open source (MIT) ↗")}
          </a>
          <a href="https://faucet.monad.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-ink transition-colors">
            {t("Faucet testnet ↗", "Testnet faucet ↗")}
          </a>
        </div>
      </div>
    </footer>
  );
}
