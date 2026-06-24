"use client";

import { useEffect, useState, useRef } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useRouter, usePathname } from "next/navigation";
import { useSotto } from "@/context/SottoContext";
import { shortAddr, timeAgo } from "@/lib/format";

export function AppShell({ tag }: { tag?: string } = {}) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { disconnect } = useDisconnect();
  const router = useRouter();
  const path = usePathname();
  const sotto = useSotto();
  const [walletOpen, setWalletOpen] = useState(false);
  const walletRef = useRef<HTMLDivElement>(null);

  // Close wallet dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (walletRef.current && !walletRef.current.contains(e.target as Node)) setWalletOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const isDark = sotto.mode === "dark";

  // Real activity count for the bell badge.
  const [activityCount, setActivityCount] = useState(0);
  useEffect(() => {
    if (!isConnected || !address) { setActivityCount(0); return; }
    fetch(`/api/campaigns?admin=${address}`)
      .then(r => r.json())
      .then(d => setActivityCount(Array.isArray(d?.campaigns) ? d.campaigns.length : 0))
      .catch(() => setActivityCount(0));
  }, [isConnected, address]);

  const nav = [
    { label: "New distribution", href: "/distribute" },
    { label: "Distributions", href: "/dashboard" },
    { label: "Claim", href: "/claim" },
  ];

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 40, height: 56,
      background: "var(--nav-bg)", borderBottom: "1px solid var(--line)",
      display: "flex", alignItems: "stretch", padding: "0 44px",
      transition: "background .4s, border-color .4s",
    }}>
      {/* Logo */}
      <div
        onClick={() => router.push("/")}
        style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", marginRight: 38, flexShrink: 0 }}
      >
        <div style={{ width: 17, height: 17, background: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .4s" }}>
          <div style={{ width: 7, height: 2, background: "var(--page-bg)", transition: "background .4s" }} />
        </div>
        <span style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--ink)", transition: "color .4s" }}>Sotto</span>
        {tag && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".16em", color: "var(--accent)", border: "1px solid rgba(200,71,43,.4)", padding: "3px 8px", borderRadius: 2, marginLeft: 4 }}>{tag}</span>
        )}
      </div>

      {/* Nav tabs */}
      <div style={{ display: "flex", alignItems: "stretch", flex: 1, gap: 0 }}>
        {nav.map((item) => {
          const active = path === item.href;
          return (
            <div
              key={item.href}
              onClick={() => router.push(item.href)}
              role="link"
              tabIndex={0}
              onKeyDown={e => e.key === "Enter" && router.push(item.href)}
              style={{
                display: "flex", alignItems: "center", padding: "0 17px",
                fontSize: 13.5, fontWeight: 500, cursor: "pointer",
                color: active ? "var(--ink)" : "var(--mid)",
                borderBottom: `2.5px solid ${active ? "var(--accent)" : "transparent"}`,
                transition: "color .2s, border-color .2s", whiteSpace: "nowrap",
              }}
            >
              {item.label}
            </div>
          );
        })}
      </div>

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, flexShrink: 0 }}>

        {/* Docs link */}
        <a
          href="/docs"
          style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".08em", color: "var(--mid)", textDecoration: "none", transition: "color .2s", textTransform: "uppercase" }}
        >
          Docs
        </a>

        {/* Network badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 11px", borderRadius: 999, border: "1px solid var(--line)", transition: "border-color .4s" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6FAF8E", boxShadow: "0 0 0 0 rgba(111,175,142,.5)", animation: "glow 2.2s ease-in-out infinite" }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".05em", color: "var(--mid)", transition: "color .4s" }}>Sepolia</span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 18, background: "var(--line)", transition: "background .4s" }} />

        {/* Sun/Moon theme pill */}
        <div
          onClick={sotto.toggleMode}
          aria-label="Toggle light/dark mode"
          title="Toggle theme"
          style={{
            position: "relative", width: 46, height: 24, borderRadius: 12,
            background: isDark ? "#0C0906" : "#FFFDF5",
            border: "1px solid var(--line)",
            cursor: "pointer", flexShrink: 0, transition: "background .3s, border-color .4s",
          }}
        >
          {/* Sun */}
          <span style={{ position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)", width: 8, height: 8, borderRadius: "50%", border: `1.5px solid ${isDark ? "var(--soft)" : "#C8472B"}`, boxSizing: "border-box", transition: "border-color .3s" }} />
          {/* Moon */}
          <span style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 8, height: 8, borderRadius: "50%", boxShadow: `inset -3.5px -1px 0 0 ${isDark ? "#C8472B" : "var(--soft)"}`, transition: "box-shadow .3s" }} />
          {/* Knob */}
          <span style={{ position: "absolute", top: 2, left: isDark ? 24 : 3, width: 18, height: 18, borderRadius: "50%", background: "var(--ink)", boxShadow: "0 1px 4px rgba(0,0,0,.3)", transition: "left .25s cubic-bezier(.22,.85,.2,1), background .4s" }} />
        </div>

        {/* SDK button */}
        <div
          onClick={sotto.toggleSdk}
          aria-label="Open SDK preview"
          style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, padding: "6px 11px", borderRadius: 2, border: "1px solid var(--line)", color: "var(--mid)", cursor: "pointer", transition: "all .2s" }}
        >
          SDK
        </div>

        {/* Bell notifications */}
        <div
          onClick={sotto.toggleNotif}
          aria-label="Notifications"
          style={{ position: "relative", width: 32, height: 32, borderRadius: 2, border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all .2s" }}
        >
          {/* SVG bell */}
          <span style={{ position: "relative", width: 15, height: 15, display: "inline-block" }}>
            <span style={{ position: "absolute", left: 2.5, top: 1, width: 10, height: 9, border: `1.5px solid var(--mid)`, borderBottom: "none", borderRadius: "5px 5px 0 0", boxSizing: "border-box" }} />
            <span style={{ position: "absolute", left: 0.5, top: 9.5, width: 14, height: 1.6, background: "var(--mid)", borderRadius: 2 }} />
            <span style={{ position: "absolute", left: 6, top: 11.5, width: 3, height: 3, borderRadius: "50%", background: "var(--mid)" }} />
          </span>
          {!sotto.notifRead && activityCount > 0 && (
            <span style={{ position: "absolute", top: -4, right: -4, minWidth: 14, height: 14, padding: "0 3px", borderRadius: 7, background: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 8, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{activityCount > 9 ? "9+" : activityCount}</span>
          )}
        </div>

        {/* Wallet */}
        {isConnected && address ? (
          <div ref={walletRef} style={{ position: "relative" }}>
            <div
              onClick={() => setWalletOpen(o => !o)}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 2, border: `1px solid ${walletOpen ? "var(--accent)" : "var(--line)"}`, cursor: "pointer", transition: "border-color .2s", userSelect: "none" }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6FAF8E", animation: "float 2.4s ease-in-out infinite" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--mid)" }}>{shortAddr(address, 4)}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--soft)", marginLeft: 2 }}>▾</span>
            </div>
            {walletOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, minWidth: 210, background: "var(--surface)", border: "1.5px solid var(--line)", borderRadius: 5, boxShadow: "0 12px 40px rgba(0,0,0,.22)", zIndex: 100, animation: "fd .15s ease both", overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 4 }}>Connected</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)" }}>{shortAddr(address, 8)}</div>
                </div>
                {[
                  { label: "Copy address", icon: "⎘", action: () => { navigator.clipboard?.writeText(address); setWalletOpen(false); } },
                  { label: "New distribution", icon: "↗", action: () => { router.push("/distribute"); setWalletOpen(false); } },
                  { label: "My distributions", icon: "▦", action: () => { router.push("/dashboard"); setWalletOpen(false); } },
                  { label: "Claim allocations", icon: "↓", action: () => { router.push("/claim"); setWalletOpen(false); } },
                ].map(item => (
                  <div key={item.label} onClick={item.action} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", cursor: "pointer", fontSize: 13.5, color: "var(--mid)", transition: "background .15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--overlay)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--soft)", width: 14, textAlign: "center" }}>{item.icon}</span>
                    {item.label}
                  </div>
                ))}
                <div style={{ borderTop: "1px solid var(--line)" }}>
                  <div onClick={() => { disconnect(); setWalletOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", cursor: "pointer", fontSize: 13.5, color: "var(--accent)", transition: "background .15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(200,71,43,.07)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, width: 14, textAlign: "center" }}>⏏</span>
                    Disconnect
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            onClick={openConnectModal}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--ink)", color: "var(--page-bg)", padding: "10px 20px", borderRadius: 2, fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all .4s" }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6FAF8E" }} />
            Connect wallet
          </div>
        )}
      </div>

      {/* Drawers */}
      {sotto.showSdk && <SDKDrawer />}
      {sotto.showNotif && <NotifDrawer />}
    </header>
  );
}

