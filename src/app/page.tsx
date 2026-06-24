"use client";

import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useState, useEffect } from "react";
import { CanvasBackground } from "@/components/CanvasBackground";
import { useSotto } from "@/context/SottoContext";

export default function LandingPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const sotto = useSotto();
  const [revealed, setRevealed] = useState(false);
  const [displayAmt, setDisplayAmt] = useState("•••••••");

  const isDark = sotto.mode === "dark";
  const [nothingRevealed, setNothingRevealed] = useState(false);
  const landingInk = isDark ? "#F4EAD4" : "#12100D";
  const landingPage = isDark ? "#100C09" : "#EDE8DC";
  const landingMid = isDark ? "#9A8670" : "#4A4438";
  const landingSoft = isDark ? "#5A4E3C" : "#8A8273";
  const landingLine = isDark ? "rgba(244,234,212,.08)" : "rgba(18,16,13,.1)";
  const landingBorder = isDark ? "rgba(244,234,212,.18)" : "rgba(18,16,13,.2)";
  const landingBg = isDark
    ? "radial-gradient(148% 128% at 76% -8%,#1A1410 0%,#100C09 46%,#0C0906 100%)"
    : "radial-gradient(148% 128% at 76% -8%,#F5F0E4 0%,#EDE8DC 46%,#E4DDCE 100%)";
  const landingStripBg = isDark ? "rgba(20,16,11,.6)" : "rgba(247,243,233,.55)";

  function goCreate() {
    if (isConnected) router.push("/distribute");
    else openConnectModal?.();
  }
  function goClaim() {
    if (isConnected) router.push("/claim");
    else openConnectModal?.();
  }

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

  function onDecrypt() {
    if (revealed) return;
    scramble("12,500.00", (v, d) => { setDisplayAmt(v); if (d) setRevealed(true); });
  }

  useEffect(() => {
    const t = setTimeout(() => { if (!revealed) onDecrypt(); }, 3000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  return (
    <div style={{ minHeight: "100vh", fontFamily: "var(--font-sans)", color: landingInk, background: "var(--page-bg)", transition: "background .4s,color .35s", position: "relative", overflowX: "hidden" }}>

      {/* ── HERO ── */}
      <div style={{ position: "relative", background: landingBg, transition: "background .4s" }}>
        <div style={{ position: "relative", overflow: "hidden", minHeight: 540 }}>
          <CanvasBackground variant="landing" />

          {/* Nav */}
          <nav style={{ position: "relative", zIndex: 6, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 52px", maxWidth: 1320, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <div style={{ width: 20, height: 20, background: landingInk, display: "flex", alignItems: "center", justifyContent: "center", transition: "background .4s" }}>
                <div style={{ width: 8, height: 2, background: landingPage, transition: "background .4s" }} />
              </div>
              <span style={{ fontFamily: "var(--font-serif)", fontSize: 24, color: landingInk }}>Sotto</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
              <span onClick={() => router.push("/docs")} style={{ fontSize: 14, color: landingMid, cursor: "pointer" }}>Docs</span>
              <span onClick={sotto.toggleMode} style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: landingSoft, cursor: "pointer", letterSpacing: ".08em" }}>{sotto.modeLabel}</span>
              <div onClick={goCreate} style={{ display: "flex", alignItems: "center", gap: 8, background: landingInk, color: landingPage, padding: "10px 20px", borderRadius: 2, fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all .4s" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6FAF8E", animation: "float 2.4s ease-in-out infinite" }} />
                {isConnected ? "Open app" : "Connect wallet"}
              </div>
            </div>
          </nav>

          {/* Hero */}
          <section style={{ position: "relative", zIndex: 2, maxWidth: 1320, margin: "0 auto", padding: "22px 52px 78px", display: "grid", gridTemplateColumns: "1.06fr .94fr", gap: 60, alignItems: "center" }}>
            <div className="anim-up">
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 11.5, letterSpacing: ".18em", color: landingSoft, textTransform: "uppercase", marginBottom: 24 }}>
                <span style={{ width: 18, height: 1, background: "#C8472B" }} />
                ERC-7984 · Zama Protocol · FHE
              </div>
              <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: "clamp(52px,6.5vw,86px)", lineHeight: .96, letterSpacing: "-.018em", margin: 0, color: landingInk }}>
                Pay everyone.<br />
                Publish&nbsp;
                <span
                  style={{ position: "relative", display: "inline-block", verticalAlign: "baseline" }}
                  onMouseEnter={() => setNothingRevealed(true)}
                  onClick={() => setNothingRevealed(true)}
                >
                  <em style={{ fontStyle: "italic", color: "#C8472B" }}>nothing.</em>
                  {/* Censorship bar — hover/click to reveal */}
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: -4, right: -8, top: "12%", bottom: "12%",
                      background: landingInk,
                      borderRadius: 2,
                      pointerEvents: nothingRevealed ? "none" : "auto",
                      cursor: "pointer",
                      transform: nothingRevealed ? "translateX(14px) skewX(-8deg)" : "translateX(0) skewX(0)",
                      opacity: nothingRevealed ? 0 : 1,
                      transition: "transform .55s cubic-bezier(.2,.85,.2,1), opacity .45s ease, background .4s",
                    }}
                  />
                </span>
              </h1>
              <p style={{ fontSize: 18, lineHeight: 1.6, color: landingMid, maxWidth: 480, margin: "28px 0 0", fontWeight: 300 }}>
                Sotto disperses tokens to any number of recipients in a single confidential transaction. Amounts stay encrypted onchain — only each recipient can decrypt what&apos;s theirs.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 36, flexWrap: "wrap" }}>
                <div onClick={goCreate} style={{ display: "inline-flex", alignItems: "center", gap: 10, background: landingInk, color: landingPage, padding: "15px 26px", borderRadius: 2, fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "all .4s", boxShadow: "0 4px 18px rgba(18,16,13,.18)" }}>
                  Create a distribution <span style={{ fontFamily: "var(--font-mono)" }}>→</span>
                </div>
                <div onClick={goClaim} style={{ padding: "15px 22px", borderRadius: 2, fontSize: 15, fontWeight: 500, color: landingInk, border: `1.5px solid ${landingBorder}`, cursor: "pointer", transition: "all .4s" }}>
                  Claim an allocation
                </div>
              </div>
              <div style={{ display: "flex", gap: 28, marginTop: 46, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".07em", color: landingSoft, textTransform: "uppercase", flexWrap: "wrap" }}>
                <span>Browser-side FHE</span>
                <span style={{ color: isDark ? "rgba(244,234,212,.2)" : "rgba(18,16,13,.2)" }}>/</span>
                <span>Zero-knowledge proofs</span>
                <span style={{ color: isDark ? "rgba(244,234,212,.2)" : "rgba(18,16,13,.2)" }}>/</span>
                <span>Decrypt only yours</span>
              </div>
            </div>

            {/* Demo card */}
            <div style={{ position: "relative", animation: "up .85s .1s cubic-bezier(.22,.85,.2,1) both" }}>
              <div style={{ position: "absolute", top: -18, right: 16, zIndex: 4, fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500, letterSpacing: ".24em", color: "#C8472B", border: "2px solid #C8472B", padding: "7px 12px", borderRadius: 2, transform: "rotate(-4deg)", animation: "stampThud .75s .4s both", boxShadow: "0 4px 14px rgba(200,71,43,.25)" }}>CONFIDENTIAL</div>
              <div style={{ background: "#F7F3E9", border: "1px solid rgba(18,16,13,.1)", borderRadius: 4, boxShadow: "0 2px 0 rgba(255,255,255,.7) inset,0 32px 68px -28px rgba(18,16,13,.38)", overflow: "hidden" }}>
                <div style={{ padding: "22px 26px 17px", borderBottom: "1px solid rgba(18,16,13,.09)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontFamily: "var(--font-serif)", fontSize: 24, color: "#12100D" }}>Distribution <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, opacity: .65 }}>#0427</span></span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "#8A8273", letterSpacing: ".07em" }}>SEPOLIA</span>
                  </div>
                  <div style={{ fontSize: 13.5, color: "#6A6354", marginTop: 5 }}>Q2 Investor allocation · 142 recipients</div>
                </div>
                {[["0x4f29…b2A1", 84], ["0xc1aE…9Fd0", 62]].map(([a, w]) => (
                  <div key={String(a)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 26px", borderBottom: "1px solid rgba(18,16,13,.05)" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "#4A4438", flex: 1 }}>{a}</span>
                    <span style={{ height: 13, width: Number(w), background: "#12100D", borderRadius: 1, opacity: .8 }} />
                  </div>
                ))}
                {/* "you" row */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 26px", background: "rgba(200,71,43,.055)", borderTop: "1px solid rgba(200,71,43,.12)", borderBottom: "1px solid rgba(200,71,43,.12)" }}>
                  <div style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 13, color: "#12100D", whiteSpace: "nowrap" }}>
                    0x7a3D…b2F9 <span style={{ color: "#C8472B", fontWeight: 500 }}>· you</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 500, minWidth: 96, textAlign: "right", color: "#12100D" }}>{displayAmt}</span>
                    <span style={{ fontSize: 11.5, color: "#8A8273" }}>cUSDT</span>
                    {!revealed ? (
                      <span onClick={onDecrypt} style={{ fontSize: 12, fontWeight: 700, color: "#F6F1E6", background: "#C8472B", padding: "7px 12px", borderRadius: 2, cursor: "pointer" }}>Decrypt</span>
                    ) : (
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#3C6E55" }}>✓ decrypted</span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 26px" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "#4A4438", flex: 1 }}>0x90Bb…1Ee7</span>
                  <span style={{ height: 13, width: 100, background: "#12100D", borderRadius: 1, opacity: .8 }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 26px", borderTop: "1px solid rgba(18,16,13,.09)", background: "rgba(18,16,13,.02)" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".07em", color: "#8A8273" }}>TOTAL ONCHAIN · ENCRYPTED</span>
                  <span style={{ height: 12, width: 72, background: "#12100D", borderRadius: 1, opacity: .8 }} />
                </div>
              </div>
              <p style={{ fontSize: 12.5, color: "#8A8273", marginTop: 14, textAlign: "center", fontStyle: "italic", fontFamily: "var(--font-serif)" }}>Everyone sees the ledger. No one reads the amounts.</p>
            </div>
          </section>

        </div>

        {/* Use cases strip */}
        <div style={{ borderTop: `1px solid ${landingLine}`, background: landingStripBg }}>
          <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 52px", display: "grid", gridTemplateColumns: "repeat(3,1fr)" }}>
            {[
              { n: "01", title: "Investor distributions", desc: "Cap-table allocations that no block explorer can read.", pr: false },
              { n: "02", title: "Team payouts & vesting", desc: "Salaries no colleague can reverse-engineer.", pr: false },
              { n: "03", title: "Community airdrops", desc: "Reward thousands without leaking who got what.", pr: true },
            ].map((uc, i) => (
              <div key={uc.n} style={{ padding: "36px 34px", borderRight: i < 2 ? `1px solid ${landingLine}` : "none", paddingLeft: i === 0 ? 0 : 34 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#C8472B", letterSpacing: ".1em" }}>{uc.n}</div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 26, marginTop: 10, color: landingInk }}>{uc.title}</div>
                <div style={{ fontSize: 13.5, color: landingMid, lineHeight: 1.5, marginTop: 7 }}>{uc.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How it works */}
      <div style={{ background: "var(--page-bg)", borderTop: `1px solid ${landingLine}` }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", padding: "80px 52px 86px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 52 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "#C8472B" }}>How it works</span>
            <span style={{ flex: 1, height: 1, background: landingLine }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 60 }}>
            {[
              { n: "01", title: "Upload recipients & amounts", desc: "Paste a CSV or type addresses one per line. Every amount is encrypted locally in your browser using Fully Homomorphic Encryption before it ever leaves your device." },
              { n: "02", title: "Seal with one confidential transaction", desc: "Sotto generates a zero-knowledge proof that all amounts are valid, then broadcasts a single confidentialDisperse() call. Every sealed amount lands onchain in one block." },
              { n: "03", title: "Recipients declassify their own slice", desc: "Each recipient connects their wallet, proves they're on the list, and decrypts only their allocation — locally, in-browser. No server, no trusted third party." },
            ].map((step) => (
              <div key={step.n}>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 64, lineHeight: 1, color: landingLine }}>{step.n}</div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 28, color: landingInk, marginTop: 16 }}>{step.title}</div>
                <div style={{ fontSize: 14.5, color: landingMid, lineHeight: 1.65, marginTop: 12 }}>{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Privacy guarantee */}
      <div style={{ borderTop: `1px solid ${landingLine}`, background: landingStripBg }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", padding: "80px 52px 86px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 36 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "#C8472B" }}>The privacy guarantee</span>
              <span style={{ flex: 1, height: 1, background: landingLine }} />
            </div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 40, lineHeight: 1.1, color: landingInk, letterSpacing: "-.015em" }}>
              Not a display trick.<br /><em style={{ fontStyle: "italic", color: "#C8472B" }}>Mathematical</em> privacy.
            </div>
            <p style={{ fontSize: 15, color: landingMid, lineHeight: 1.7, marginTop: 20 }}>
              Most &quot;private&quot; tools hide data in the UI while storing it in plaintext onchain. Sotto uses Fully Homomorphic Encryption from the Zama Protocol — amounts are mathematically sealed ciphertext. No observer, no node, no validator can read them. Only a wallet holding the matching private key can decrypt, and only its own allocation.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8 }}>
            {[
              { k: "FULLY HOMOMORPHIC ENCRYPTION", v: "Compute on encrypted data without decrypting it. The Zama Protocol's FHE library lets Sotto verify and route sealed amounts without ever seeing the numbers." },
              { k: "ZERO-KNOWLEDGE PROOFS", v: "Before broadcasting, Sotto generates a ZK proof that the distribution is valid — correct total, no double-spends — without exposing any individual allocation." },
              { k: "MEMBERSHIP PROOFS", v: "Recipients prove they're on the list — without revealing the other recipients. No one learns who else received a distribution or how many people it went to." },
            ].map((card) => (
              <div key={card.k} style={{ padding: "20px 22px", background: "var(--page-bg)", border: `1px solid ${landingLine}`, borderRadius: 4 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".1em", color: "#C8472B", marginBottom: 8 }}>{card.k}</div>
                <div style={{ fontSize: 14, color: landingMid, lineHeight: 1.55 }}>{card.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Built on */}
      <div style={{ borderTop: `1px solid ${landingLine}`, background: "var(--page-bg)" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", padding: "56px 52px", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 32, alignItems: "center" }}>
          {[
            { label: "Built on", title: "Zama Protocol", sub: "FHE infrastructure layer" },
            { label: "Using", title: "TokenOps SDK", sub: "Confidential token operations" },
            { label: "Standard", title: "ERC-7984", sub: "Confidential ERC-20 extension" },
            { label: "Network", title: "Sepolia", sub: "Ethereum testnet deployment" },
          ].map((item) => (
            <div key={item.title}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: landingSoft, marginBottom: 10 }}>{item.label}</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: landingInk }}>{item.title}</div>
              <div style={{ fontSize: 13, color: landingMid, marginTop: 4 }}>{item.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${landingLine}`, padding: "24px 52px", maxWidth: 1320, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "var(--font-serif)", fontSize: 18, color: landingInk }}>Sotto</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".05em", color: landingSoft }}>BUILT ON THE ZAMA PROTOCOL · TOKENOPS SDK</span>
      </div>
    </div>
  );
}
