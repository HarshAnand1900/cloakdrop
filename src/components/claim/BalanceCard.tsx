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

export function BalanceCard() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [handle, setHandle] = useState<Hex | null>(null);
  const [reveal, setReveal] = useState(false);

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
        if (alive) setHandle(h);
      } catch {
        if (alive) setHandle(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [publicClient, address]);

  const hasBalance = handle && handle !== ZERO_HANDLE;

  const decrypt = useUserDecrypt(
    { handles: reveal && hasBalance ? [{ handle: handle!, contractAddress: CUSDT.wrapper }] : [] },
    { enabled: reveal && !!hasBalance },
  );
  const value = decrypt.data && handle ? decrypt.data[handle] : undefined;

  return (
    <div className="cd-card" style={{ padding: "1.25rem 1.35rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            Confidential {CUSDT.symbol} balance
          </div>
          <div style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>
            Includes tokens received via direct disperse.
          </div>
        </div>
        {value !== undefined ? (
          <div style={{ fontSize: 22, fontWeight: 800 }}>
            {fmtToken(BigInt(value as bigint))}
          </div>
        ) : hasBalance ? (
          <button
            className="cd-btn cd-btn-ghost"
            onClick={() => setReveal(true)}
            disabled={decrypt.isFetching}
          >
            {decrypt.isFetching ? "Decrypting…" : "🔓 Reveal balance"}
          </button>
        ) : (
          <span className="cd-badge">No balance yet</span>
        )}
      </div>
    </div>
  );
}
