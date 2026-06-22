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

  // Read ?id= param for direct claim links
  const [preselectedId, setPreselectedId] = useState<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) setPreselectedId(id.toLowerCase());
  }, []);

  const [claimStep, setClaimStep] = useState<ClaimStep>(1);
  const [checking, setChecking] = useState(true);
  const [claims, setClaims] = useState<PublicClaim[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [claimResult, setClaimResult] = useState<{ txHash: Hex; amount: string; admin?: string; airdrop?: string } | null>(null);

  function loadClaims(addr: string) {
    setChecking(true);
    setClaims([]);
    fetch(`/api/claims?recipient=${addr}`)
      .then(r => r.json())
      .then(data => {
        const all: PublicClaim[] = Array.isArray(data?.claims) ? data.claims : Array.isArray(data) ? data : [];
        setClaims(all);
        // Pre-select the ?id= distribution if present
        if (preselectedId) {
          const idx = all.findIndex(c => c.airdrop.toLowerCase() === preselectedId);
          if (idx >= 0) { setActiveIdx(idx); setClaimStep(2); }
        }
      })
      .catch(() => setClaims([]))
      .finally(() => setChecking(false));
  }

  useEffect(() => {
    if (!isConnected || !address) return;
    loadClaims(address);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address, preselectedId]);

  // Fire webhook after successful claim
  async function fireWebhook(admin: string, airdrop: string, recipient: string) {
    try {
      await fetch("/api/webhook", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ admin, distribution: airdrop, recipient, token: "cUSDT" }),
      });
    } catch { /* webhook fire is best-effort */ }
  }

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
          <div style={{ width: "100%", maxWidth: 960, padding: "48px 24px", animation: "up .4s cubic-bezier(.22,.85,.2,1) both", position: "relative", zIndex: 2, display: "grid", gridTemplateColumns: checking || claims.length === 0 ? "1fr" : "1fr 1fr", gap: 32, alignItems: "start" }}>
            {/* Left: status + actions */}
            <div style={{ textAlign: checking || claims.length === 0 ? "center" : "left" }}>
              <div className="s-label" style={{ marginBottom: 18 }}>Claim an allocation</div>
              <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 46, color: "var(--ink)", margin: 0, letterSpacing: "-.015em" }}>
                {checking ? "Checking eligibility" : claims.length > 0 ? "You're on the list" : "No allocations found"}
              </h2>
              <p style={{ fontSize: 15.5, color: "var(--mid)", margin: "13px 0 0", lineHeight: 1.6 }}>
                {checking
                  ? "Scanning sealed distributions for your address…"
                  : claims.length > 0
                  ? `${claims.length} sealed allocation${claims.length > 1 ? "s are" : " is"} waiting for you.`
                  : "No sealed distributions found for this wallet."}
              </p>

              <div style={{ marginTop: 28, background: "var(--card)", border: "1.5px solid var(--line)", borderRadius: 5, padding: 24 }}>
                {checking ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 17, padding: "8px 0" }}>
                    <div style={{ width: 42, height: 42, borderRadius: "50%", border: "2px solid var(--line)", borderTopColor: "var(--accent)", animation: "spin .78s linear infinite" }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--mid)" }}>Proving membership without revealing the full list…</span>
                  </div>
                ) : claims.length > 0 ? (
                  <div>
                    {claims.length > 1 && (
                      <div style={{ display: "flex", gap: 8, marginBottom: 18, overflowX: "auto", flexWrap: "wrap" }}>
                        {claims.map((c, i) => (
                          <div key={i} onClick={() => setActiveIdx(i)} style={{ padding: "6px 12px", borderRadius: 3, background: activeIdx === i ? "rgba(200,71,43,.15)" : "var(--overlay)", border: `1.5px solid ${activeIdx === i ? "rgba(200,71,43,.65)" : "var(--line)"}`, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                            {c.name || `Distribution ${i + 1}`}
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                      <div>
                        <div style={{ fontFamily: "var(--font-serif)", fontSize: 23, color: "var(--ink)" }}>{claims[activeIdx]?.name || "Distribution"}</div>
                        <div style={{ fontSize: 13, color: "var(--mid)", marginTop: 3 }}>
                          {claims[activeIdx] && new Date(claims[activeIdx].endTime * 1000) > new Date()
                            ? `Claim window open · closes ${new Date(claims[activeIdx].endTime * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                            : "Claim window closed"}
                        </div>
                      </div>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--green)", border: "1px solid var(--green)", padding: "5px 9px", borderRadius: 2, flexShrink: 0 }}>ELIGIBLE</span>
                    </div>
                    <button className="s-btn" style={{ width: "100%", justifyContent: "center", fontSize: 15 }} onClick={() => setClaimStep(2)}>
                      Declassify my allocation →
                    </button>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "8px 0" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
                    <div style={{ fontSize: 14, color: "var(--mid)", marginBottom: 12, lineHeight: 1.55 }}>
                      No sealed distributions were found for<br />
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--soft)" }}>{address?.slice(0,10)}…{address?.slice(-6)}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--soft)", lineHeight: 1.55, marginBottom: 18 }}>
                      Ask your distributor to share the direct claim link, or check that you&apos;re connected with the right wallet.
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                      <button onClick={() => { if (address) loadClaims(address); }} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", border: "1px solid rgba(200,71,43,.4)", padding: "7px 14px", borderRadius: 2, background: "transparent", cursor: "pointer" }}>
                        ↻ Refresh
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: how it works — only show when eligible */}
            {!checking && claims.length > 0 && (
              <div style={{ animation: "slideL .4s cubic-bezier(.22,.85,.2,1) both" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 18 }}>How claiming works</div>
                {[
                  { n: "01", title: "Prove your key", desc: "Your wallet signs a message to prove you're the rightful recipient — no amount is revealed yet." },
                  { n: "02", title: "Decrypt locally", desc: "Your allocation is decrypted inside your browser using your private key. No server sees the number." },
                  { n: "03", title: "Claim to wallet", desc: "A single transaction moves the sealed amount into your confidential balance on-chain." },
                ].map(step => (
                  <div key={step.n} style={{ display: "flex", gap: 16, marginBottom: 22 }}>
                    <div style={{ fontFamily: "var(--font-serif)", fontSize: 32, color: "var(--line)", lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{step.n}</div>
                    <div>
                      <div style={{ fontFamily: "var(--font-serif)", fontSize: 19, color: "var(--ink)", marginBottom: 5 }}>{step.title}</div>
                      <div style={{ fontSize: 13.5, color: "var(--mid)", lineHeight: 1.6 }}>{step.desc}</div>
                    </div>
                  </div>
                ))}
                <div style={{ padding: "14px 16px", background: "rgba(200,71,43,.06)", border: "1.5px solid rgba(200,71,43,.2)", borderRadius: 3, marginTop: 8 }}>
                  <div style={{ fontSize: 12.5, color: "var(--mid)", lineHeight: 1.55 }}>
                    🔒 Your amount is <strong style={{ color: "var(--ink)" }}>FHE ciphertext</strong> — not a display trick. No one except you can see it, not even the distributor.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: reveal + claim */}
        {claimStep === 2 && claims[activeIdx] && (
          <div style={{ width: "100%", maxWidth: 960, padding: "48px 24px", animation: "slideUp .45s cubic-bezier(.22,.85,.2,1) both", position: "relative", zIndex: 2, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, alignItems: "start" }}>
            {/* Left: the ClaimCard */}
            <div style={{ textAlign: "center" }}>
              <div className="s-label" style={{ marginBottom: 20 }}>
                {claims[activeIdx]?.name} · Your sealed allocation
              </div>
              <ClaimCardFull
                claim={claims[activeIdx]}
                onClaimed={(txHash, amount) => {
                  const c = claims[activeIdx];
                  setClaimResult({ txHash, amount, airdrop: c.airdrop });
                  setClaimStep(3);
                  fetch(`/api/campaigns?airdrop=${c.airdrop}`)
                    .then(r => r.json())
                    .then(d => { if (d?.campaign?.admin) fireWebhook(d.campaign.admin, c.airdrop, c.recipient); })
                    .catch(() => {});
                }}
              />
              <button onClick={() => setClaimStep(1)} style={{ marginTop: 20, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--soft)", background: "none", border: "none", cursor: "pointer" }}>
                ← Back to distributions
              </button>
            </div>

            {/* Right: distribution info */}
            <div style={{ animation: "slideL .4s .1s cubic-bezier(.22,.85,.2,1) both" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 16 }}>Distribution details</div>
              <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 4, padding: "6px 20px", marginBottom: 16 }}>
                {[
                  ["Distribution", claims[activeIdx]?.name || "—"],
                  ["Token", claims[activeIdx]?.symbol || "cUSDT"],
                  ["Claim window", claims[activeIdx] ? new Date(claims[activeIdx].endTime * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"],
                  ["Encryption", "FHE · euint64 · TFHE"],
                  ["Privacy", "Only you can decrypt"],
                ].map(([k, v], i, arr) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--soft)" }}>{k}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)" }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ padding: "14px 16px", background: "repeating-linear-gradient(0deg,rgba(18,16,13,.012) 0,rgba(18,16,13,.012) 1px,transparent 1px,transparent 26px),#F7F3E9", border: "1px solid rgba(18,16,13,.1)", borderRadius: 4 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#8A8273", marginBottom: 8 }}>What the blockchain shows</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "#4A4438", lineHeight: 1.6 }}>
                  to: <span style={{ color: "#12100D" }}>{address?.slice(0, 10)}…</span><br />
                  amount: <span style={{ color: "#C8472B" }}>0x7f3a8b2c4e9d… [FHE]</span>
                </div>
                <div style={{ fontSize: 11, color: "#8A8273", marginTop: 8, fontStyle: "italic", fontFamily: "var(--font-serif)" }}>This is exactly what Etherscan shows anyone.</div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: claimed receipt */}
        {claimStep === 3 && claimResult && (
          <div style={{ width: "100%", maxWidth: 580, textAlign: "center", padding: "60px 20px", animation: "up .5s cubic-bezier(.22,.85,.2,1) both", position: "relative", zIndex: 2 }}>
            <div style={{ marginBottom: 26 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: ".22em", color: "var(--green)", border: "2px solid var(--green)", padding: "8px 17px", borderRadius: 2, transform: "rotate(-3deg)", display: "inline-block", animation: "stampThud .7s .1s both", boxShadow: "0 3px 14px rgba(111,175,142,.28)" }}>CLAIMED</div>
            </div>
            <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 54, color: "var(--ink)", margin: 0, letterSpacing: "-.02em", lineHeight: 1.05 }}>
              {claimResult.amount} cUSDT<br />is yours.
            </h2>
            <p style={{ fontSize: 15.5, color: "var(--mid)", margin: "16px auto 0", maxWidth: 400, lineHeight: 1.6, fontWeight: 300 }}>
              Transferred as a confidential balance. Your allocation never appeared in plaintext on the public record.
            </p>

            {/* Receipt card */}
            <div style={{ maxWidth: 420, margin: "28px auto 0", background: "var(--card)", border: "1.5px solid var(--line)", borderRadius: 4, padding: "6px 20px", textAlign: "left" }}>
              {[
                ["Claim tx", `${claimResult.txHash.slice(0,10)}…${claimResult.txHash.slice(-6)}`],
                ["Token", "cUSDT · ERC-7984"],
                ["Amount on-chain", "[FHE-sealed — only you know]"],
                ["Network", "Sepolia"],
              ].map(([k, v], i, arr) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--soft)" }}>{k}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: k === "Amount on-chain" ? "var(--accent)" : "var(--ink)" }}>{v}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 14 }}>
              <a href={explorerTx(claimResult.txHash)} target="_blank" rel="noreferrer" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)", textDecoration: "none" }}>
                View on Etherscan ↗
              </a>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 28 }}>
              <button className="s-btn" onClick={() => { setClaimStep(1); setClaimResult(null); if (address) loadClaims(address); }} style={{ fontSize: 15, padding: "13px 30px" }}>
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
