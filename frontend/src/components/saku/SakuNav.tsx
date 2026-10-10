"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@/components/wallet/Connect";
import { LayoutDashboard, Mail, HandCoins, Eye } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { LangToggle } from "@/components/ui/LangToggle";
import { Button } from "@/components/ui/Button";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The app's own navigation (everything behind "Launch app"): Kiel's floating
 * pill, with the app's three places, and a tab bar on phones. `demo` swaps the
 * wallet button for a "Launch app" entry and marks the read-only demo.
 */
export function SakuNav({ demo = false }: { demo?: boolean }) {
  const { t } = useLang();
  const path = usePathname();
  const links = [
    { href: "/dashboard", label: t("Ringkasan", "Overview"), icon: LayoutDashboard },
    { href: "/saku", label: t("Uang saku", "Allowances"), icon: Mail },
    { href: "/terima", label: t("Penerima", "Recipient"), icon: HandCoins },
  ];
  const isActive = (href: string) => path === href || (href !== "/" && path?.startsWith(href + "/"));

  return (
    <>
      <header className="sticky top-0 z-50 px-4 pt-3 sm:pt-4 pad-safe-top">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full glass border border-line/60 px-4 pr-3 sm:px-6 sm:pr-4 h-14 sm:h-16 shadow-[0_10px_34px_-14px_rgba(58,53,48,0.4)]">
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/" aria-label="Cermin Saku" className="transition-opacity hover:opacity-80">
              <Logo />
            </Link>
            {demo && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-amber-700">
                <Eye className="w-3 h-3" /> {t("Mode demo", "Demo mode")}
              </span>
            )}
          </div>

          {!demo && (
            <nav aria-label={t("Aplikasi", "App")} className="hidden md:flex items-center gap-1 text-sm">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className={cn(
                    "rounded-full px-4 py-2 transition-colors",
                    isActive(l.href) ? "bg-ink text-cream-50" : "text-muted hover:text-ink hover:bg-surface-soft",
                  )}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          )}

          <div className="flex shrink-0 items-center gap-2">
            <LangToggle className="hidden sm:inline-flex" />
            {demo ? (
              <ConnectButton.Custom>
                {({ openConnectModal, account }) =>
                  account ? (
                    <Link href="/dashboard">
                      <Button variant="primary" size="sm">{t("Buka dasbor", "Open dashboard")}</Button>
                    </Link>
                  ) : (
                    <Button variant="primary" size="sm" onClick={openConnectModal}>
                      {t("Buka aplikasi", "Launch app")}
                    </Button>
                  )
                }
              </ConnectButton.Custom>
            ) : (
              <ConnectButton label={t("Masuk", "Sign in")} />
            )}
          </div>
        </div>
      </header>

      {!demo && (
        <nav
          aria-label={t("Aplikasi (ponsel)", "App (mobile)")}
          className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-line/70 glass pad-safe-bottom"
        >
          <div className="grid grid-cols-3">
            {links.map((l) => {
              const Icon = l.icon;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                    isActive(l.href) ? "text-ink" : "text-muted-2",
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {l.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}

/** One quiet line at the end of app pages. */
export function SakuFooter() {
  const { t } = useLang();
  return (
    <footer className="mx-auto max-w-6xl px-6 pt-16 pb-24 md:pb-10 text-xs text-muted-2">
      {t(
        "Monad testnet · dolar (MUSD) dan harga MON tiruan untuk uji coba · bukan nasihat keuangan",
        "Monad testnet · test dollars (MUSD) and a simulated MON price · not financial advice",
      )}
    </footer>
  );
}
