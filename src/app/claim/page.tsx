"use client";

import { useEffect, useState, useRef } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import type { Hex } from "viem";
import { createConfidentialAirdropClient } from "@tokenops/sdk/fhe-airdrop";
import { useUserDecrypt } from "@zama-fhe/react-sdk";
import { AppShell } from "@/components/AppShell";
import { CanvasBackground } from "@/components/CanvasBackground";
import { StepRail } from "@/components/StepRail";
import { useSotto } from "@/context/SottoContext";
import { fmtToken } from "@/lib/format";
import { explorerTx } from "@/lib/constants";
import type { PublicClaim } from "@/lib/types";
import { toast } from "@/components/toast";
import { humanizeError } from "@/components/Faucet";

type ClaimStep = 1 | 2 | 3;
type InnerPhase = "idle" | "decrypting" | "revealed";

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

/* ─── ClaimCardFull: handles the real FHE decrypt + claim tx ─── */
function ClaimCardFull({
  claim,
  innerPhase, setInnerPhase,
  displayAmt, setDisplayAmt,
  onClaimed,
}: {
  claim: PublicClaim;
  innerPhase: InnerPhase;
  setInnerPhase: (p: InnerPhase) => void;
  displayAmt: string;
  setDisplayAmt: (v: string) => void;
  onClaimed: (txHash: Hex, amount: string) => void;
}) {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState<boolean | null>(null);
  const [revealHandle, setRevealHandle] = useState<Hex | null>(null);
  // Decrypt phases: [signature verified, ACL granted, decrypted]
  const [phases, setPhases] = useState([false, false, false]);

  const decrypt = useUserDecrypt(
    { handles: revealHandle ? [{ handle: revealHandle, contractAddress: claim.airdrop }] : [] },
    { enabled: !!revealHandle },
  );
  const decryptedBig = decrypt.data && revealHandle ? (decrypt.data[revealHandle] as bigint | undefined) : undefined;

  // When decrypt succeeds, animate reveal
  const scrambleRef = useRef(false);
  useEffect(() => {
    if (decryptedBig !== undefined && !scrambleRef.current) {
      scrambleRef.current = true;
      setPhases([true, true, false]);
      setTimeout(() => {
        setPhases([true, true, true]);
        const target = fmtToken(decryptedBig);
        scramble(target, (v, d) => {
          setDisplayAmt(v);
          if (d) setInnerPhase("revealed");
        });
      }, 600);
    }
  }, [decryptedBig, setDisplayAmt, setInnerPhase]);

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
    setInnerPhase("decrypting");
    setPhases([false, false, false]);
    try {
      // Phase 1: signature verified (instant)
      setPhases([true, false, false]);
      const client = createConfidentialAirdropClient({ publicClient, walletClient, address: claim.airdrop });
      // Phase 2: ACL grant tx
      const { handle } = await client.getClaimAmount({
        encryptedInput: { handle: claim.handle, inputProof: claim.inputProof },
        signature: claim.signature,
      });
      setPhases([true, true, false]);
      setRevealHandle(handle); // triggers useUserDecrypt
    } catch (e) {
      toast(humanizeError(e), { kind: "error" });
      setInnerPhase("idle");
      setPhases([false, false, false]);
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
  const windowOpen = now >= claim.startTime && now <= claim.endTime;
  const canClaim = claimed === false && windowOpen;

  const phaseLabels = [
    { text: "Verifying authorization signature", doneText: "Signature valid" },
    { text: "Submitting ACL grant onchain", doneText: "Access granted" },
    { text: "Decrypting ciphertext in browser", doneText: "Decrypted locally" },
  ];

  return (
    <div>
      {/* Giant amount display */}
      <div style={{ position: "relative", display: "inline-block", marginBottom: 8 }}>
        {innerPhase === "idle" && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%) rotate(-6deg)", fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: ".22em", color: "var(--accent)", border: "2.5px solid var(--accent)", padding: "10px 20px", borderRadius: 2, whiteSpace: "nowrap", zIndex: 2, animation: "glow 2s ease-in-out infinite" }}>
            SEALED · ENCRYPTED
          </div>
        )}
        {innerPhase === "revealed" && (
          <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: "linear-gradient(90deg,transparent,rgba(200,71,43,.6),transparent)", animation: "scanline 1.2s ease both", pointerEvents: "none" }} />
        )}
        <div style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(60px,10vw,128px)", lineHeight: .92, letterSpacing: "-.03em", color: innerPhase === "revealed" ? "var(--ink)" : "var(--soft)", transition: "color .5s ease", animation: innerPhase === "revealed" ? "claimPulse .6s .1s cubic-bezier(.22,.85,.2,1) both" : "none" }}>
          {displayAmt}
        </div>
      </div>
      <div style={{ fontSize: 18, color: "var(--mid)", marginBottom: 34 }}>cUSDT</div>

      {/* Idle: declassify CTA */}
      {innerPhase === "idle" && (
        <div style={{ maxWidth: 440, margin: "0 auto" }}>
          <button
            onClick={reveal}
            style={{ background: "var(--accent)", color: "#F6F1E6", padding: "17px 50px", borderRadius: 3, fontSize: 16, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 12, marginBottom: 18, transition: "all .2s", boxShadow: "0 4px 18px rgba(200,71,43,.32)", border: "none" }}
          >
            {/* Lock icon */}
            <span style={{ width: 15, height: 16, border: "1.6px solid #F6F1E6", borderRadius: 2, position: "relative", display: "inline-block", flexShrink: 0 }}>
              <span style={{ position: "absolute", left: "50%", top: -7, transform: "translateX(-50%)", width: 9, height: 8, border: "1.6px solid #F6F1E6", borderBottom: "none", borderRadius: "5px 5px 0 0" }} />
            </span>
            Declassify with my key
          </button>
          <p style={{ fontSize: 12.5, color: "var(--soft)", lineHeight: 1.55, maxWidth: 360, margin: "0 auto" }}>
            Decryption runs entirely in your browser. No server ever sees this number.
          </p>
        </div>
      )}

      {/* Decrypting: ceremony log */}
      {innerPhase === "decrypting" && (
        <div style={{ maxWidth: 440, margin: "0 auto", background: "var(--card)", border: "1.5px solid var(--line)", borderRadius: 5, padding: "20px 22px", textAlign: "left", animation: "popIn .3s cubic-bezier(.22,.85,.2,1) both" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 14 }}>Decrypting locally</div>
          {phaseLabels.map((p, i) => {
            const done = phases[i];
            const active = !done && phases.slice(0, i).every(Boolean);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 11, padding: "7px 0" }}>
                <span style={{ width: 15, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12, color: done ? "#6FAF8E" : active ? "var(--accent)" : "var(--soft)", display: "inline-block", animation: active ? "spin .7s linear infinite" : "none", flexShrink: 0 }}>
                  {done ? "✓" : active ? "◌" : "○"}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: done ? "#6FAF8E" : active ? "var(--ink)" : "var(--soft)", transition: "color .3s" }}>
                  {done ? p.doneText : p.text}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Revealed: breakdown + claim */}
      {innerPhase === "revealed" && (
        <div style={{ maxWidth: 440, margin: "0 auto", animation: "popIn .4s cubic-bezier(.22,.85,.2,1) both" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, fontSize: 13, color: "#6FAF8E", fontWeight: 600, marginBottom: 20 }}>
            <span style={{ width: 19, height: 19, borderRadius: "50%", border: "1.5px solid #6FAF8E", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>✓</span>
            Decrypted locally · no server saw this number
          </div>
          {/* Breakdown card */}
          <div style={{ background: "var(--card)", border: "1.5px solid var(--line)", borderRadius: 5, padding: "6px 18px", textAlign: "left", marginBottom: 20 }}>
            {[
              ["Distribution", claim.name || "—"],
              ["Token", `${claim.symbol} · ERC-7984`],
              ["Your allocation", displayAmt + " " + claim.symbol],
              ["Claim window", new Date(claim.endTime * 1000) > new Date() ? `Open until ${new Date(claim.endTime * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "Closed"],
            ].map(([label, value], i, arr) => (
              <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none" }}>
                <span style={{ fontSize: 13, color: "var(--mid)" }}>{label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: label === "Your allocation" ? 15 : 13.5, color: label === "Your allocation" ? "var(--ink)" : "var(--mid)", fontWeight: label === "Your allocation" ? 600 : 400 }}>{value}</span>
              </div>
            ))}
          </div>
          {canClaim ? (
            <button
              onClick={doClaim}
              disabled={claiming}
              style={{ background: "var(--ink)", color: "var(--page-bg)", padding: "17px 50px", borderRadius: 3, fontSize: 16, fontWeight: 700, cursor: "pointer", display: "inline-block", transition: "all .4s", border: "none", opacity: claiming ? 0.6 : 1 }}
            >
              {claiming ? "Claiming…" : "Claim to wallet →"}
            </button>
          ) : claimed === true ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 9, fontSize: 14, color: "#6FAF8E", fontWeight: 600 }}>
              <span>✓</span> Already claimed
            </div>
          ) : (
            <div style={{ fontSize: 14, color: "var(--soft)" }}>Claim window has closed.</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function ClaimPage() {
  const { isConnected, address } = useAccount();
  const { openConnectModal } = useConnectModal();
  useSotto();

  const [preselectedId, setPreselectedId] = useState<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) setPreselectedId(id.toLowerCase());
  }, []);

  const [claimStep, setClaimStep] = useState<ClaimStep>(1);
  const [checking, setChecking] = useState(true);
  const [claims, setClaims] = useState<PublicClaim[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [claimResult, setClaimResult] = useState<{ txHash: Hex; amount: string } | null>(null);

  // Step 2 inner state (lifted so step rail shows correctly)
  const [innerPhase, setInnerPhase] = useState<InnerPhase>("idle");
  const [displayAmt, setDisplayAmt] = useState("•••••••");

  function loadClaims(addr: string) {
    setChecking(true);
    setClaims([]);
    setInnerPhase("idle");
    setDisplayAmt("•••••••");
    fetch(`/api/claims?recipient=${addr}`)
      .then(r => r.json())
      .then(data => {
        const all: PublicClaim[] = Array.isArray(data?.claims) ? data.claims : Array.isArray(data) ? data : [];
        setClaims(all);
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

  async function fireWebhook(admin: string, airdrop: string, recipient: string) {
    try {
      await fetch("/api/webhook", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ admin, distribution: airdrop, recipient, token: "cUSDT" }) });
    } catch { /* best-effort */ }
  }

  const CLAIM_STEPS = [
    { n: "01", label: "Verify" },
    { n: "02", label: "Decrypt" },
    { n: "03", label: "Claimed" },
  ];

  const stepForRail = claimStep === 3 ? 3 : claimStep === 2 ? (innerPhase === "revealed" ? 2 : 2) : 1;

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
              <button className="s-btn" onClick={openConnectModal} style={{ width: "100%", justifyContent: "center" }}>Connect wallet →</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const activeClaim = claims[activeIdx];

  return (
    <>
      <AppShell />
      <div style={{ minHeight: "calc(100vh - 56px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "42px 20px 64px", position: "relative", animation: "fd .3s ease both" }}>
        <CanvasBackground variant={claimStep === 2 && innerPhase === "decrypting" ? "converge" : "flow"} />
        <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 560 }}>

          {/* Step rail */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 42 }}>
            <StepRail steps={CLAIM_STEPS} current={stepForRail} />
          </div>

          {/* ── STEP 1: Verify ── */}
          {claimStep === 1 && (
            <div style={{ textAlign: "center", animation: "up .4s cubic-bezier(.22,.85,.2,1) both" }}>
              <div className="s-label" style={{ marginBottom: 16 }}>Claim an allocation</div>
              <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 46, color: "var(--ink)", margin: 0, letterSpacing: "-.015em" }}>
                {checking ? "Checking eligibility" : claims.length > 0 ? "You're on the list" : "No allocations found"}
              </h2>
              <p style={{ fontSize: 15.5, color: "var(--mid)", margin: "13px auto 0", maxWidth: 390, lineHeight: 1.6 }}>
                {checking
                  ? "Verifying membership proof…"
                  : claims.length > 0
                  ? `${claims.length} sealed allocation${claims.length > 1 ? "s" : ""} waiting for you.`
                  : "No sealed distributions found for this wallet."}
              </p>

              <div style={{ margin: "32px auto 0", background: "var(--card)", border: "1.5px solid var(--line)", borderRadius: 5, padding: "26px 28px", textAlign: "left" }}>
                {checking ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 17, padding: "6px 0" }}>
                    <div style={{ width: 42, height: 42, borderRadius: "50%", border: "2px solid var(--line)", borderTopColor: "var(--accent)", animation: "spin .78s linear infinite" }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--mid)" }}>Verifying membership proof…</span>
                  </div>
                ) : claims.length > 0 ? (
                  <div>
                    {/* Multi-claim tabs */}
                    {claims.length > 1 && (
                      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", flexWrap: "wrap" }}>
                        {claims.map((c, i) => (
                          <div key={i} onClick={() => setActiveIdx(i)} style={{ padding: "6px 12px", borderRadius: 3, background: activeIdx === i ? "rgba(200,71,43,.15)" : "var(--overlay)", border: `1.5px solid ${activeIdx === i ? "rgba(200,71,43,.65)" : "var(--line)"}`, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                            {c.name || `Distribution ${i + 1}`}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Distribution header + ELIGIBLE badge */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                      <div>
                        <div style={{ fontFamily: "var(--font-serif)", fontSize: 23, color: "var(--ink)" }}>{activeClaim?.name || "Distribution"}</div>
                        <div style={{ fontSize: 13, color: "var(--mid)", marginTop: 3 }}>Sealed allocation · ERC-7984</div>
                      </div>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#6FAF8E", border: "1px solid #6FAF8E", background: "rgba(111,175,142,.1)", padding: "5px 9px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#6FAF8E" }} />
                        ELIGIBLE
                      </span>
                    </div>

                    {/* Facts grid */}
                    {activeClaim && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--line)", border: "1px solid var(--line)", borderRadius: 4, overflow: "hidden", marginBottom: 20 }}>
                        {[
                          ["Token", activeClaim.symbol || "cUSDT"],
                          ["Standard", "ERC-7984"],
                          ["Claim opens", new Date(activeClaim.startTime * 1000) < new Date() ? "Now open" : new Date(activeClaim.startTime * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" })],
                          ["Closes", new Date(activeClaim.endTime * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })],
                        ].map(([label, value]) => (
                          <div key={label} style={{ background: "var(--card)", padding: "11px 13px" }}>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 4 }}>{label}</div>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--ink)" }}>{value}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    <button className="s-btn" style={{ width: "100%", justifyContent: "center", fontSize: 15 }} onClick={() => setClaimStep(2)}>
                      Open my sealed allocation →
                    </button>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "8px 0" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
                    <div style={{ fontSize: 14, color: "var(--mid)", marginBottom: 12, lineHeight: 1.55 }}>
                      No distributions found for<br />
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--soft)" }}>{address?.slice(0, 10)}…{address?.slice(-6)}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--soft)", marginBottom: 18, lineHeight: 1.55 }}>Ask your distributor for the direct claim link.</div>
                    <button onClick={() => address && loadClaims(address)} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", border: "1px solid rgba(200,71,43,.4)", padding: "7px 14px", borderRadius: 2, background: "transparent", cursor: "pointer" }}>
                      ↻ Refresh
                    </button>
                  </div>
                )}
              </div>

              <p style={{ fontSize: 12, color: "var(--soft)", lineHeight: 1.55, maxWidth: 400, margin: "16px auto 0", fontStyle: "italic", fontFamily: "var(--font-serif)" }}>
                A zero-knowledge proof confirmed you&apos;re on the list — without exposing other recipients or their amounts.
              </p>
            </div>
          )}

          {/* ── STEP 2: Decrypt ── */}
          {claimStep === 2 && activeClaim && (
            <div style={{ textAlign: "center", animation: "slideUp .45s cubic-bezier(.22,.85,.2,1) both" }}>
              <div className="s-label" style={{ marginBottom: 22 }}>
                {activeClaim.name} · Your sealed allocation
              </div>
              <ClaimCardFull
                claim={activeClaim}
                innerPhase={innerPhase}
                setInnerPhase={setInnerPhase}
                displayAmt={displayAmt}
                setDisplayAmt={setDisplayAmt}
                onClaimed={(txHash, amount) => {
                  setClaimResult({ txHash, amount });
                  setClaimStep(3);
                  fetch(`/api/campaigns?airdrop=${activeClaim.airdrop}`)
                    .then(r => r.json())
                    .then(d => { if (d?.campaign?.admin) fireWebhook(d.campaign.admin, activeClaim.airdrop, activeClaim.recipient); })
                    .catch(() => {});
                }}
              />
              <button onClick={() => setClaimStep(1)} style={{ marginTop: 24, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--soft)", background: "none", border: "none", cursor: "pointer" }}>
                ← Back to distributions
              </button>
            </div>
          )}

          {/* ── STEP 3: Claimed ── */}
          {claimStep === 3 && claimResult && (
            <div style={{ textAlign: "center", animation: "up .5s cubic-bezier(.22,.85,.2,1) both" }}>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: ".22em", color: "#6FAF8E", border: "2px solid #6FAF8E", padding: "8px 17px", borderRadius: 2, transform: "rotate(-3deg)", display: "inline-block", animation: "stampThud .7s .1s both", boxShadow: "0 3px 14px rgba(111,175,142,.28)" }}>CLAIMED</div>
              </div>
              <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 50, color: "var(--ink)", margin: 0, letterSpacing: "-.02em", lineHeight: 1.05 }}>
                {claimResult.amount}<br />is yours.
              </h2>
              <p style={{ fontSize: 15, color: "var(--mid)", margin: "15px auto 0", maxWidth: 400, lineHeight: 1.6, fontWeight: 300 }}>
                Transferred as a confidential balance. Your allocation never appeared in plaintext on the public record.
              </p>

              {/* Receipt */}
              <div style={{ background: "var(--card)", border: "1.5px solid var(--line)", borderRadius: 5, padding: "6px 20px", textAlign: "left", margin: "28px auto 0", maxWidth: 420 }}>
                {[
                  ["TX HASH", `${claimResult.txHash.slice(0, 10)}…${claimResult.txHash.slice(-6)}`],
                  ["TOKEN", "cUSDT · ERC-7984"],
                  ["AMOUNT ONCHAIN", "[FHE-sealed · only you know]"],
                  ["NETWORK", "Ethereum Sepolia"],
                ].map(([label, value], i, arr) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--soft)" }}>{label}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: label === "AMOUNT ONCHAIN" ? "var(--accent)" : "var(--ink)" }}>{value}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 26, flexWrap: "wrap" }}>
                <button className="s-btn" onClick={() => { setClaimStep(1); setClaimResult(null); setInnerPhase("idle"); setDisplayAmt("•••••••"); if (address) loadClaims(address); }} style={{ fontSize: 15, padding: "13px 30px" }}>Done</button>
                <a href={explorerTx(claimResult.txHash)} target="_blank" rel="noreferrer" style={{ border: "1.5px solid var(--line)", color: "var(--mid)", padding: "13px 22px", borderRadius: 3, fontSize: 14, fontWeight: 500, cursor: "pointer", textDecoration: "none" }}>View on explorer</a>
                <div onClick={() => window.location.href = "/dashboard"} style={{ border: "1.5px solid var(--line)", color: "var(--mid)", padding: "13px 22px", borderRadius: 3, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Distributions</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
