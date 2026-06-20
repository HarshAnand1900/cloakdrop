"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import type { PublicClaim } from "@/lib/types";
import { ClaimCard } from "./ClaimCard";
import { BalanceCard } from "./BalanceCard";

export function ClaimPortal() {
  const { address } = useAccount();
  const [claims, setClaims] = useState<PublicClaim[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setClaims(null);
    setError(null);
    (async () => {
      if (!address) return;
      try {
        const res = await fetch(`/api/claims?recipient=${address}`);
        if (!res.ok) throw new Error("Lookup failed");
        const data = (await res.json()) as { claims: PublicClaim[] };
        if (alive) setClaims(data.claims);
      } catch {
        if (alive) setError("Could not load your allocations. Try again.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [address]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <BalanceCard />

      <div>
        <h2 style={{ fontSize: 16, margin: "0.5rem 0 0.75rem", color: "var(--fg-muted)" }}>
          Airdrop allocations
        </h2>

        {claims === null && !error && (
          <div className="cd-card" style={{ padding: "1.5rem", textAlign: "center", color: "var(--fg-muted)", fontSize: 14 }}>
            <span className="cd-spin" style={{ display: "inline-block", width: 16, height: 16, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", marginRight: 8, verticalAlign: "middle" }} />
            Checking for your allocations…
          </div>
        )}

        {error && (
          <div className="cd-card" style={{ padding: "1.5rem", textAlign: "center", color: "var(--danger)", fontSize: 14 }}>
            {error}
          </div>
        )}

        {claims && claims.length === 0 && (
          <div className="cd-card" style={{ padding: "2rem", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
            <div style={{ fontWeight: 600 }}>No airdrop allocations found</div>
            <div style={{ color: "var(--fg-muted)", fontSize: 13.5, marginTop: 4 }}>
              This wallet has no claimable airdrops. If you were expecting one, double-check you connected the right address.
            </div>
          </div>
        )}

        {claims && claims.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {claims.map((c) => (
              <ClaimCard key={c.airdrop} claim={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
