"use client";

import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CHAIN_ID } from "@/lib/constants";
import type { ReactNode } from "react";

export function ConnectGate({ children }: { children: ReactNode }) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  if (!isConnected) {
    return (
      <div
        className="cd-card cd-fade"
        style={{ padding: "2.5rem", textAlign: "center", maxWidth: 440, margin: "3rem auto" }}
      >
        <div style={{ fontSize: 30, marginBottom: 12 }}>🔌</div>
        <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>Connect your wallet</h2>
        <p style={{ color: "var(--fg-muted)", fontSize: 14, margin: "0 0 1.2rem" }}>
          Connect a Sepolia wallet to continue.
        </p>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <ConnectButton />
        </div>
      </div>
    );
  }

  if (chainId !== CHAIN_ID) {
    return (
      <div
        className="cd-card cd-fade"
        style={{ padding: "2.5rem", textAlign: "center", maxWidth: 440, margin: "3rem auto" }}
      >
        <div style={{ fontSize: 30, marginBottom: 12 }}>🌐</div>
        <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>Wrong network</h2>
        <p style={{ color: "var(--fg-muted)", fontSize: 14, margin: "0 0 1.2rem" }}>
          Cloakdrop runs on Sepolia. Switch networks to continue.
        </p>
        <button
          className="cd-btn cd-btn-primary"
          onClick={() => switchChain({ chainId: CHAIN_ID })}
        >
          Switch to Sepolia
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
