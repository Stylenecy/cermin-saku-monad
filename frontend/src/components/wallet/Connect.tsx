"use client";

import { useEffect, useRef, useState } from "react";
import { ConnectButton as RkConnectButton } from "@rainbow-me/rainbowkit";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount, useSwitchChain } from "wagmi";
import { Check, Copy, LogOut, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { activeChain } from "@/lib/chains";
import { PRIVY_ENABLED } from "@/lib/privy";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * One connect button for the whole app. With a Privy app id, "Launch app"
 * opens Privy (Google, email, or a wallet; a wallet is created for anyone who
 * signs in without one). Without it, RainbowKit's wallet modal as before.
 * The shape mirrors RainbowKit's ConnectButton so callers stay the same.
 */
type RenderProps = {
  openConnectModal: () => void;
  account: { address: string } | undefined;
  mounted: boolean;
};

function PrivyCustom({ children }: { children: (p: RenderProps) => React.ReactNode }) {
  const { ready, authenticated, login } = usePrivy();
  const { address } = useAccount();
  return (
    <>
      {children({
        openConnectModal: () => {
          if (ready && !authenticated) login();
        },
        account: address ? { address } : undefined,
        mounted: ready,
      })}
    </>
  );
}

function Custom({ children }: { children: (p: RenderProps) => React.ReactNode }) {
  if (PRIVY_ENABLED) return <PrivyCustom>{children}</PrivyCustom>;
  return (
    <RkConnectButton.Custom>
      {({ openConnectModal, account, mounted }) => children({ openConnectModal, account, mounted })}
    </RkConnectButton.Custom>
  );
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function PrivyAccountButton({ label }: { label?: string }) {
  const { t } = useLang();
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { address, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!ready || !authenticated) {
    return (
      <Button variant="primary" size="sm" onClick={() => ready && login()} disabled={!ready}>
        {label ?? t("Masuk", "Sign in")}
      </Button>
    );
  }

  if (address && chainId !== activeChain.id) {
    return (
      <Button variant="danger" size="sm" onClick={() => switchChain({ chainId: activeChain.id })}>
        {t("Ganti ke Monad testnet", "Switch to Monad testnet")}
      </Button>
    );
  }

  const who = user?.google?.email ?? user?.email?.address;

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-cream-300 bg-surface px-3.5 text-sm font-medium text-ink shadow-sm transition-colors hover:border-amber-200"
      >
        <span aria-hidden className="h-2 w-2 rounded-full bg-leaf-500" />
        <span className="font-mono text-[13px]">{address ? short(address) : t("Menyiapkan…", "Setting up…")}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-[60] w-72 rounded-2xl border border-cream-300 bg-surface p-2 shadow-soft">
          <div className="px-3 pb-2 pt-2">
            <div className="text-xs text-muted">{who ?? t("Dompetmu", "Your wallet")}</div>
            {address && <div className="mt-1 break-all font-mono text-xs text-ink">{address}</div>}
          </div>
          {address && (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(address).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink hover:bg-surface-soft"
            >
              {copied ? <Check className="h-4 w-4 text-leaf-600" /> : <Copy className="h-4 w-4 text-muted" />}
              {copied ? t("Alamat disalin", "Address copied") : t("Salin alamat dompet", "Copy wallet address")}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink hover:bg-surface-soft"
          >
            <LogOut className="h-4 w-4 text-muted" />
            {t("Keluar", "Sign out")}
          </button>
        </div>
      )}
    </div>
  );
}

export function ConnectButton({ label }: { label?: string }) {
  if (PRIVY_ENABLED) return <PrivyAccountButton label={label} />;
  return <RkConnectButton showBalance={false} chainStatus="icon" accountStatus="address" label={label} />;
}

ConnectButton.Custom = Custom;
