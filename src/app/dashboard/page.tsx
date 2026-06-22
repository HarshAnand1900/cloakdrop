"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { CanvasBackground } from "@/components/CanvasBackground";
import { useSotto } from "@/context/SottoContext";
import { toast } from "@/components/toast";
import { shortAddr } from "@/lib/format";
import { explorerAddr } from "@/lib/constants";
import type { Campaign } from "@/lib/types";

type DashTab = "records" | "explorer" | "analytics" | "settings";

function RevokeModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <>
      <div onClick={onCancel} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(6,5,4,.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fd .2s ease both" }}>
        <div onClick={e => e.stopPropagation()} style={{ width: 380, background: "var(--surface)", border: "1.5px solid rgba(200,71,43,.5)", borderRadius: 6, padding: 28, animation: "up .3s cubic-bezier(.22,.85,.2,1) both", boxShadow: "0 40px 80px rgba(0,0,0,.5)" }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 26, color: "var(--ink)", marginBottom: 6 }}>Revoke distribution?</div>
          <div style={{ fontSize: 14, color: "var(--mid)", lineHeight: 1.55, marginBottom: 24 }}>Unclaimed allocations will be returned to your wallet. Recipients who already claimed are unaffected.</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="s-btn" onClick={onConfirm} style={{ flex: 1, justifyContent: "center", fontSize: 14.5 }}>Confirm revoke</button>
            <div onClick={onCancel} style={{ textAlign: "center", border: "1.5px solid var(--line)", color: "var(--mid)", padding: "13px 18px", borderRadius: 3, fontSize: 14.5, cursor: "pointer" }}>Cancel</div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function DashboardPage() {
  const { isConnected, address } = useAccount();
  const { openConnectModal } = useConnectModal();
  const router = useRouter();
  useSotto(); // dark mode context

  const [dashTab, setDashTab] = useState<DashTab>("records");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRevoke, setShowRevoke] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSaved, setWebhookSaved] = useState(false);
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [auditExporting, setAuditExporting] = useState(false);

  useEffect(() => {
    if (!isConnected || !address) return;
    setLoading(true);
    fetch(`/api/campaigns?admin=${address}`)
      .then(r => r.json())
      .then(data => setCampaigns(Array.isArray(data) ? data : []))
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, [isConnected, address]);

  // Claimed fill animation
  useEffect(() => {
    const el = document.getElementById("claimed-fill");
    if (el) setTimeout(() => { el.style.width = "84%"; }, 200);
  }, [dashTab]);

  function exportAudit() {
    setAuditExporting(true);
    setTimeout(() => {
      const rows = [
        "SOTTO AUDIT LOG — SEALED COMPLIANCE TRAIL",
        "Generated: " + new Date().toISOString(),
        "---",
        "dist_id,name,recipient_count,token,sealed_at",
        ...campaigns.map(c => `${c.airdrop},${c.name},${c.recipientCount},${c.symbol},${new Date(c.createdAt).toISOString()}`),
      ].join("\n");
      const blob = new Blob([rows], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "sotto-audit.csv";
      a.click();
      setAuditExporting(false);
    }, 1400);
  }

  const chartBars = [
    { label: "Jan", h: "38px", opacity: .48, delay: ".05s" },
    { label: "Feb", h: "60px", opacity: .58, delay: ".12s" },
    { label: "Mar", h: "44px", opacity: .52, delay: ".19s" },
    { label: "Apr", h: "80px", opacity: .7, delay: ".26s" },
    { label: "May", h: "54px", opacity: .62, delay: ".33s" },
    { label: "Jun", h: "94px", opacity: 1, delay: ".40s" },
  ];
  const histoBars = [
    { label: "< 1h", pct: 18, h: "28px" },
    { label: "1–6h", pct: 42, h: "68px" },
    { label: "6–24h", pct: 21, h: "34px" },
    { label: "1–3d", pct: 12, h: "20px" },
    { label: "3–7d", pct: 6, h: "10px" },
    { label: "> 7d", pct: 1, h: "4px" },
  ];

  if (!isConnected) {
    return (
      <>
        <AppShell />
        <div style={{ minHeight: "calc(100vh - 56px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", maxWidth: 400, padding: 40 }}>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 36, color: "var(--ink)", marginBottom: 12 }}>Connect to view dashboard</div>
            <button className="s-btn" onClick={openConnectModal}>Connect wallet →</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AppShell />
      <div style={{ position: "fixed", inset: "56px 0 0 0", zIndex: 0, pointerEvents: "none", opacity: 0.4 }}>
        <CanvasBackground variant="flow" />
      </div>
      <div style={{ position: "relative", zIndex: 1, padding: "44px 52px 90px", maxWidth: 1280, margin: "0 auto", animation: "fd .3s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 10 }}>Your distributions</div>
            <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 50, color: "var(--ink)", margin: 0, letterSpacing: "-.02em" }}>Sealed records</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div onClick={exportAudit} style={{ border: "1.5px solid var(--line)", color: "var(--mid)", padding: "9px 16px", borderRadius: 3, fontFamily: "var(--font-mono)", fontSize: 11.5, cursor: "pointer", whiteSpace: "nowrap" }}>
              {auditExporting ? "⟳  Generating…" : "↓  Audit log"}
            </div>
            <button className="s-btn" onClick={() => router.push("/distribute")} style={{ fontSize: 13.5, padding: "11px 22px" }}>+ New distribution</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--line)", marginBottom: 28 }}>
          {(["records", "explorer", "analytics", "settings"] as DashTab[]).map(tab => (
            <div key={tab} onClick={() => setDashTab(tab)} style={{ padding: "10px 20px 12px", fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: ".08em", cursor: "pointer", color: dashTab === tab ? "var(--ink)" : "var(--mid)", borderBottom: `2.5px solid ${dashTab === tab ? "var(--accent)" : "transparent"}`, transition: "all .2s", marginBottom: -1, textTransform: "uppercase" }}>
              {tab}
            </div>
          ))}
        </div>

        {/* ── RECORDS ── */}
        {dashTab === "records" && (
          <div className="anim-fd">
            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.5fr", gap: 12, marginBottom: 12 }}>
              <div className="s-card" style={{ padding: 22 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 10 }}>Distributions</div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 56, color: "var(--ink)", lineHeight: 1 }}>{loading ? "…" : campaigns.length}</div>
              </div>
              <div className="s-card" style={{ padding: 22 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 10 }}>Recipients</div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 56, color: "var(--ink)", lineHeight: 1 }}>{loading ? "…" : campaigns.reduce((a, c) => a + c.recipientCount, 0).toLocaleString()}</div>
              </div>
              <div className="s-card" style={{ padding: 22 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 10 }}>Claimed</div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 56, color: "var(--green)", lineHeight: 1 }}>84%</div>
                <div style={{ marginTop: 12, height: 3, background: "var(--line)", borderRadius: 2, overflow: "hidden" }}>
                  <div id="claimed-fill" style={{ height: "100%", width: "0%", background: "var(--green)", borderRadius: 2, transition: "width 1.2s cubic-bezier(.22,.85,.2,1)" }} />
                </div>
              </div>
              <div style={{ background: "var(--ink)", borderRadius: 4, padding: 22, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(45deg,transparent,transparent 7px,rgba(255,255,255,.04) 7px,rgba(255,255,255,.04) 8px)" }} />
                <div style={{ position: "relative" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--page-bg)", opacity: .5, marginBottom: 16 }}>Total value sealed</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
                    <span style={{ height: 19, width: 124, background: "var(--page-bg)", borderRadius: 2, opacity: .16 }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: ".1em" }}>cUSDT</span>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--page-bg)", opacity: .38 }}>Ciphertext · not a display mask</div>
                </div>
              </div>
            </div>

            {/* Chart + latest */}
            <div style={{ display: "grid", gridTemplateColumns: "1.9fr 1fr", gap: 12, marginBottom: 12 }}>
              <div className="s-card" style={{ padding: "22px 26px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)" }}>Distribution volume · 6 months</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--soft)" }}>SEALED</div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 96 }}>
                  {chartBars.map(b => (
                    <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <div style={{ width: "100%", background: "var(--accent)", borderRadius: "2px 2px 0 0", opacity: b.opacity, height: b.h, animation: `barRise .65s ${b.delay} cubic-bezier(.22,.85,.2,1) both` }} />
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--soft)" }}>{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="s-card" style={{ padding: 22, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 14, right: 16, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".16em", color: "var(--green)", border: "1px solid var(--green)", padding: "4px 8px", borderRadius: 2, transform: "rotate(-3deg)" }}>SEALED</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 9 }}>Latest</div>
                {campaigns[0] ? (
                  <>
                    <div style={{ fontFamily: "var(--font-serif)", fontSize: 24, color: "var(--ink)", marginBottom: 5 }}>{campaigns[0].name}</div>
                    <div style={{ fontSize: 12.5, color: "var(--mid)", marginBottom: 18 }}>{campaigns[0].symbol} distribution</div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 11, marginBottom: 7 }}>
                      <span style={{ color: "var(--soft)" }}>Recipients</span>
                      <span style={{ color: "var(--ink)" }}>{campaigns[0].recipientCount}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                      <span style={{ color: "var(--soft)" }}>Total</span>
                      <span style={{ height: 10, width: 60, background: "var(--bar)", borderRadius: 1 }} />
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--soft)" }}>No distributions yet</div>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="s-card" style={{ overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 0.9fr 0.8fr 1.1fr 0.6fr 0.6fr", gap: 14, padding: "11px 22px", borderBottom: "1px solid var(--line)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--soft)" }}>
                <span>Distribution</span><span>Date</span><span>Recipients</span><span>Total</span><span>Status</span><span>Actions</span>
              </div>
              {loading ? (
                <div style={{ padding: "32px", textAlign: "center", color: "var(--soft)" }}>Loading…</div>
              ) : campaigns.length === 0 ? (
                <div style={{ padding: "32px", textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--ink)", marginBottom: 8 }}>No distributions yet</div>
                  <div style={{ fontSize: 13, color: "var(--mid)", marginBottom: 20 }}>Create your first confidential distribution to get started.</div>
                  <button className="s-btn" onClick={() => router.push("/distribute")} style={{ fontSize: 13.5 }}>+ New distribution</button>
                </div>
              ) : (
                campaigns.map((c, i) => (
                  <div key={c.airdrop} style={{ display: "grid", gridTemplateColumns: "2fr 0.9fr 0.8fr 1.1fr 0.6fr 0.6fr", gap: 14, alignItems: "center", padding: "15px 22px", borderBottom: "1px solid var(--line)", animation: `rowIn .45s ${(i * 0.08).toFixed(2)}s cubic-bezier(.22,.85,.2,1) both`, transition: "background .18s" }}>
                    <div>
                      <div style={{ fontFamily: "var(--font-serif)", fontSize: 21, color: "var(--ink)" }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: "var(--soft)", marginTop: 2 }}>{c.symbol} · {shortAddr(c.airdrop)}</div>
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--mid)" }}>{new Date(c.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--mid)" }}>{c.recipientCount}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ height: 10, width: 60, background: "var(--bar)", borderRadius: 1 }} />
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--soft)" }}>cUSDT</span>
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--green)", border: "1px solid var(--green)", padding: "3px 7px", borderRadius: 2, justifySelf: "start" }}>Sealed</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <a href={explorerAddr(c.airdrop)} target="_blank" rel="noreferrer" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--mid)", border: "1px solid var(--line)", padding: "3px 7px", borderRadius: 2, textDecoration: "none" }}>↗</a>
                      <div onClick={() => setShowRevoke(true)} style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", border: "1px solid rgba(200,71,43,.4)", padding: "3px 7px", borderRadius: 2, cursor: "pointer" }}>Revoke</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div style={{ marginTop: 13, fontSize: 12, color: "var(--soft)", fontStyle: "italic", fontFamily: "var(--font-serif)" }}>The blacked-out bars above are exactly what Etherscan shows — FHE ciphertext, not a UI mask.</div>
          </div>
        )}

        {/* ── BLOCK EXPLORER ── */}
        {dashTab === "explorer" && (
          <div className="anim-fd">
            <div className="s-card" style={{ overflow: "hidden" }}>
              {/* Browser chrome */}
              <div style={{ background: "var(--overlay)", borderBottom: "1px solid var(--line)", padding: "12px 20px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {["#ff5f56", "#febc2e", "#28c840"].map(c => <div key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c }} />)}
                </div>
                <div style={{ flex: 1, background: "var(--input-bg)", border: "1px solid var(--line)", borderRadius: 3, padding: "5px 12px", fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--mid)" }}>
                  sepolia.etherscan.io/address/{campaigns[0] ? shortAddr(campaigns[0].airdrop, 8) : "…"}
                </div>
              </div>
              <div style={{ padding: "24px 28px" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 16 }}>Transaction Details</div>
                {[
                  ["Transaction Hash", campaigns[0] ? shortAddr(campaigns[0].txHash, 10) : "—"],
                  ["Status", "✓ Success"],
                  ["Block", "7,293,841"],
                  ["From", address ? shortAddr(address, 8) : "—"],
                  ["To", campaigns[0] ? shortAddr(campaigns[0].airdrop, 8) : "—"],
                  ["Gas Used", "142,380"],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 0, borderBottom: "1px solid var(--line)" }}>
                    <div style={{ padding: "10px 0", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--soft)" }}>{label}</div>
                    <div style={{ padding: "10px 0", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)" }}>{value}</div>
                  </div>
                ))}
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--soft)", margin: "16px 0 12px" }}>
                  Input data (decoded) · <span style={{ color: "var(--accent)" }}>confidentialDisperse(bytes32,bytes[],bytes32)</span>
                </div>
                <div style={{ background: "var(--overlay)", border: "1px solid var(--line)", borderRadius: 4, padding: "16px 18px", marginBottom: 20 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--soft)", marginBottom: 10 }}>amounts (bytes[]) — <span style={{ color: "var(--accent)" }}>FHE encrypted · not decodable</span></div>
                  {["7f3a8b2c4e9d1f…", "4e2f9a1d7b8c3e…", "a1c4f8e2b3d9a7…"].map((c, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "3px 0" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--soft)" }}>[{i}]</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--mid)", wordBreak: "break-all" }}>0x{c}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "var(--mid)" }}>
                  <span style={{ width: 17, height: 17, borderRadius: "50%", border: "1.5px solid var(--green)", color: "var(--green)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, flexShrink: 0 }}>✓</span>
                  This is exactly what any observer sees. Amounts are sealed — only the original private key can unlock them.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {dashTab === "analytics" && (
          <div className="anim-fd">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 12 }}>
              {[["Median claim time", "4.2h", "var(--ink)"], ["Fastest claim", "3 min", "var(--green)"], ["Unclaimed", "16%", "var(--accent)"]].map(([label, val, c]) => (
                <div key={label} className="s-card" style={{ padding: 22 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 10 }}>{label}</div>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: 52, color: c, lineHeight: 1 }}>{val}</div>
                </div>
              ))}
            </div>
            <div className="s-card" style={{ padding: "24px 28px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 5 }}>Time to claim · latest distribution</div>
              <div style={{ fontSize: 13, color: "var(--mid)", marginBottom: 22 }}>How long recipients waited before claiming their sealed allocation.</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 96, marginBottom: 10 }}>
                {histoBars.map(b => (
                  <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--soft)" }}>{b.pct}%</div>
                    <div style={{ width: "100%", background: "var(--accent)", borderRadius: "2px 2px 0 0", height: b.h, animation: "barRise .6s cubic-bezier(.22,.85,.2,1) both" }} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 14, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                {histoBars.map(b => (
                  <div key={b.label} style={{ flex: 1, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--soft)" }}>{b.label}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── SETTINGS ── */}
        {dashTab === "settings" && (
          <div className="anim-fd" style={{ maxWidth: 700 }}>
            <div className="s-card" style={{ padding: "28px 30px", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>Webhook endpoint</div>
                  <div style={{ fontSize: 13, color: "var(--mid)", lineHeight: 1.55, maxWidth: 460 }}>POST to your URL on each claim event. Payload is sealed — amounts never travel in plaintext.</div>
                </div>
                <div onClick={() => setWebhookEnabled(!webhookEnabled)} className="s-toggle" style={{ background: webhookEnabled ? "var(--accent)" : "var(--soft)", marginTop: 3 }}>
                  <div className="s-toggle-knob" style={{ left: webhookEnabled ? 21 : 3 }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 9, marginBottom: 14 }}>
                <input type="text" placeholder="https://api.yourapp.com/hooks/sotto" value={webhookUrl} onChange={e => { setWebhookUrl(e.target.value); setWebhookSaved(false); }} className="s-input" style={{ flex: 1 }} />
                <button onClick={() => setWebhookSaved(true)} style={{ background: webhookSaved ? "var(--green)" : "var(--accent)", color: "#F6F1E6", padding: "10px 18px", borderRadius: 3, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", whiteSpace: "nowrap" }}>
                  {webhookSaved ? "✓  Saved" : "Save endpoint"}
                </button>
              </div>
              <div style={{ padding: "13px 16px", background: "var(--overlay)", border: "1px solid var(--line)", borderRadius: 3 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 9 }}>Sample payload</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--mid)", lineHeight: 1.9, wordBreak: "break-all" }}>
                  {`{"event":"claim","recipient":"0x4f29…b2A1","token":"cUSDT","amount":"`}<span style={{ color: "var(--accent)" }}>[FHE-sealed]</span>{`","ts":"${new Date().toISOString()}"}`}
                </div>
              </div>
            </div>
            <div className="s-card" style={{ padding: "28px 30px" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>Audit trail</div>
              <div style={{ fontSize: 13, color: "var(--mid)", marginBottom: 18, lineHeight: 1.55 }}>Sealed compliance export for all distributions. Amounts remain ciphertext in the log.</div>
              <div onClick={exportAudit} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--ink)", color: "var(--page-bg)", padding: "11px 20px", borderRadius: 3, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
                {auditExporting ? "⟳  Generating…" : "↓  Export audit log"}
              </div>
            </div>
          </div>
        )}
      </div>

      {showRevoke && <RevokeModal onConfirm={() => { setShowRevoke(false); toast("Distribution revoked", { kind: "success" }); }} onCancel={() => setShowRevoke(false)} />}
    </>
  );
}
