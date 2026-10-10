"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Milliseconds from the moment the wallet handed back a transaction hash
 * (signed and sent) until the app saw its receipt. Measured in the browser,
 * so it includes the RPC round trips, not just block time.
 */
export function useConfirmTimer(hash: `0x${string}` | undefined, confirmed: boolean): number | undefined {
  const sentAt = useRef<{ hash: string; at: number } | null>(null);
  const [ms, setMs] = useState<number>();

  useEffect(() => {
    if (!hash) {
      sentAt.current = null;
      setMs(undefined);
    } else if (sentAt.current?.hash !== hash) {
      sentAt.current = { hash, at: performance.now() };
      setMs(undefined);
    }
  }, [hash]);

  useEffect(() => {
    if (confirmed && sentAt.current && ms === undefined) setMs(Math.round(performance.now() - sentAt.current.at));
  }, [confirmed, ms]);

  return ms;
}
