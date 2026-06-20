"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";

function Feature({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="cd-card" style={{ padding: "1.1rem 1.2rem" }}>
      <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
      <h3 style={{ margin: "0 0 6px", fontSize: 15.5 }}>{title}</h3>
      <p style={{ margin: 0, color: "var(--fg-muted)", fontSize: 13.5, lineHeight: 1.55 }}>
        {body}
      </p>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div style={{ display: "flex", gap: 14 }}>
      <div
        className="cd-mono"
        style={{
          flex: "none",
          width: 30,
          height: 30,
          borderRadius: 9,
          display: "grid",
          placeItems: "center",
          background: "rgba(124,92,255,0.12)",
          border: "1px solid rgba(124,92,255,0.3)",
          color: "#c9bdff",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {n}
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 3 }}>{title}</div>
        <div style={{ color: "var(--fg-muted)", fontSize: 13.5, lineHeight: 1.55 }}>
          {body}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.25rem" }}>
      {/* Hero */}
      <section
        className="cd-fade"
        style={{ padding: "3.5rem 0 2.5rem", textAlign: "center" }}
      >
        <span className="cd-badge cd-badge-accent" style={{ marginBottom: 18 }}>
          <Logo size={14} /> Fully homomorphic encryption · ERC-7984
        </span>
        <h1
          style={{
            fontSize: "clamp(2.1rem, 5vw, 3.4rem)",
            lineHeight: 1.05,
            letterSpacing: -1.2,
            margin: "0 0 1rem",
            fontWeight: 800,
          }}
        >
          Distribute tokens.
          <br />
          <span
            style={{
              background: "linear-gradient(90deg,#a48bff,#38e8c6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Keep every amount private.
          </span>
        </h1>
        <p
          style={{
            maxWidth: 600,
            margin: "0 auto 1.8rem",
            color: "var(--fg-muted)",
            fontSize: 16,
            lineHeight: 1.6,
          }}
        >
          Cloakdrop runs confidential airdrops and bulk transfers where allocations
          are encrypted on-chain. The recipient list and every amount stay hidden —
          only each recipient can decrypt their own allocation.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/distribute" className="cd-btn cd-btn-primary">
            Launch a distribution →
          </Link>
          <Link href="/claim" className="cd-btn cd-btn-ghost">
            Claim your allocation
          </Link>
        </div>
      </section>

      {/* Features */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
          gap: 14,
          margin: "1.5rem 0",
        }}
      >
        <Feature
          icon="🔐"
          title="Amounts encrypted on-chain"
          body="Each allocation is an FHE ciphertext. Nobody — not even an explorer — can read who got how much."
        />
        <Feature
          icon="🎯"
          title="Only you see your share"
          body="Recipients decrypt their own allocation with a wallet signature. Other recipients' amounts stay sealed."
        />
        <Feature
          icon="⚡"
          title="Airdrop or bulk disperse"
          body="Signature-gated claims for campaigns, or push encrypted transfers to many recipients in one transaction."
        />
        <Feature
          icon="🧩"
          title="Built on TokenOps + Zama"
          body="Powered by audited, factory-deployed confidential contracts via the TokenOps SDK on the Zama Protocol."
        />
      </section>

      {/* How it works */}
      <section
        className="cd-card how-grid"
        style={{
          padding: "1.6rem 1.6rem",
          margin: "1.5rem 0",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "2rem",
        }}
      >
        <div>
          <h2 style={{ fontSize: 18, margin: "0 0 1.1rem" }}>For distributors</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Step n={1} title="Upload recipients" body="Paste or upload a CSV of address,amount rows." />
            <Step n={2} title="Encrypt & sign" body="Each amount is encrypted to its recipient and signed in your wallet." />
            <Step n={3} title="Deploy & fund" body="A confidential airdrop is deployed and funded in one transaction." />
            <Step n={4} title="Share the link" body="Recipients connect their wallet and claim — no list ever goes public." />
          </div>
        </div>
        <div>
          <h2 style={{ fontSize: 18, margin: "0 0 1.1rem" }}>For recipients</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Step n={1} title="Connect wallet" body="Instantly see whether you have an allocation waiting." />
            <Step n={2} title="Reveal privately" body="Decrypt your own amount with a signature — visible only to you." />
            <Step n={3} title="Claim" body="Receive your confidential tokens. The amount never appears in plaintext on-chain." />
          </div>
        </div>
      </section>

      <footer
        style={{
          textAlign: "center",
          color: "var(--fg-faint)",
          fontSize: 12.5,
          padding: "2rem 0 3rem",
        }}
      >
        Sepolia testnet · cUSDT (ERC-7984) · Confidential distribution powered by FHE
      </footer>
    </div>
  );
}
