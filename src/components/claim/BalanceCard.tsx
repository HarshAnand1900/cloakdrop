"use client";

import { useEffect, useState } from "react";
import { useConfidentialBalance } from "@zama-fhe/react-sdk";
import { CUSDT } from "@/lib/constants";
import { fmtToken } from "@/lib/format";

/**
 * Confidential balance card.
 * Uses the SDK's `useConfidentialBalance`, which reads the on-chain handle AND
 * decrypts it in one step — always against the latest handle, so it reflects
 * new claims / disperses. Gated behind a "Reveal" click for privacy; the
 * relayer is only hit once the user opts in.
 *
 * `refreshSignal` — parent bumps this (e.g. after a claim) to force a re-read.
 */
export function BalanceCard({ refreshSignal = 0 }: { refreshSignal?: number }) {
  const [reveal, setReveal] = useState(false);

  const { data: balance, isFetching, isError, refetch } = useConfidentialBalance(
    { tokenAddress: CUSDT.wrapper },
    { enabled: reveal },
  );

  // After a claim/disperse the parent bumps refreshSignal — re-pull the balance.
  useEffect(() => {
    if (reveal && refreshSignal > 0) refetch();
  }, [refreshSignal, reveal, refetch]);

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

        {balance !== undefined ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {fmtToken(balance)}
            </div>
            <button
              className="cd-btn cd-btn-ghost"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Re-read balance from chain"
              style={{ fontFamily: "var(--font-mono)", fontSize: 12, padding: "6px 10px" }}
            >
              {isFetching ? "…" : "↻"}
            </button>
          </div>
        ) : isError && reveal ? (
          <button className="cd-btn cd-btn-ghost" onClick={() => refetch()} style={{ color: "var(--accent)" }}>
            ⚠ Retry decrypt
          </button>
        ) : (
          <button
            className="cd-btn cd-btn-ghost"
            onClick={() => setReveal(true)}
            disabled={isFetching}
          >
            {isFetching ? "Decrypting…" : "🔓 Reveal balance"}
          </button>
        )}
      </div>
    </div>
  );
}
