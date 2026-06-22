"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import type { Hex } from "viem";
import { createConfidentialAirdropClient } from "@tokenops/sdk/fhe-airdrop";
import { useUserDecrypt } from "@zama-fhe/react-sdk";
import { AppShell } from "@/components/AppShell";
import { CanvasBackground } from "@/components/CanvasBackground";
import { useSotto } from "@/context/SottoContext";
import { fmtToken } from "@/lib/format";
import { explorerTx } from "@/lib/constants";
import type { PublicClaim } from "@/lib/types";
import { toast } from "@/components/toast";
import { humanizeError } from "@/components/Faucet";

type ClaimStep = 1 | 2 | 3;

function scramble(target: string, cb: (v: string, done: boolean) => void) {
  const digits = "0123456789";
  let f = 0;
  const max = 22;
  const iv = setInterval(() => {
    f++;
    const lock = Math.floor((f / max) * target.length);
    let str = "";
    for (let i = 0; i < target.length; i++) {
      const ch = target[i];
      if (ch === "," || ch === ".") str += ch;
      else if (i < lock) str += ch;
      else str += digits[Math.floor(Math.random() * 10)];
    }
    if (f >= max) { clearInterval(iv); cb(target, true); } else cb(str, false);
  }, 38);
}

function ClaimCardFull({ claim, onClaimed }: { claim: PublicClaim; onClaimed: (txHash: Hex, amount: string) => void }) {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState<boolean | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [revealHandle, setRevealHandle] = useState<Hex | null>(null);
  const [displayAmt, setDisplayAmt] = useState("•••••••");
  const [localRevealed, setLocalRevealed] = useState(false);

  const decrypt = useUserDecrypt(
    { handles: revealHandle ? [{ handle: revealHandle, contractAddress: claim.airdrop }] : [] },
    { enabled: !!revealHandle },
  );
  const decryptedBig = decrypt.data && revealHandle ? (decrypt.data[revealHandle] as bigint | undefined) : undefined;

  useEffect(() => {
    if (decryptedBig !== undefined && !localRevealed) {
      const target = fmtToken(decryptedBig);
      scramble(target, (v, d) => { setDisplayAmt(v); if (d) setLocalRevealed(true); });
    }
  }, [decryptedBig, localRevealed]);

  // Check claimed status
  useEffect(() => {
    if (!publicClient) return;
    let alive = true;
    (async () => {
      try {
        const client = createConfidentialAirdropClient({ publicClient, address: claim.airdrop });
        const done = await client.isSignatureClaimed(claim.recipient, claim.handle);
        if (alive) setClaimed(done);
      } catch { if (alive) setClaimed(null); }
    })();
    return () => { alive = false; };
  }, [publicClient, claim]);

  async function reveal() {
    if (!publicClient || !walletClient) return;
    setRevealing(true);
    try {
      const client = createConfidentialAirdropClient({ publicClient, walletClient, address: claim.airdrop });
      const { handle } = await client.getClaimAmount({
        encryptedInput: { handle: claim.handle, inputProof: claim.inputProof },
        signature: claim.signature,
      });
      setRevealHandle(handle);
    } catch (e) {
      toast(humanizeError(e), { kind: "error" });
      setRevealing(false);
    }
  }

  async function doClaim() {
    if (!publicClient || !walletClient) return;
    setClaiming(true);
    try {
      const client = createConfidentialAirdropClient({ publicClient, walletClient, address: claim.airdrop });
      const hash = await client.claim({
        encryptedInput: { handle: claim.handle, inputProof: claim.inputProof },
        signature: claim.signature,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setClaimed(true);
      onClaimed(hash, displayAmt);
    } catch (e) {
      toast(humanizeError(e), { kind: "error" });
    } finally {
      setClaiming(false);
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const ended = now > claim.endTime;
  const canClaim = claimed === false && !ended;

  return (
    <div>
      {/* Amount reveal */}
      <div style={{ position: "relative", display: "inline-block", marginBottom: 10 }}>
        {!localRevealed && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%) rotate(-6deg)", fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: ".22em", color: "var(--accent)", border: "2.5px solid var(--accent)", padding: "10px 20px", borderRadius: 2, whiteSpace: "nowrap", zIndex: 2, animation: "glow 2s ease-in-out infinite" }}>
            SEALED · ENCRYPTED
          </div>
        )}
        {localRevealed && (
          <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: "linear-gradient(90deg,transparent,rgba(200,71,43,.6),transparent)", animation: "scanline 1.2s ease both", pointerEvents: "none" }} />
        )}
        <div style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(60px,10vw,120px)", lineHeight: .92, letterSpacing: "-.03em", color: localRevealed ? "var(--ink)" : "var(--soft)", transition: "color .5s ease", animation: localRevealed ? "claimPulse .6s .1s cubic-bezier(.22,.85,.2,1) both" : "none" }}>
          {displayAmt}
        </div>
      </div>
      <div style={{ fontSize: 18, color: "var(--mid)", marginBottom: 40 }}>cUSDT</div>

      {!localRevealed ? (
        <div style={{ maxWidth: 500, margin: "0 auto" }}>
          <button
            className="s-btn"
            onClick={reveal}
            disabled={revealing || decrypt.isFetching}
            style={{ padding: "17px 50px", fontSize: 16, marginBottom: 18 }}
          >
            {revealing || decrypt.isFetching ? "Decrypting…" : "Declassify with my key"}
          </button>
          <p style={{ fontSize: 12.5, color: "var(--soft)", lineHeight: 1.55, maxWidth: 360, margin: "0 auto" }}>
            Your allocation is FHE ciphertext. Decryption happens in your browser — zero data to any server.
          </p>
        </div>
      ) : (
        <div style={{ maxWidth: 500, margin: "0 auto", animation: "popIn .4s cubic-bezier(.22,.85,.2,1) both" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, fontSize: 13.5, color: "var(--green)", fontWeight: 600, marginBottom: 22 }}>
            <span style={{ width: 19, height: 19, borderRadius: "50%", border: "1.5px solid var(--green)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>✓</span>
            Decrypted locally · no server saw this number
          </div>
          {canClaim && (
            <button
              className="s-btn"
              onClick={doClaim}
              disabled={claiming}
              style={{ padding: "17px 50px", fontSize: 16, display: "inline-block" }}
            >
              {claiming ? "Claiming…" : "Claim to wallet →"}
            </button>
          )}
          {claimed === true && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 9, fontSize: 14, color: "var(--green)", fontWeight: 600 }}>
              <span>✓</span> Already claimed
            </div>
          )}
          {ended && claimed !== true && (
            <div style={{ fontSize: 14, color: "var(--soft)" }}>Claim window has closed.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ClaimPage() {
  const { isConnected, address } = useAccount();
  const { openConnectModal } = useConnectModal();
  useSotto(); // dark mode applied globally

  const [claimStep, setClaimStep] = useState<ClaimStep>(1);
  const [checking, setChecking] = useState(true);
  const [claims, setClaims] = useState<PublicClaim[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [claimResult, setClaimResult] = useState<{ txHash: Hex; amount: string } | null>(null);

  useEffect(() => {
    if (!isConnected || !address) return;
    setChecking(true);
    setClaims([]);
    fetch(`/api/claims?recipient=${address}`)
      .then(r => r.json())
      .then(data => { setClaims(Array.isArray(data) ? data : []); })
      .catch(() => setClaims([]))
      .finally(() => setChecking(false));
  }, [isConnected, address]);

  if (!isConnected) {
    return (
      <>
        <AppShell />
        <div style={{ minHeight: "calc(100vh - 56px)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <CanvasBackground variant="flow" />
          <div style={{ textAlign: "center", maxWidth: 400, padding: 40, position: "relative", zIndex: 2 }}>
            <div className="s-label" style={{ marginBottom: 18 }}>Claim an allocation</div>
            <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 46, color: "var(--ink)", margin: 0, letterSpacing: "-.015em" }}>Check eligibility</h2>
            <p style={{ fontSize: 15.5, color: "var(--mid)", margin: "13px auto 0", maxWidth: 390, lineHeight: 1.6 }}>Connect your wallet to see if you have a sealed allocation waiting.</p>
            <div style={{ margin: "34px auto 0", background: "var(--card)", border: "1.5px solid var(--line)", borderRadius: 5, padding: 28 }}>
              <button className="s-btn" onClick={openConnectModal} style={{ width: "100%", justifyContent: "center" }}>
                Connect wallet →
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AppShell />
      <div style={{ minHeight: "calc(100vh - 56px)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <CanvasBackground variant={claimStep === 2 ? "converge" : "flow"} />

        {/* Step 1: eligibility check */}
        {claimStep === 1 && (
          <div style={{ width: "100%", maxWidth: 500, textAlign: "center", padding: "40px 20px", animation: "up .4s cubic-bezier(.22,.85,.2,1) both", position: "relative", zIndex: 2 }}>
            <div className="s-label" style={{ marginBottom: 18 }}>Claim an allocation</div>
            <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 46, color: "var(--ink)", margin: 0, letterSpacing: "-.015em" }}>
              {checking ? "Checking eligibility" : claims.length > 0 ? "You're on the list" : "No allocations found"}
            </h2>
            <p style={{ fontSize: 15.5, color: "var(--mid)", margin: "13px auto 0", maxWidth: 390, lineHeight: 1.6 }}>
              {checking ? "Scanning sealed distributions…" : claims.length > 0 ? "A sealed allocation is waiting for you." : "No distributions found for this wallet."}
            </p>

            <div style={{ margin: "34px auto 0", background: "var(--card)", border: "1.5px solid var(--line)", borderRadius: 5, padding: 28 }}>
              {checking ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 17 }}>
                  <div style={{ width: 42, height: 42, borderRadius: "50%", border: "2px solid var(--line)", borderTopColor: "var(--accent)", animation: "spin .78s linear infinite" }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--mid)" }}>Scanning sealed distributions…</span>
                </div>
              ) : claims.length > 0 ? (
                <div>
                  {claims.length > 1 && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto" }}>
                      {claims.map((c, i) => (
                        <div key={i} onClick={() => setActiveIdx(i)} style={{ padding: "6px 12px", borderRadius: 3, background: activeIdx === i ? "rgba(200,71,43,.15)" : "var(--card)", border: `1.5px solid ${activeIdx === i ? "rgba(200,71,43,.65)" : "var(--line)"}`, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                          {c.name || `Distribution ${i + 1}`}
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontFamily: "var(--font-serif)", fontSize: 23, color: "var(--ink)" }}>{claims[activeIdx]?.name || "Distribution"}</div>
                      <div style={{ fontSize: 13, color: "var(--mid)", marginTop: 3 }}>Sealed allocation · ready to reveal</div>
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--green)", border: "1px solid var(--green)", padding: "5px 9px", borderRadius: 2 }}>ELIGIBLE</span>
                  </div>
                  <button className="s-btn" style={{ width: "100%", justifyContent: "center", fontSize: 15 }} onClick={() => setClaimStep(2)}>
                    Declassify my allocation →
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14, color: "var(--mid)", marginBottom: 16 }}>No distributions found for this wallet address.</div>
                  <div style={{ fontSize: 13, color: "var(--soft)" }}>Ask your distributor to share the claim link with you directly.</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: reveal + claim */}
        {claimStep === 2 && claims[activeIdx] && (
          <div style={{ width: "100%", textAlign: "center", padding: "60px 40px", animation: "slideUp .45s cubic-bezier(.22,.85,.2,1) both", position: "relative", zIndex: 2 }}>
            <div className="s-label" style={{ marginBottom: 24 }}>
              {claims[activeIdx]?.name || "Distribution"} · Your sealed allocation
            </div>
            <ClaimCardFull
              claim={claims[activeIdx]}
              onClaimed={(txHash, amount) => {
                setClaimResult({ txHash, amount });
                setClaimStep(3);
              }}
            />
          </div>
        )}

        {/* Step 3: claimed receipt */}
        {claimStep === 3 && claimResult && (
          <div style={{ width: "100%", maxWidth: 540, textAlign: "center", padding: "60px 20px", animation: "up .5s cubic-bezier(.22,.85,.2,1) both", position: "relative", zIndex: 2 }}>
            <div style={{ marginBottom: 26 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: ".22em", color: "var(--green)", border: "2px solid var(--green)", padding: "8px 17px", borderRadius: 2, transform: "rotate(-3deg)", display: "inline-block", animation: "stampThud .7s .1s both", boxShadow: "0 3px 14px rgba(111,175,142,.28)" }}>CLAIMED</div>
            </div>
            <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 54, color: "var(--ink)", margin: 0, letterSpacing: "-.02em", lineHeight: 1.05 }}>
              {claimResult.amount} cUSDT<br />is yours.
            </h2>
            <p style={{ fontSize: 15.5, color: "var(--mid)", margin: "16px auto 0", maxWidth: 400, lineHeight: 1.6, fontWeight: 300 }}>
              Transferred as a confidential balance. Your allocation never appeared in plaintext on the public record.
            </p>
            <div style={{ marginTop: 16 }}>
              <a href={explorerTx(claimResult.txHash)} target="_blank" rel="noreferrer" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)", textDecoration: "none" }}>
                {claimResult.txHash.slice(0, 10)}…{claimResult.txHash.slice(-6)} ↗
              </a>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 32 }}>
              <button className="s-btn" onClick={() => { setClaimStep(1); setClaimResult(null); setChecking(true); fetch(`/api/claims?recipient=${address}`).then(r => r.json()).then(d => setClaims(Array.isArray(d) ? d : [])).finally(() => setChecking(false)); }} style={{ fontSize: 15, padding: "13px 30px" }}>
                Done
              </button>
              <div onClick={() => window.location.href = "/dashboard"} style={{ border: "1.5px solid var(--line)", color: "var(--mid)", padding: "13px 24px", borderRadius: 3, fontSize: 15, fontWeight: 500, cursor: "pointer" }}>Distributions</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