function SDKDrawer() {
  const sotto = useSotto();
  // The actual calls Sotto makes — copied from src/app/distribute/page.tsx.
  const lines = [
    { text: `import {`, c: "var(--ink)" },
    { text: `  createConfidentialAirdropFactoryClient,`, c: "var(--mid)" },
    { text: `  encryptUint64, signClaimAuthorization,`, c: "var(--mid)" },
    { text: `} from '@tokenops/sdk/fhe-airdrop';`, c: "var(--ink)" },
    { text: ``, c: "var(--soft)" },
    { text: `// 1 · deploy + fund the sealed airdrop`, c: "var(--soft)" },
    { text: `const factory = createConfidentialAirdropFactoryClient(`, c: "var(--ink)" },
    { text: `  { publicClient, walletClient, encryptor });`, c: "var(--ink)" },
    { text: `const { hash, airdrop } =`, c: "var(--ink)" },
    { text: `  await factory.createAndFundConfidentialAirdrop({`, c: "var(--ink)" },
    { text: `    params: { token, startTimestamp, endTimestamp,`, c: "#6FAF8E" },
    { text: `      canExtendClaimWindow: true, admin },`, c: "#6FAF8E" },
    { text: `    userSalt, amount: total });`, c: "#6FAF8E" },
    { text: ``, c: "var(--soft)" },
    { text: `// 2 · FHE-encrypt each amount to its recipient`, c: "var(--soft)" },
    { text: `const enc = await encryptUint64({ encryptor,`, c: "var(--ink)" },
    { text: `  contractAddress: airdrop, userAddress: recipient,`, c: "var(--mid)" },
    { text: `  value });`, c: "var(--mid)" },
    { text: `const sig = await signClaimAuthorization({`, c: "var(--ink)" },
    { text: `  walletClient, airdropAddress: airdrop,`, c: "var(--mid)" },
    { text: `  recipient, encryptedAmountHandle: enc.handle });`, c: "var(--mid)" },
  ];
  return (
    <>
      <div onClick={sotto.toggleSdk} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(6,5,4,.45)", backdropFilter: "blur(3px)", animation: "fd .2s ease both" }} />
      <div onClick={(e) => e.stopPropagation()} style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 480, zIndex: 71, background: "var(--surface)", borderLeft: "1px solid var(--line)", display: "flex", flexDirection: "column", animation: "slideInR .3s cubic-bezier(.22,.85,.2,1) both", boxShadow: "-20px 0 60px rgba(0,0,0,.35)", transition: "background .4s, border-color .4s" }}>
        <div style={{ padding: "24px 26px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--ink)" }}>SDK Preview</div>
            <div style={{ fontSize: 12.5, color: "var(--mid)", marginTop: 3 }}>Example integration with the TokenOps SDK</div>
          </div>
          <button onClick={sotto.toggleSdk} aria-label="Close SDK drawer" style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--mid)", fontSize: 18, background: "none", border: "none" }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 26px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.75, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 4, padding: "18px", overflowX: "auto" }}>
            {lines.map((l, i) => (
              <div key={i} style={{ color: l.c, animation: `sdkLine .25s ${(i * 0.05).toFixed(2)}s ease both`, opacity: 0, animationFillMode: "both", whiteSpace: "pre" }}>{l.text || " "}</div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: "14px 16px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 3 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 6 }}>TokenOps SDK</div>
            <div style={{ fontSize: 13, color: "var(--mid)", lineHeight: 1.5 }}>The SDK wraps the Zama FHE library to encrypt, prove, and broadcast in one call.</div>
          </div>
        </div>
      </div>
    </>
  );
}

function NotifDrawer() {
  const sotto = useSotto();
  const { address } = useAccount();
  const [notifs, setNotifs] = useState<{ title: string; time: string; dot: string; glow: boolean }[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Build REAL activity from the connected admin's campaigns.
  useEffect(() => {
    if (!address) { setLoaded(true); return; }
    fetch(`/api/campaigns?admin=${address}`)
      .then(r => r.json())
      .then(d => {
        const campaigns = Array.isArray(d?.campaigns) ? d.campaigns : [];
        const items = campaigns
          .sort((a: { createdAt: number }, b: { createdAt: number }) => b.createdAt - a.createdAt)
          .slice(0, 6)
          .map((c: { name: string; recipientCount: number; createdAt: number }, i: number) => ({
            title: `${c.name} sealed · ${c.recipientCount} recipient${c.recipientCount === 1 ? "" : "s"} ready to claim`,
            time: timeAgo(c.createdAt),
            dot: i === 0 ? "var(--accent)" : "#6FAF8E",
            glow: i === 0,
          }));
        setNotifs(items);
      })
      .catch(() => setNotifs([]))
      .finally(() => setLoaded(true));
  }, [address]);

  return (
    <>
      <div onClick={sotto.toggleNotif} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(6,5,4,.38)", backdropFilter: "blur(3px)", animation: "fd .2s ease both" }} />
      <div onClick={(e) => e.stopPropagation()} style={{ position: "fixed", right: 0, top: 56, bottom: 0, width: 360, zIndex: 71, background: "var(--surface)", borderLeft: "1px solid var(--line)", display: "flex", flexDirection: "column", animation: "slideInR .28s cubic-bezier(.22,.85,.2,1) both" }}>
        <div style={{ padding: "22px 24px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--ink)" }}>Activity</div>
          <button onClick={sotto.markAllRead} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", cursor: "pointer", background: "none", border: "none" }}>Mark all read</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {!loaded ? (
            <div style={{ padding: "22px", display: "flex", alignItems: "center", gap: 10 }}>
              <div className="s-spinner" style={{ width: 14, height: 14 }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--soft)" }}>Loading activity…</span>
            </div>
          ) : notifs.length === 0 ? (
            <div style={{ padding: "32px 22px", textAlign: "center", fontSize: 13, color: "var(--soft)", lineHeight: 1.6 }}>
              No activity yet.<br />Create a distribution to see it here.
            </div>
          ) : (
            notifs.map((n, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 22px", borderBottom: "1px solid var(--line)", animation: `notifIn .3s ${(i * 0.06).toFixed(2)}s ease both` }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: n.dot, flexShrink: 0, marginTop: 5, animation: n.glow ? "glow 2s ease-in-out infinite" : "none" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.4 }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: "var(--soft)", marginTop: 4, fontFamily: "var(--font-mono)" }}>{n.time}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
