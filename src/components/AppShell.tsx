"use client";

import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useRouter, usePathname } from "next/navigation";
import { useSotto } from "@/context/SottoContext";
import { shortAddr } from "@/lib/format";

export function AppShell() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const router = useRouter();
  const path = usePathname();
  const sotto = useSotto();
  const isDark = sotto.mode === "dark";

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
          {!sotto.notifRead && (
            <span style={{ position: "absolute", top: -4, right: -4, width: 14, height: 14, borderRadius: "50%", background: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 8, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>3</span>
          )}
        </div>

        {/* Wallet */}
        {isConnected && address ? (
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 2, border: "1px solid var(--line)", cursor: "pointer", transition: "border-color .2s" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6FAF8E", animation: "float 2.4s ease-in-out infinite" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--mid)" }}>{shortAddr(address, 4)}</span>
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
  const lines = [
    { text: `import { TokenOps } from '@tokenops/sdk';`, c: "var(--mid)" },
    { text: ``, c: "var(--soft)" },
    { text: `// Initialize on Sepolia`, c: "var(--soft)" },
    { text: `const client = new TokenOps({`, c: "var(--ink)" },
    { text: `  network: 'sepolia',`, c: "#6FAF8E" },
    { text: `  wallet: await getWallet(),`, c: "var(--mid)" },
    { text: `});`, c: "var(--ink)" },
    { text: ``, c: "var(--soft)" },
    { text: `// Create confidential distribution`, c: "var(--soft)" },
    { text: `const dist = await client.distribution.create({`, c: "var(--ink)" },
    { text: `  token:   'cUSDT',`, c: "#6FAF8E" },
    { text: `  method: 'airdrop',`, c: "#6FAF8E" },
    { text: `  recipients: encryptRecipients([...]),`, c: "var(--ink)" },
    { text: `});`, c: "var(--ink)" },
    { text: ``, c: "var(--soft)" },
    { text: `// Generate ZK proof + seal`, c: "var(--soft)" },
    { text: `const proof = await dist.generateZKProof();`, c: "var(--mid)" },
    { text: `const tx = await dist.seal({ proof });`, c: "var(--mid)" },
  ];
  return (
    <>
      <div onClick={sotto.toggleSdk} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(6,5,4,.45)", backdropFilter: "blur(3px)", animation: "fd .2s ease both" }} />
      <div onClick={(e) => e.stopPropagation()} style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 480, zIndex: 71, background: "var(--surface)", borderLeft: "1px solid var(--line)", display: "flex", flexDirection: "column", animation: "slideInR .3s cubic-bezier(.22,.85,.2,1) both", boxShadow: "-20px 0 60px rgba(0,0,0,.35)", transition: "background .4s, border-color .4s" }}>
        <div style={{ padding: "24px 26px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--ink)" }}>SDK Preview</div>
            <div style={{ fontSize: 12.5, color: "var(--mid)", marginTop: 3 }}>Live-generated from your current configuration</div>
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
  const notifs = [
    { title: "Distribution sealed · recipients ready to claim", time: "2 min ago", dot: "var(--accent)", glow: true },
    { title: "0x4f29…b2A1 claimed their allocation", time: "18 min ago", dot: "#6FAF8E", glow: true },
    { title: "0xc1aE…9Fd0 claimed their allocation", time: "1h ago", dot: "#6FAF8E", glow: false },
    { title: "Previous distribution sealed · 37 recipients", time: "3 days ago", dot: "var(--soft)", glow: false },
  ];
  return (
    <>
      <div onClick={sotto.toggleNotif} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(6,5,4,.38)", backdropFilter: "blur(3px)", animation: "fd .2s ease both" }} />
      <div onClick={(e) => e.stopPropagation()} style={{ position: "fixed", right: 0, top: 56, bottom: 0, width: 360, zIndex: 71, background: "var(--surface)", borderLeft: "1px solid var(--line)", display: "flex", flexDirection: "column", animation: "slideInR .28s cubic-bezier(.22,.85,.2,1) both" }}>
        <div style={{ padding: "22px 24px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--ink)" }}>Activity</div>
          <button onClick={sotto.markAllRead} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", cursor: "pointer", background: "none", border: "none" }}>Mark all read</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {notifs.map((n, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 22px", borderBottom: "1px solid var(--line)", animation: `notifIn .3s ${(i * 0.06).toFixed(2)}s ease both` }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: n.dot, flexShrink: 0, marginTop: 5, animation: n.glow ? "glow 2s ease-in-out infinite" : "none" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.4 }}>{n.title}</div>
                <div style={{ fontSize: 12, color: "var(--soft)", marginTop: 4, fontFamily: "var(--font-mono)" }}>{n.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
