"use client";

import { useLang } from "@/lib/i18n";
import { SAKU } from "@/lib/saku";
import { CONTRACTS } from "@/lib/contracts";
import { EXPLORER_URL, activeChain } from "@/lib/chains";

/** Addresses of everything this deployment runs on, with explorer links. */
export function ContractList() {
  const { t } = useLang();
  const rows: [string, string, `0x${string}`][] = [
    ["CerminSaku", t("jadwal & pembayaran uang saku (baru)", "allowance schedules & payments (new)"), SAKU.SAKU],
    ["CerminLens", t("kalkulator 'kalau MON jadi X' (baru)", "'what if MON goes to X' (new)"), SAKU.LENS],
    ["CerminFactory", t("pembuat vault (mesin Cermin open-source, v1.1)", "vault factory (open-source Cermin engine, v1.1)"), CONTRACTS.CERMIN_FACTORY],
    ["MockPriceFeed", t("harga MON simulasi (pemilik = deployer kami)", "simulated MON price (owner = our deployer)"), CONTRACTS.PRICE_FEED],
    ["MockMUSD", t("stablecoin tiruan CDP", "mock CDP stablecoin"), CONTRACTS.MUSD],
  ];
  return (
    <section aria-labelledby="contracts-title" className="rounded-3xl border border-cream-300 bg-surface shadow-soft p-5 sm:p-7">
      <h2 id="contracts-title" className="text-xl text-ink">
        {t("Kontrak", "Contracts")} · {activeChain.name}
      </h2>
      <ul className="mt-3">
        {rows.map(([name, role, address]) => (
          <li key={name} className="ledger-row flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-ink">{name}</p>
              <p className="text-xs text-muted">{role}</p>
            </div>
            <a
              href={`${EXPLORER_URL}/address/${address}`}
              target="_blank"
              rel="noreferrer"
              className="break-all font-mono text-xs text-tinta underline-offset-2 hover:underline"
            >
              {address}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
