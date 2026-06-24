"use client";

import { useState } from "react";
import { usePublicClient, useWalletClient, useAccount } from "wagmi";
import { parseUnits } from "viem";
import { CUSDT, explorerTx } from "@/lib/constants";
import { underlyingAbi, wrapperAbi } from "@/lib/abi";
import { toast } from "./toast";

const MINT_AMOUNT = "10000"; // human units

export function Faucet({ onFunded }: { onFunded?: () => void }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [busy, setBusy] = useState<string | null>(null);

  async function getFunds() {
    if (!address || !walletClient || !publicClient) return;
    const amount = parseUnits(MINT_AMOUNT, CUSDT.decimals);
    try {
      // Gas saver: only mint if the wallet doesn't already hold enough underlying.
      let balance = 0n;
      try {
        balance = (await publicClient.readContract({
          address: CUSDT.underlying, abi: underlyingAbi, functionName: "balanceOf", args: [address],
        })) as bigint;
      } catch { /* assume 0 */ }
      if (balance < amount) {
        setBusy("Minting test USDT…");
        const mintHash = await walletClient.writeContract({
          address: CUSDT.underlying,
          abi: underlyingAbi,
          functionName: "mint",
          args: [address, amount],
        });
        await publicClient.waitForTransactionReceipt({ hash: mintHash });
      }

      // Gas saver: only approve if current allowance is insufficient.
      let allowance = 0n;
      try {
        allowance = (await publicClient.readContract({
          address: CUSDT.underlying, abi: underlyingAbi, functionName: "allowance", args: [address, CUSDT.wrapper],
        })) as bigint;
      } catch { /* assume 0 */ }
      if (allowance < amount) {
        setBusy("Approving wrapper…");
        const approveHash = await walletClient.writeContract({
          address: CUSDT.underlying,
          abi: underlyingAbi,
          functionName: "approve",
          args: [CUSDT.wrapper, amount],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      setBusy("Wrapping into confidential cUSDT…");
      const wrapHash = await walletClient.writeContract({
        address: CUSDT.wrapper,
        abi: wrapperAbi,
        functionName: "wrap",
        args: [address, amount],
      });
      await publicClient.waitForTransactionReceipt({ hash: wrapHash });

      toast(`Received ${MINT_AMOUNT} confidential ${CUSDT.symbol}`, {
        kind: "success",
        href: explorerTx(wrapHash),
        hrefLabel: "View wrap tx ↗",
      });
      onFunded?.();
    } catch (e) {
      toast(humanizeError(e), { kind: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="cd-card"
      style={{
        padding: "1rem 1.1rem",
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Need test funds?</div>
        <div style={{ color: "var(--fg-muted)", fontSize: 12.5 }}>
          Mint {MINT_AMOUNT} {CUSDT.symbol} and wrap it into a confidential balance to fund a distribution.
        </div>
      </div>
      <button
        className="cd-btn cd-btn-ghost"
        onClick={getFunds}
        disabled={!!busy}
      >
        {busy ? (
          <>
            <Spinner /> {busy}
          </>
        ) : (
          `Get ${MINT_AMOUNT} test ${CUSDT.symbol}`
        )}
      </button>
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="cd-spin"
      style={{
        width: 13,
        height: 13,
        border: "2px solid rgba(255,255,255,0.3)",
        borderTopColor: "white",
        borderRadius: "50%",
        display: "inline-block",
      }}
    />
  );
}

export function humanizeError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/User rejected|denied|rejected the request|aborted a request|user denied/i.test(msg))
    return "Wallet request rejected — click 'Encrypt & seal onchain' to try again.";
  if (/insufficient funds/i.test(msg))
    return "Insufficient ETH for gas. Get Sepolia ETH from a faucet.";
  if (/network.*changed|chain.*changed/i.test(msg))
    return "Network changed mid-transaction — switch back to Sepolia and retry.";
  if (/timeout|timed out/i.test(msg))
    return "Request timed out — check your connection and retry.";
  // Grab the first sentence to keep toasts short.
  return msg.split("\n")[0].slice(0, 160);
}
