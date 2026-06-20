"use client";

import { ConnectGate } from "@/components/ConnectGate";
import { ClaimPortal } from "@/components/claim/ClaimPortal";

export default function ClaimPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "1.5rem 1.25rem 4rem" }}>
      <h1 style={{ fontSize: 26, margin: "0 0 4px", letterSpacing: -0.5 }}>
        Your allocations
      </h1>
      <p style={{ color: "var(--fg-muted)", margin: "0 0 1.25rem", fontSize: 14.5 }}>
        Connect your wallet to reveal and claim confidential allocations. Only you
        can decrypt your own amounts.
      </p>
      <ConnectGate>
        <ClaimPortal />
      </ConnectGate>
    </div>
  );
}
