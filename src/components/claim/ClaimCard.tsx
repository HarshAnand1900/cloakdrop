"use client";

import { useEffect, useState } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import type { Hex } from "viem";
import { createConfidentialAirdropClient } from "@tokenops/sdk/fhe-airdrop";
import { useUserDecrypt } from "@zama-fhe/react-sdk";
import type { PublicClaim } from "@/lib/types";
import { fmtToken, shortAddr } from "@/lib/format";
import { explorerTx, explorerAddr, CUSDT } from "@/lib/constants";
import { toast } from "../toast";
import { humanizeError } from "../Faucet";

export function ClaimCard({ claim }: { claim: PublicClaim }) {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [claimed, setClaimed] = useState<boolean | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimTx, setClaimTx] = useState<Hex | null>(null);

  const [revealing, setRevealing] = useState(false);
  const [revealHandle, setRevealHandle] = useState<Hex | null>(null);

  // Decrypt query — enabled once we hold an ACL-granted handle.
  const decrypt = useUserDecrypt(
    { handles: revealHandle ? [{ handle: revealHandle, contractAddress: claim.airdrop }] : [] },
    { enabled: !!revealHandle },
  );
  const revealed =
    decrypt.data && revealHandle ? decrypt.data[revealHandle] : undefined;

  // Initial claimed-status check.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!publicClient) return;
      try {
        const client = createConfidentialAirdropClient({
          publicClient,
          address: claim.airdrop,
        });
        const done = await client.isSignatureClaimed(claim.recipient, claim.handle);
        if (alive) setClaimed(done);
      } catch {
        if (alive) setClaimed(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [publicClient, claim.airdrop, claim.recipient, claim.handle]);

  async function reveal() {
    if (!publicClient || !walletClient) return;
    setRevealing(true);
    try {
      const client = createConfidentialAirdropClient({
        publicClient,
        walletClient,
        address: claim.airdrop,
      });
      // Write tx: grants this caller ACL on the encrypted amount, returns handle.
      const { handle } = await client.getClaimAmount({
        encryptedInput: { handle: claim.handle, inputProof: claim.inputProof },
        signature: claim.signature,
      });
      setRevealHandle(handle); // enables the decrypt query (prompts a signature)
    } catch (e) {
      toast(humanizeError(e), { kind: "error" });
      setRevealing(false);
    }
  }

  async function doClaim() {
    if (!publicClient || !walletClient) return;
    setClaiming(true);
    try {
      const client = createConfidentialAirdropClient({
        publicClient,
        walletClient,
        address: claim.airdrop,
      });
      const hash = await client.claim({
        encryptedInput: { handle: claim.handle, inputProof: claim.inputProof },
        signature: claim.signature,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setClaimTx(hash);
      setClaimed(true);
      toast("Claimed! Tokens are in your confidential balance.", {
        kind: "success",
        href: explorerTx(hash),
        hrefLabel: "View claim tx ↗",
      });
    } catch (e) {
      toast(humanizeError(e), { kind: "error" });
    } finally {
      setClaiming(false);
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const ended = now > claim.endTime;

  return (
    <div className="cd-card cd-fade" style={{ padding: "1.25rem 1.35rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{claim.name}</div>
          <a
            className="cd-link cd-mono"
            href={explorerAddr(claim.airdrop)}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 12 }}
          >
            {shortAddr(claim.airdrop, 5)}
          </a>
        </div>
        {claimed === true ? (
          <span className="cd-badge cd-badge-ok">✓ Claimed</span>
        ) : ended ? (
          <span className="cd-badge cd-badge-warn">Window closed</span>
        ) : (
          <span className="cd-badge cd-badge-accent">Unclaimed</span>
        )}
      </div>

      {/* Allocation reveal */}
      <div
        style={{
          margin: "14px 0",
          padding: "0.9rem 1rem",
          background: "var(--bg-elev)",
          border: "1px solid var(--border-soft)",
          borderRadius: 12,
        }}
      >
        <div style={{ fontSize: 11.5, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
          Your allocation
        </div>
        {revealed !== undefined ? (
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>
            {fmtToken(BigInt(revealed as bigint))}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="cd-mono" style={{ fontSize: 18, color: "var(--fg-faint)", letterSpacing: 2 }}>
              •••••• {CUSDT.symbol}
            </span>
            <button
              className="cd-btn cd-btn-ghost"
              style={{ fontSize: 12.5, padding: "0.4rem 0.7rem" }}
              onClick={reveal}
              disabled={revealing || decrypt.isFetching}
            >
              {revealing || decrypt.isFetching ? "Decrypting…" : "🔓 Reveal my amount"}
            </button>
          </div>
        )}
        {revealed !== undefined && (
          <div style={{ fontSize: 11.5, color: "var(--fg-faint)", marginTop: 4 }}>
            Visible only to you — decrypted locally with your wallet.
          </div>
        )}
      </div>

      {/* Claim action */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          className="cd-btn cd-btn-primary"
          onClick={doClaim}
          disabled={claiming || claimed === true || ended}
          style={{ flex: 1 }}
        >
          {claiming ? "Claiming…" : claimed === true ? "Already claimed" : "Claim tokens"}
        </button>
        {claimTx && (
          <a className="cd-link" href={explorerTx(claimTx)} target="_blank" rel="noreferrer" style={{ fontSize: 12.5 }}>
            Tx ↗
          </a>
        )}
      </div>
    </div>
  );
}
