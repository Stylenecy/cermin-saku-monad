"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, HelpCircle } from "lucide-react";
import { EASE_OUT } from "@/lib/motion";
import { Reveal } from "@/components/ui/Reveal";
import { Eyebrow } from "./Eyebrow";
import { useLang } from "@/lib/i18n";

export function FAQ() {
  const { t } = useLang();
  const [open, setOpen] = useState<number | null>(0);
  const qs = [
    {
      q: t("Apakah MON-ku dijual?", "Is my MON ever sold?"),
      a: t(
        "Tidak untuk membayar uang saku. MON dikunci sebagai jaminan di vault yang hanya bisa ditutup olehmu, dan uang saku diambil dari dolar yang dipinjam di atasnya. Seperti pinjaman berjaminan mana pun, MON baru bisa hilang kalau posisi jatuh sampai garis likuidasi; dua gerbang dan penjaga ada untuk mencegah itu, tapi risikonya tidak nol.",
        "Not to pay allowances. Your MON is locked as collateral in a vault only you can close, and the allowance is paid from dollars borrowed against it. As with any collateralised loan, MON can only be lost if the position falls to the liquidation line; the two gates and the guard exist to prevent that, but the risk is not zero.",
      ),
    },
    {
      q: t("Kenapa tidak jual sedikit MON tiap bulan saja?", "Why not just sell a little MON every month?"),
      a: t(
        "Untuk banyak orang, menjual memang lebih sederhana. Cermin Saku untuk pemegang MON jangka panjang yang ingin tetap memegang MON tapi punya kebutuhan rutin. Gantinya adalah pinjaman, yang punya bunga dan risiko likuidasi. Hitungan kasarnya: meminjam baru lebih untung daripada menjual kalau MON naik lebih cepat dari sekitar empat kali bunga pinjamannya. Bedanya dengan pinjaman biasa: uang saku tidak akan diam-diam memakai dana yang melindungi MON-mu.",
        "For many people, selling is simpler. Cermin Saku is for long-term MON holders who want to keep their MON but have a recurring need. The trade is a loan, with interest and liquidation risk. Roughly: borrowing only beats selling if MON rises faster than about four times the borrow rate. The difference from a plain loan: the allowance can never quietly spend the money that protects your MON.",
      ),
    },
    {
      q: t("Kalau uang saku ditahan, anakku bagaimana?", "If an allowance is held, what about my child?"),
      a: t(
        "Amplop yang ditahan tidak hilang: tetap terutang dan dibayar begitu posisi aman lagi, oleh penjaga (keeper) atau siapa pun yang memicu pembayaran. Di dasbor kamu langsung melihatnya dan bisa menambah MON supaya aman lebih cepat. Untuk kebutuhan pokok seperti kos dan makan, jangan bergantung pada satu aset yang naik-turun; Cermin Saku paling pas sebagai uang saku di atas itu.",
        "A held envelope is not lost: it stays owed and is paid once the position is safe again, by the keeper or anyone who triggers the payment. You see it on the dashboard and can add MON to make it safe sooner. For essentials such as rent and food, do not depend on a single volatile asset; Cermin Saku fits best as the allowance on top of that.",
      ),
    },
    {
      q: t("Apa yang terjadi kalau MON anjlok?", "What happens if MON crashes?"),
      a: t(
        "Pembayaran berikutnya diperiksa kontrak lebih dulu. Kalau posisi terlalu dekat zona bahaya, uang saku ditahan dan penjaga membela vault memakai tabungan cadangan, jauh sebelum garis likuidasi 110%. Begitu aman, amplop yang tertunda dibayar.",
        "The next payment is checked by the contract first. If the position is too close to danger, the allowance is held and the guard defends the vault from the savings reserve, well before the 110% liquidation line. Once it is safe, the owed envelopes are paid.",
      ),
    },
    {
      q: t("Anakku perlu apa untuk menerima?", "What does my child need to receive it?"),
      a: t(
        "Cukup alamat dompet. Uang saku masuk dalam dolar digital (MUSD). Di halaman penerima ia bisa melihat jadwal, yang sudah masuk, dan alasannya kalau ada yang ditahan.",
        "Just a wallet address. The allowance arrives in digital dollars (MUSD). On the recipient page they can see the schedule, what has arrived, and why if one is held.",
      ),
    },
    {
      q: t("Siapa yang memegang danaku?", "Who holds my funds?"),
      a: t(
        "Kamu. Setiap vault adalah kontrak milikmu sendiri. Cermin Saku hanya bisa mengirim uang saku sebatas izin yang kamu berikan, dan jadwal bisa dibatalkan kapan saja.",
        "You do. Every vault is your own contract. Cermin Saku can only send allowances within the limit you grant, and any schedule can be cancelled at any time.",
      ),
    },
    {
      q: t("Apakah ini layanan pembayaran atau kirim uang?", "Is this a payment or remittance service?"),
      a: t(
        "Bukan. Ini prototipe pengaturan aset kripto yang bisa diprogram, di testnet. Di Indonesia aset kripto bukan alat pembayaran yang sah dan perdagangannya diawasi OJK. Penerima menerima stablecoin, bukan Rupiah; versi sungguhan hanya akan menyalurkan Rupiah lewat mitra berizin.",
        "No. It is a testnet prototype of programmable crypto-asset allocation. In Indonesia crypto assets are not legal tender and their trading is supervised by OJK. The recipient receives a stablecoin, not Rupiah; a real version would deliver Rupiah only through a licensed partner.",
      ),
    },
    {
      q: t("Kenapa di Monad?", "Why Monad?"),
      a: t(
        "Karena uang saku harus datang tepat waktu. Monad membuat blok kira-kira tiap 0,4 detik, jadi penjaga bisa membayar di detik jatuh temponya, dan biayanya cukup kecil untuk mengirim amplop sesering tiap menit. Kontrak menyimpan kapan tiap amplop jatuh tempo dan kapan ia dibayar, jadi ketepatan waktunya bisa dicek siapa pun di halaman demo.",
        "Because an allowance has to arrive on time. Monad makes a block about every 0.4 seconds, so the keeper can pay at the due second, and fees are small enough to send envelopes as often as every minute. The contract stores when each envelope fell due and when it was paid, so anyone can check the punctuality on the demo page.",
      ),
    },
    {
      q: t("Sudah bisa dipakai dengan uang sungguhan?", "Can I use it with real money yet?"),
      a: t(
        "Belum. Saat ini berjalan di Monad testnet dengan dolar dan harga MON tiruan, untuk uji coba. Versi mainnet butuh mitra pinjaman di Monad dan penukaran ke Rupiah.",
        "Not yet. It runs on Monad testnet with test dollars and a simulated MON price. Mainnet needs a lending partner on Monad and a Rupiah off-ramp.",
      ),
    },
  ];
  return (
    <section id="faq" className="relative overflow-hidden py-20 md:py-28 scroll-mt-16">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.55]"
          style={{ backgroundImage: "url(/saku-faq-open-meadow.webp)" }}
        />
        <div className="absolute inset-0 bg-canvas/42" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-canvas to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-canvas to-transparent" />
      </div>
      <div className="relative z-10 mx-auto max-w-3xl px-5 sm:px-8">
        <Reveal className="text-center mb-12 flex flex-col items-center">
          <Eyebrow icon={<HelpCircle className="w-3.5 h-3.5" />} label={t("Tanya jawab", "FAQ")} />
          <h2 className="font-serif text-3xl md:text-[2.75rem] font-medium tracking-[-0.02em] mt-5">
            {t("Yang sering ditanyakan", "Common questions")}
          </h2>
        </Reveal>
        <div className="space-y-3">
          {qs.map((item, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={item.q} delay={i * 50}>
                <div
                  className={`rounded-2xl bg-surface border shadow-soft overflow-hidden transition-colors ${
                    isOpen ? "border-amber-200" : "border-cream-300 hover:border-amber-200"
                  }`}
                >
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-4 p-5 text-left font-medium text-ink"
                  >
                    {item.q}
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 text-amber-500 transition-transform duration-300 ${
                        isOpen ? "rotate-90" : ""
                      }`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.32, ease: EASE_OUT }}
                        className="overflow-hidden"
                      >
                        <p className="text-sm text-muted px-5 pb-5 leading-relaxed">{item.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
