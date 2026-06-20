"use client";

import { useState } from "react";
import { ConnectGate } from "@/components/ConnectGate";
import { Faucet } from "@/components/Faucet";
import { AirdropForm } from "@/components/distribute/AirdropForm";
import { DisperseForm } from "@/components/distribute/DisperseForm";

type Tab = "airdrop" | "disperse";

export default function DistributePage() {
  const [tab, setTab] = useState<Tab>("airdrop");

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "1.5rem 1.25rem 4rem" }}>
      <h1 style={{ fontSize: 26, margin: "0 0 4px", letterSpacing: -0.5 }}>
        Distributor console
      </h1>
      <p style={{ color: "var(--fg-muted)", margin: "0 0 1.25rem", fontSize: 14.5 }}>
        Create a confidential airdrop recipients can claim, or push encrypted
        amounts directly in a single transaction.
      </p>

      <ConnectGate>
        <div style={{ marginBottom: 16 }}>
          <Faucet />
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "inline-flex",
            gap: 4,
            padding: 4,
            borderRadius: 12,
            background: "var(--bg-elev)",
            border: "1px solid var(--border-soft)",
            marginBottom: 18,
          }}
        >
          <TabButton active={tab === "airdrop"} onClick={() => setTab("airdrop")}>
            🪂 Airdrop (claim-based)
          </TabButton>
          <TabButton active={tab === "disperse"} onClick={() => setTab("disperse")}>
            📦 Disperse (direct push)
          </TabButton>
        </div>

        <div
          className="cd-card"
          style={{
            padding: "0.9rem 1rem",
            marginBottom: 18,
            fontSize: 13,
            color: "var(--fg-muted)",
            display: "flex",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 16 }}>{tab === "airdrop" ? "💡" : "💡"}</span>
          <span>
            {tab === "airdrop"
              ? "Best when recipients are many or unknown. Each allocation is encrypted to its recipient and signature-gated — recipients pull their tokens when ready."
              : "Best for a known list you want to pay immediately. Encrypted amounts are transferred straight to each recipient's confidential balance in one transaction."}
          </span>
        </div>

        {tab === "airdrop" ? <AirdropForm /> : <DisperseForm />}
      </ConnectGate>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        border: "none",
        cursor: "pointer",
        padding: "0.5rem 0.9rem",
        borderRadius: 9,
        fontSize: 13.5,
        fontWeight: 600,
        background: active ? "var(--panel-2)" : "transparent",
        color: active ? "var(--fg)" : "var(--fg-muted)",
      }}
    >
      {children}
    </button>
  );
}
