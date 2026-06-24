"use client";

import { useEffect, useState } from "react";
import { usePublicClient, useAccount } from "wagmi";
import type { Hex } from "viem";
import { useUserDecrypt } from "@zama-fhe/react-sdk";
import { wrapperAbi } from "@/lib/abi";
import { CUSDT } from "@/lib/constants";
import { fmtToken } from "@/lib/format";

const ZERO_HANDLE =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Confidential balance card.
 * `refreshSignal` — parent bumps this (e.g. after a claim) to re-read the
 * on-chain balance handle, since claiming produces a NEW ciphertext handle.
 */
export function BalanceCard({ refreshSignal = 0 }: { refreshSignal?: number }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [handle, setHandle] = useState<Hex | null>(null);
  const [reveal, setReveal] = useState(false);
  const [bump, setBump] = useState(0); // local manual refresh

  // Re-read the balance handle whenever address, the parent signal, or a manual
  // refresh changes. The handle changes after every confidential transfer/claim.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!publicClient || !address) return;
      try {
        const h = (await publicClient.readContract({
          address: CUSDT.wrapper,
          abi: wrapperAbi,
          functionName: "confidentialBalanceOf",
          args: [address],
        })) as Hex;
        if (alive) {
          setHandle((prev) => {
            // If the handle changed, drop any stale reveal so we decrypt fresh.
            if (prev && prev !== h) setReveal(false);
            return h;
          });
        }
      } catch {
        if (alive) setHandle(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [publicClient, address, refreshSignal, bump]);

  const hasBalance = handle && handle !== ZERO_HANDLE;

  const decrypt = useUserDecrypt(
    { handles: reveal && hasBalance ? [{ handle: handle!, contractAddress: CUSDT.wrapper }] : [] },
    { enabled: reveal && !!hasBalance },
  );
  const value = decrypt.data && handle ? decrypt.data[handle] : undefined;

  function refresh() {
    setReveal(false);
    setBump((b) => b + 1);
  }

  return (
    <div className="cd-card" style={{ padding: "1.25rem 1.35rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            Confidential {CUSDT.symbol} balance
          </div>
          <div style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>
            Total across claims and direct disperses.
          </div>
        </div>

        {value !== undefined ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {fmtToken(BigInt(value as bigint))}
            </div>
            <button
              className="cd-btn cd-btn-ghost"
              onClick={refresh}
              title="Re-read balance from chain"
              style={{ fontFamily: "var(--font-mono)", fontSize: 12, padding: "6px 10px" }}
            >
              ↻
            </button>
          </div>
        ) : decrypt.isError && reveal ? (
          <button
            className="cd-btn cd-btn-ghost"
            onClick={refresh}
            style={{ color: "var(--accent)" }}
          >
            ⚠ Retry decrypt
          </button>
        ) : hasBalance ? (
          <button
            className="cd-btn cd-btn-ghost"
            onClick={() => setReveal(true)}
            disabled={decrypt.isFetching}
          >
            {decrypt.isFetching ? "Decrypting…" : "🔓 Reveal balance"}
          </button>
        ) : (
          <button
            className="cd-btn cd-btn-ghost"
            onClick={refresh}
            title="Re-check balance"
            style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
          >
            <span className="cd-badge">No balance yet</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>↻</span>
          </button>
        )}
      </div>
    </div>
  );
}
