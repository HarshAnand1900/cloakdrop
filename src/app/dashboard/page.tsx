"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useRouter } from "next/navigation";
import type { Hex, Address } from "viem";
import { createConfidentialAirdropClient } from "@tokenops/sdk/fhe-airdrop";
import { humanizeError } from "@/components/Faucet";
import { AppShell } from "@/components/AppShell";
import { QRCode } from "@/components/QRCode";
import { CanvasBackground } from "@/components/CanvasBackground";
import { DistributionDetail } from "@/components/DistributionDetail";
import { SkeletonRow, SkeletonCard } from "@/components/Skeleton";
import { useSotto } from "@/context/SottoContext";
import { toast } from "@/components/toast";
import { shortAddr, timeAgo } from "@/lib/format";
import type { Campaign } from "@/lib/types";

type DashTab = "records" | "explorer" | "analytics" | "settings";

/** Real per-campaign claim stats, computed on-chain. */
interface ClaimStat {
  total: number;
  claimed: number;
  recipients: { recipient: string; handle: Hex; claimed: boolean }[];
}

function RevokeModal({ campaign, onDone, onCancel }: { campaign: Campaign; onDone: (hash: Hex) => void; onCancel: () => void }) {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!publicClient || !walletClient || !address) return;
    setBusy(true);
    try {
      // Real on-chain reclaim: admin withdraws all remaining sealed tokens.
      const client = createConfidentialAirdropClient({ publicClient, walletClient, address: campaign.airdrop as Address });
      const hash = await client.withdraw(address);
      await publicClient.waitForTransactionReceipt({ hash });
      onDone(hash);
    } catch (e) {
      toast(humanizeError(e), { kind: "error" });
      setBusy(false);
    }
  }

  return (
    <div onClick={busy ? undefined : onCancel} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(6,5,4,.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fd .2s ease both" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 400, background: "var(--surface)", border: "1.5px solid rgba(200,71,43,.5)", borderRadius: 6, padding: 28, animation: "up .3s cubic-bezier(.22,.85,.2,1) both", boxShadow: "0 40px 80px rgba(0,0,0,.5)" }}>
        <div style={{ fontFamily: "var(--font-serif)", fontSize: 26, color: "var(--ink)", marginBottom: 6 }}>Revoke distribution?</div>
        <div style={{ fontSize: 13.5, color: "var(--mid)", lineHeight: 1.55, marginBottom: 8 }}>
          This calls <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>withdraw()</span> on <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{shortAddr(campaign.airdrop)}</span> — all <strong style={{ color: "var(--ink)" }}>unclaimed</strong> sealed tokens return to your wallet.
        </div>
        <div style={{ fontSize: 13, color: "var(--mid)", lineHeight: 1.55, marginBottom: 24 }}>Recipients who already claimed are unaffected. Admin-only — requires a wallet signature.</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="s-btn" onClick={confirm} disabled={busy} style={{ flex: 1, justifyContent: "center", fontSize: 14.5, opacity: busy ? 0.6 : 1 }}>
            {busy ? "Revoking…" : "Confirm revoke"}
          </button>
          <button onClick={onCancel} disabled={busy} style={{ textAlign: "center", border: "1.5px solid var(--line)", color: "var(--mid)", padding: "13px 18px", borderRadius: 3, fontSize: 14.5, cursor: "pointer", background: "none" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { isConnected, address } = useAccount();
  const publicClient = usePublicClient();
  const { openConnectModal } = useConnectModal();
  const router = useRouter();
  useSotto(); // dark mode context

  const [dashTab, setDashTab] = useState<DashTab>("records");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, ClaimStat>>({});
  const [statsLoading, setStatsLoading] = useState(true);
  const [revokeCampaign, setRevokeCampaign] = useState<Campaign | null>(null);
  const [revokedSet, setRevokedSet] = useState<Set<string>>(new Set());
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);
  const [search, setSearch] = useState("");
  const [recFilter, setRecFilter] = useState<"all" | "sealed" | "revoked">("all");
  const [recSort, setRecSort] = useState<"recent" | "recipients" | "claimed">("recent");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [webhookSaved, setWebhookSaved] = useState(false);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [auditExporting, setAuditExporting] = useState(false);
  const [receipt, setReceipt] = useState<{ blockNumber: string; gasUsed: string; status: string } | null>(null);
  const [explorerIdx, setExplorerIdx] = useState(0);
  const [qrModal, setQrModal] = useState<string | null>(null);
  const [qrCopied, setQrCopied] = useState(false);

  useEffect(() => {
    if (!isConnected || !address) return;
    setLoading(true);
    fetch(`/api/campaigns?admin=${address}`)
      .then(r => r.json())
      .then(data => setCampaigns(Array.isArray(data?.campaigns) ? data.campaigns : Array.isArray(data) ? data : []))
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
    // Load saved webhook config
    fetch(`/api/webhook?admin=${address}`)
      .then(r => r.json())
      .then(d => { setWebhookUrl(d.url ?? ""); setWebhookEnabled(!!d.enabled); })
      .catch(() => {});
  }, [isConnected, address]);

  // Compute REAL claim stats on-chain for every campaign.
  useEffect(() => {
    if (!publicClient || campaigns.length === 0) {
      if (campaigns.length === 0) setStatsLoading(false);
      return;
    }
    let alive = true;
    setStatsLoading(true);
    (async () => {
      const out: Record<string, ClaimStat> = {};
      await Promise.all(
        campaigns.map(async (c) => {
          try {
            const res = await fetch(`/api/campaigns?airdrop=${c.airdrop}`);
            const data = await res.json();
            const recs: { recipient: string; handle: Hex }[] = Array.isArray(data?.recipients) ? data.recipients : [];
            const client = createConfidentialAirdropClient({ publicClient, address: c.airdrop as Hex });
            const checked = await Promise.all(
              recs.map(async (r) => {
                try {
                  const claimed = await client.isSignatureClaimed(r.recipient as Hex, r.handle);
                  return { recipient: r.recipient, handle: r.handle, claimed: !!claimed };
                } catch {
                  return { recipient: r.recipient, handle: r.handle, claimed: false };
                }
              }),
            );
            out[c.airdrop.toLowerCase()] = {
              total: recs.length || c.recipientCount,
              claimed: checked.filter((x) => x.claimed).length,
              recipients: checked,
            };
          } catch {
            out[c.airdrop.toLowerCase()] = { total: c.recipientCount, claimed: 0, recipients: [] };
          }
        }),
      );
      if (alive) { setStats(out); setStatsLoading(false); }
    })();
    return () => { alive = false; };
  }, [publicClient, campaigns]);

  // Fetch the REAL receipt for the selected campaign when the explorer tab opens.
  useEffect(() => {
    const selected = campaigns[explorerIdx];
    if (dashTab !== "explorer" || !publicClient || !selected) return;
    let alive = true;
    setReceipt(null);
    (async () => {
      try {
        const r = await publicClient.getTransactionReceipt({ hash: selected.txHash as Hex });
        if (alive) setReceipt({ blockNumber: r.blockNumber.toString(), gasUsed: r.gasUsed.toString(), status: r.status });
      } catch { /* tx may be too old to fetch receipt */ }
    })();
    return () => { alive = false; };
  }, [dashTab, publicClient, campaigns, explorerIdx]);

  // Aggregate real totals
  const totalRecipients = campaigns.reduce((a, c) => a + c.recipientCount, 0);
  const totalClaimed = Object.values(stats).reduce((a, s) => a + s.claimed, 0);
  const claimRate = totalRecipients > 0 ? Math.round((totalClaimed / totalRecipients) * 100) : 0;

  // Animate the claimed-fill bar to the REAL claim rate.
  useEffect(() => {
    const el = document.getElementById("claimed-fill");
    if (el) setTimeout(() => { el.style.width = `${claimRate}%`; }, 200);
  }, [dashTab, claimRate]);

  const isRevoked = (c: Campaign) => revokedSet.has(c.airdrop.toLowerCase());
  const sealedCount = campaigns.filter(c => !isRevoked(c)).length;
  const revokedCount = campaigns.filter(c => isRevoked(c)).length;

  // Filtered + sorted campaigns
  const filtered = campaigns
    .filter(c => {
      if (recFilter === "sealed" && isRevoked(c)) return false;
      if (recFilter === "revoked" && !isRevoked(c)) return false;
      if (!search) return true;
      return c.name.toLowerCase().includes(search.toLowerCase()) || c.airdrop.toLowerCase().includes(search.toLowerCase());
    })
    .sort((a, b) => {
      if (recSort === "recipients") return b.recipientCount - a.recipientCount;
      if (recSort === "claimed") {
        const ra = stats[a.airdrop.toLowerCase()]; const rb = stats[b.airdrop.toLowerCase()];
        const pa = ra && ra.total ? ra.claimed / ra.total : 0;
        const pb = rb && rb.total ? rb.claimed / rb.total : 0;
        return pb - pa;
      }
      return b.createdAt - a.createdAt; // recent by default
    });

  async function saveWebhook() {
    if (!address) return;
    setWebhookLoading(true);
    try {
      await fetch("/api/webhook", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ admin: address, url: webhookUrl, enabled: webhookEnabled }) });
      setWebhookSaved(true);
      setTimeout(() => setWebhookSaved(false), 3000);
    } catch { toast("Failed to save webhook", { kind: "error" }); }
    finally { setWebhookLoading(false); }
  }

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

  // REAL distributions-per-month over the last 6 months (from createdAt).
  const chartBars = (() => {
    const now = new Date();
    const months: { label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ label: d.toLocaleDateString("en-US", { month: "short" }), count: 0 });
    }
    campaigns.forEach((c) => {
      const d = new Date(c.createdAt);
      const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      if (monthsAgo >= 0 && monthsAgo < 6) months[5 - monthsAgo].count++;
    });
    const max = Math.max(1, ...months.map((m) => m.count));
    return months.map((m, i) => ({
      label: m.label,
      count: m.count,
      h: `${Math.max(m.count === 0 ? 2 : 14, Math.round((m.count / max) * 94))}px`,
      opacity: m.count === 0 ? 0.25 : 0.5 + (m.count / max) * 0.5,
      delay: `${(i * 0.07).toFixed(2)}s`,
    }));
  })();

  // REAL per-distribution claim-rate breakdown for the analytics tab.
  const analyticsRows = campaigns.map((c) => {
    const st = stats[c.airdrop.toLowerCase()];
    const rate = st && st.total > 0 ? Math.round((st.claimed / st.total) * 100) : 0;
    return { name: c.name, claimed: st?.claimed ?? 0, total: st?.total ?? c.recipientCount, rate };
  });
  const fullyClaimed = analyticsRows.filter((r) => r.total > 0 && r.claimed === r.total).length;
  const unclaimedPct = totalRecipients > 0 ? 100 - claimRate : 0;

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

        {/* Tabs + Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, borderBottom: "1px solid var(--line)", marginBottom: 28 }}>
          {(["records", "explorer", "analytics", "settings"] as DashTab[]).map(tab => (
            <div key={tab} onClick={() => setDashTab(tab)} role="tab" aria-selected={dashTab === tab} tabIndex={0} onKeyDown={e => e.key === "Enter" && setDashTab(tab)} style={{ padding: "10px 20px 12px", fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: ".08em", cursor: "pointer", color: dashTab === tab ? "var(--ink)" : "var(--mid)", borderBottom: `2.5px solid ${dashTab === tab ? "var(--accent)" : "transparent"}`, transition: "all .2s", marginBottom: -1, textTransform: "uppercase" }}>
              {tab}
            </div>
          ))}
          {dashTab === "records" && (
            <div style={{ marginLeft: "auto", position: "relative", marginBottom: -1 }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--soft)", fontSize: 13, pointerEvents: "none" }}>⌕</span>
              <input
                type="search"
                className="s-search"
                placeholder="Search distributions…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                aria-label="Search distributions"
                style={{ width: 220, paddingLeft: 30, fontSize: 12 }}
              />
            </div>
          )}
        </div>

        {/* ── RECORDS ── */}
        {dashTab === "records" && (
          <div className="anim-fd">
            {/* Stats row */}
            <div className="dash-stats" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.5fr", gap: 12, marginBottom: 12 }}>
              {loading ? (
                <>
                  <SkeletonCard lines={1} />
                  <SkeletonCard lines={1} />
                  <SkeletonCard lines={2} />
                </>
              ) : (
              <>
              <div className="s-card" style={{ padding: 22 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 10 }}>Distributions</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: 56, color: "var(--ink)", lineHeight: 1 }}>{campaigns.length}</div>
                  {(() => {
                    const weekAgo = Date.now() - 7 * 86400000;
                    const recent = campaigns.filter(c => c.createdAt >= weekAgo).length;
                    return recent > 0 ? <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--green)", letterSpacing: ".04em" }}>▲ {recent} this week</span> : null;
                  })()}
                </div>
              </div>
              <div className="s-card" style={{ padding: 22 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 10 }}>Recipients</div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 56, color: "var(--ink)", lineHeight: 1 }}>{totalRecipients.toLocaleString()}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--soft)", marginTop: 6 }}>across {campaigns.length} distribution{campaigns.length === 1 ? "" : "s"}</div>
              </div>
              <div className="s-card" style={{ padding: 22 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 10 }}>Claimed</div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 56, color: "var(--green)", lineHeight: 1 }}>
                  {statsLoading ? <span style={{ fontSize: 32, color: "var(--soft)" }}>…</span> : `${claimRate}%`}
                </div>
                <div style={{ marginTop: 12, height: 3, background: "var(--line)", borderRadius: 2, overflow: "hidden" }}>
                  <div id="claimed-fill" style={{ height: "100%", width: "0%", background: "var(--green)", borderRadius: 2, transition: "width 1.2s cubic-bezier(.22,.85,.2,1)" }} />
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--soft)", marginTop: 8 }}>
                  {statsLoading ? "checking on-chain…" : `${totalClaimed} / ${totalRecipients} recipients`}
                </div>
              </div>
              <div style={{ background: "var(--ink)", borderRadius: 4, padding: 22, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(45deg,transparent,transparent 7px,rgba(255,255,255,.04) 7px,rgba(255,255,255,.04) 8px)" }} />
                <div style={{ position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--page-bg)", opacity: .5 }}>Total value sealed</div>
                    {/* Lock icon */}
                    <div style={{ width: 13, height: 14, border: "1.4px solid var(--page-bg)", opacity: .45, borderRadius: 2, position: "relative" }}>
                      <div style={{ position: "absolute", left: "50%", top: -6, transform: "translateX(-50%)", width: 8, height: 7, border: "1.4px solid var(--page-bg)", borderBottom: "none", borderRadius: "5px 5px 0 0", opacity: .45 }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
                    <span style={{ height: 19, width: 124, background: "var(--page-bg)", borderRadius: 2, opacity: .16 }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: ".1em" }}>cUSDT</span>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--page-bg)", opacity: .38 }}>Ciphertext · only recipients decrypt</div>
                </div>
              </div>
              </>
              )}
            </div>

            {/* Chart + latest */}
            <div style={{ display: "grid", gridTemplateColumns: "1.9fr 1fr", gap: 12, marginBottom: 12 }}>
              <div className="s-card" style={{ padding: "22px 26px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)" }}>Distributions created · 6 months</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--soft)" }}>{campaigns.length} total</div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 96 }}>
                  {chartBars.map(b => (
                    <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: b.count > 0 ? "var(--ink)" : "var(--soft)" }}>{b.count > 0 ? b.count : ""}</div>
                      <div style={{ width: "100%", background: "var(--accent)", borderRadius: "2px 2px 0 0", opacity: b.opacity, height: b.h, animation: `barRise .65s ${b.delay} cubic-bezier(.22,.85,.2,1) both` }} />
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--soft)" }}>{b.label}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--soft)" }}>Count is public; amounts stay sealed.</div>
              </div>
              <div className="s-card" onClick={() => campaigns[0] && setDetailCampaign(campaigns[0])} style={{ padding: 22, position: "relative", overflow: "hidden", cursor: campaigns[0] ? "pointer" : "default" }}>
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

            {/* Toolbar: filter pills + sort + search */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {(["all", "sealed", "revoked"] as const).map(f => {
                  const n = f === "all" ? campaigns.length : f === "sealed" ? sealedCount : revokedCount;
                  return (
                    <div key={f} onClick={() => setRecFilter(f)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 999, border: `1px solid ${recFilter === f ? "var(--accent)" : "var(--line)"}`, background: recFilter === f ? "rgba(200,71,43,.1)" : "transparent", color: recFilter === f ? "var(--accent)" : "var(--soft)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".03em", cursor: "pointer", transition: "all .2s" }}>
                      {f.charAt(0).toUpperCase() + f.slice(1)} <span style={{ opacity: .55 }}>{n}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--soft)" }}>
                  <span style={{ letterSpacing: ".14em" }}>SORT</span>
                  {(["recent", "recipients", "claimed"] as const).map((s, i, arr) => (
                    <span key={s}>
                      <span onClick={() => setRecSort(s)} style={{ cursor: "pointer", color: recSort === s ? "var(--ink)" : "var(--soft)", transition: "color .2s" }}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
                      {i < arr.length - 1 && <span style={{ opacity: .4, margin: "0 4px" }}>·</span>}
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--input-bg)", border: "1px solid var(--line)", borderRadius: 3, padding: "6px 12px", width: 200, transition: "all .4s" }}>
                  <span style={{ color: "var(--soft)", fontSize: 13, lineHeight: 1 }}>⌕</span>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search records…" aria-label="Search distributions" style={{ flex: 1, fontSize: 12, color: "var(--ink)", background: "transparent", width: "100%", border: "none", outline: "none", fontFamily: "var(--font-mono)" }} />
                </div>
              </div>
            </div>

            {/* Table with expandable rows */}
            <div className="s-card" style={{ overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "18px 2.1fr 0.8fr 1.3fr 0.95fr 0.85fr 0.95fr", gap: 14, padding: "11px 22px 11px 18px", borderBottom: "1px solid var(--line)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--soft)" }}>
                <span></span><span>Distribution</span><span>Date</span><span>Recipients · claimed</span><span>Total</span><span>Status</span><span style={{ textAlign: "right" }}>Actions</span>
              </div>
              {loading ? (
                <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
              ) : filtered.length === 0 ? (
                <div style={{ padding: "32px", textAlign: "center" }}>
                  {campaigns.length === 0 ? (
                    <>
                      <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--ink)", marginBottom: 8 }}>No distributions yet</div>
                      <div style={{ fontSize: 13, color: "var(--mid)", marginBottom: 20 }}>Create your first confidential distribution to get started.</div>
                      <button className="s-btn" onClick={() => router.push("/distribute")} style={{ fontSize: 13.5 }}>+ New distribution</button>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: "var(--soft)" }}>No distributions match the current filter.</div>
                  )}
                </div>
              ) : (
                filtered.map((c, i) => {
                  const isOpen = expandedRow === c.airdrop;
                  const st = stats[c.airdrop.toLowerCase()];
                  const claimedPct = st && st.total > 0 ? Math.round((st.claimed / st.total) * 100) : 0;
                  return (
                    <div key={c.airdrop} style={{ borderBottom: "1px solid var(--line)", borderLeft: `${isOpen ? 3 : 0}px solid var(--accent)`, background: isOpen ? "var(--overlay)" : "transparent", transition: "background .18s, border-color .4s", animation: `rowIn .45s ${(i * 0.07).toFixed(2)}s cubic-bezier(.22,.85,.2,1) both` }}>
                      {/* Main row */}
                      <div
                        className="dash-row"
                        style={{ display: "grid", gridTemplateColumns: "18px 2.1fr 0.8fr 1.3fr 0.95fr 0.85fr 0.95fr", gap: 14, alignItems: "center", padding: "15px 22px 15px 18px", cursor: "pointer" }}
                      >
                        {/* Chevron */}
                        <span onClick={() => setExpandedRow(isOpen ? null : c.airdrop)} style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--soft)", cursor: "pointer", display: "inline-block", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform .22s" }}>›</span>

                        {/* Name */}
                        <div onClick={() => setDetailCampaign(c)} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                            <span style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--ink)" }}>{c.name}</span>
                          </div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--soft)" }}>{c.symbol} · {shortAddr(c.airdrop)}</div>
                        </div>

                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--mid)" }}>{timeAgo(c.createdAt)}</span>

                        {/* Recipients + mini claim bar */}
                        <div onClick={() => setExpandedRow(isOpen ? null : c.airdrop)}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: "var(--font-mono)", fontSize: 11, marginBottom: 5 }}>
                            <span style={{ color: "var(--ink)" }}>{c.recipientCount.toLocaleString()}</span>
                            <span style={{ color: "var(--soft)" }}>{statsLoading && !st ? "…" : `${claimedPct}%`}</span>
                          </div>
                          <div style={{ height: 4, background: "var(--line)", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${claimedPct}%`, background: "var(--green)", borderRadius: 2, transition: "width .5s" }} />
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ height: 11, width: 60, background: "var(--bar)", borderRadius: 1 }} />
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--soft)" }}>cUSDT</span>
                        </div>

                        {isRevoked(c) ? (
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", border: "1px solid rgba(200,71,43,.5)", background: "rgba(200,71,43,.09)", padding: "3px 9px", borderRadius: 999, justifySelf: "start", display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)" }} />Revoked
                          </span>
                        ) : (
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--green)", border: "1px solid rgba(111,175,142,.55)", background: "rgba(111,175,142,.1)", padding: "3px 9px", borderRadius: 999, justifySelf: "start", display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)" }} />Sealed
                          </span>
                        )}

                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <div onClick={(e) => { e.stopPropagation(); setQrModal(`${typeof window !== "undefined" ? window.location.origin : ""}/claim?id=${c.airdrop}`); }} style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--mid)", border: "1px solid var(--line)", padding: "4px 9px", borderRadius: 2, cursor: "pointer", transition: "all .2s" }}>Share</div>
                          <div onClick={() => setDetailCampaign(c)} style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--mid)", border: "1px solid var(--line)", padding: "4px 9px", borderRadius: 2, cursor: "pointer", transition: "all .2s" }}>Details</div>
                          {!isRevoked(c) && (
                            <div onClick={(e) => { e.stopPropagation(); setRevokeCampaign(c); }} style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", border: "1px solid rgba(200,71,43,.4)", padding: "4px 9px", borderRadius: 2, cursor: "pointer", transition: "all .2s" }}>Revoke</div>
                          )}
                        </div>
                      </div>

                      {/* Expandable inline drawer — REAL recipients + on-chain claimed status */}
                      {isOpen && (
                        <div style={{ padding: "0 22px 20px 18px", animation: "fd .25s ease both" }}>
                          <div style={{ background: "var(--overlay)", border: "1px solid var(--line)", borderRadius: 4, padding: "16px 18px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--soft)" }}>
                                Sealed recipients{st && st.recipients.length > 5 ? ` · first 5 of ${st.total}` : ""}
                              </div>
                              <a href={`https://sepolia.etherscan.io/tx/${c.txHash}`} target="_blank" rel="noreferrer" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", textDecoration: "none" }}>tx {shortAddr(c.txHash, 8)} ↗</a>
                            </div>
                            {!st ? (
                              <div style={{ padding: "12px 0", display: "flex", alignItems: "center", gap: 10 }}>
                                <div className="s-spinner" style={{ width: 14, height: 14 }} />
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--soft)" }}>Reading claim status on-chain…</span>
                              </div>
                            ) : st.recipients.length === 0 ? (
                              <div style={{ padding: "12px 0", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--soft)" }}>No recipient records stored for this distribution.</div>
                            ) : (
                              st.recipients.slice(0, 5).map((r, ri, arr) => (
                                <div key={ri} style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 0", borderBottom: ri < arr.length - 1 ? "1px solid var(--line)" : "none" }}>
                                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--mid)", flex: 1 }}>{shortAddr(r.recipient, 6)}</span>
                                  <span style={{ height: 11, width: (44 + (parseInt(r.recipient.slice(2, 6), 16) % 70)) + "px", background: "var(--bar)", borderRadius: 1 }} />
                                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--soft)" }}>{c.symbol}</span>
                                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: r.claimed ? "var(--green)" : "var(--soft)", minWidth: 64, textAlign: "right" }}>{r.claimed ? "✓ claimed" : "pending"}</span>
                                </div>
                              ))
                            )}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, flexWrap: "wrap", gap: 10 }}>
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--mid)" }}>
                                {st ? `${st.claimed} / ${st.total} recipients have claimed` : "Checking…"}
                              </div>
                              <div onClick={() => setDetailCampaign(c)} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", cursor: "pointer" }}>Open full detail →</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <div style={{ marginTop: 13, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <span style={{ fontSize: 12, color: "var(--soft)", fontStyle: "italic", fontFamily: "var(--font-serif)" }}>The blacked-out bars are exactly what Etherscan shows — FHE ciphertext, not a UI mask.</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--soft)" }}>{filtered.length} record{filtered.length === 1 ? "" : "s"}</span>
            </div>
          </div>
        )}

        {/* ── BLOCK EXPLORER ── */}
        {dashTab === "explorer" && (() => {
          const sel = campaigns[explorerIdx];
          const selKey = sel?.airdrop?.toLowerCase() ?? "";
          const selRecipients = stats[selKey]?.recipients ?? [];
          return (
          <div className="anim-fd">
            {/* Campaign selector */}
            {campaigns.length > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--soft)" }}>Distribution</span>
                {campaigns.map((c, i) => (
                  <div key={c.airdrop} onClick={() => { setExplorerIdx(i); setReceipt(null); }} style={{ padding: "5px 12px", borderRadius: 3, background: explorerIdx === i ? "rgba(200,71,43,.14)" : "var(--card)", border: `1.5px solid ${explorerIdx === i ? "rgba(200,71,43,.65)" : "var(--line)"}`, cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, color: explorerIdx === i ? "var(--accent)" : "var(--mid)", transition: "all .2s", whiteSpace: "nowrap" }}>
                    {c.name || shortAddr(c.airdrop, 6)}
                  </div>
                ))}
              </div>
            )}
            <div className="s-card" style={{ overflow: "hidden" }}>
              {/* Browser chrome */}
              <div style={{ background: "var(--overlay)", borderBottom: "1px solid var(--line)", padding: "12px 20px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {["#ff5f56", "#febc2e", "#28c840"].map(c => <div key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c }} />)}
                </div>
                <a
                  href={sel ? `https://sepolia.etherscan.io/tx/${sel.txHash}` : "#"}
                  target="_blank" rel="noreferrer"
                  style={{ flex: 1, background: "var(--input-bg)", border: "1px solid var(--line)", borderRadius: 3, padding: "5px 12px", fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--accent)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  sepolia.etherscan.io/tx/{sel ? shortAddr(sel.txHash, 12) : "…"}
                </a>
              </div>
              <div style={{ padding: "24px 28px" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 16 }}>
                  Transaction Details
                  {!receipt && sel && <span style={{ textTransform: "none", letterSpacing: 0, color: "var(--soft)", marginLeft: 8 }}>· loading receipt…</span>}
                  {sel && (
                    <a href={`https://sepolia.etherscan.io/tx/${sel.txHash}`} target="_blank" rel="noreferrer" style={{ float: "right", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", textDecoration: "none", letterSpacing: ".06em" }}>Etherscan ↗</a>
                  )}
                </div>
                {[
                  ["Transaction Hash", sel ? shortAddr(sel.txHash, 10) : "—"],
                  ["Status", receipt ? (receipt.status === "success" ? "✓ Success" : "✗ Reverted") : "—"],
                  ["Block", receipt ? Number(receipt.blockNumber).toLocaleString() : "—"],
                  ["Network", "Ethereum Sepolia"],
                  ["From", sel ? shortAddr(sel.admin, 8) : "—"],
                  ["Contract (Airdrop)", sel ? shortAddr(sel.airdrop, 8) : "—"],
                  ["Gas Used", receipt ? Number(receipt.gasUsed).toLocaleString() : "—"],
                  ["Created", sel ? new Date(sel.createdAt).toLocaleString("en-GB") : "—"],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 0, borderBottom: "1px solid var(--line)" }}>
                    <div style={{ padding: "10px 0", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--soft)" }}>{label}</div>
                    <div style={{ padding: "10px 0", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)" }}>{value}</div>
                  </div>
                ))}
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--soft)", margin: "16px 0 12px" }}>
                  Recipients <span style={{ color: "var(--accent)" }}>(public)</span> · amounts <span style={{ color: "var(--accent)" }}>(FHE-sealed)</span>
                </div>
                <div style={{ background: "var(--overlay)", border: "1px solid var(--line)", borderRadius: 4, padding: "16px 18px", marginBottom: 20 }}>
                  {selRecipients.slice(0, 6).map((r, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "5px 0", borderBottom: i < Math.min(selRecipients.length, 6) - 1 ? "1px solid var(--line)" : "none" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--soft)", minWidth: 26 }}>[{i}]</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--ink)", flex: 1 }}>{shortAddr(r.recipient, 8)}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: r.claimed ? "var(--green)" : "var(--accent)" }}>{r.claimed ? "claimed" : "euint64 · sealed"}</span>
                    </div>
                  ))}
                  {(!sel || selRecipients.length === 0) && (
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--soft)" }}>
                      {sel ? "Reading recipients…" : "No distributions yet."}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "var(--mid)" }}>
                  <span style={{ width: 17, height: 17, borderRadius: "50%", border: "1.5px solid var(--green)", color: "var(--green)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, flexShrink: 0 }}>✓</span>
                  Addresses are public; amounts are euint64 ciphertext. Only each recipient&apos;s key decrypts their own.
                </div>
              </div>
            </div>
          </div>
          );
        })()}

        {/* ── ANALYTICS · all values computed on-chain ── */}
        {dashTab === "analytics" && (
          <div className="anim-fd">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 12 }}>
              {[
                ["Overall claim rate", statsLoading ? "…" : `${claimRate}%`, "var(--green)"],
                ["Fully claimed", statsLoading ? "…" : `${fullyClaimed}/${campaigns.length}`, "var(--ink)"],
                ["Unclaimed", statsLoading ? "…" : `${unclaimedPct}%`, "var(--accent)"],
              ].map(([label, val, c]) => (
                <div key={label} className="s-card" style={{ padding: 22 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 10 }}>{label}</div>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: 52, color: c, lineHeight: 1 }}>{val}</div>
                </div>
              ))}
            </div>
            <div className="s-card" style={{ padding: "24px 28px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 5 }}>Claim rate · per distribution</div>
              <div style={{ fontSize: 13, color: "var(--mid)", marginBottom: 22 }}>
                Computed live from on-chain <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>isSignatureClaimed</span> reads. Individual amounts stay encrypted throughout.
              </div>
              {statsLoading ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 0" }}>
                  <div className="s-spinner" /><span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--soft)" }}>Reading claim status on-chain…</span>
                </div>
              ) : analyticsRows.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--soft)", padding: "12px 0" }}>No distributions to analyze yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {analyticsRows.map((r) => (
                    <div key={r.name}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                        <span style={{ fontFamily: "var(--font-serif)", fontSize: 17, color: "var(--ink)" }}>{r.name}</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--mid)" }}>{r.claimed}/{r.total} · {r.rate}%</span>
                      </div>
                      <div style={{ height: 8, background: "var(--line)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${r.rate}%`, background: r.rate === 100 ? "var(--green)" : "linear-gradient(90deg,var(--accent),var(--green))", borderRadius: 4, transition: "width .6s cubic-bezier(.22,.85,.2,1)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "var(--mid)" }}>
                <span style={{ width: 17, height: 17, borderRadius: "50%", border: "1.5px solid var(--soft)", color: "var(--soft)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, flexShrink: 0 }}>i</span>
                Claim counts are real on-chain reads. Amounts remain FHE ciphertext — never decoded here.
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
                  <div style={{ fontSize: 13, color: "var(--mid)", lineHeight: 1.55, maxWidth: 460 }}>
                    POST to your URL the moment a recipient claims. The <code style={{ fontFamily: "var(--font-mono)", background: "var(--overlay)", padding: "1px 5px", borderRadius: 2 }}>amount</code> field is always <code style={{ fontFamily: "var(--font-mono)", background: "var(--overlay)", padding: "1px 5px", borderRadius: 2 }}>[FHE-sealed]</code> — amounts never travel in plaintext.
                  </div>
                </div>
                <button
                  onClick={() => { setWebhookEnabled(e => !e); setWebhookSaved(false); }}
                  aria-label={webhookEnabled ? "Disable webhook" : "Enable webhook"}
                  className="s-toggle" style={{ background: webhookEnabled ? "var(--accent)" : "var(--soft)", marginTop: 3, border: "none", cursor: "pointer" }}
                >
                  <div className="s-toggle-knob" style={{ left: webhookEnabled ? 21 : 3 }} />
                </button>
              </div>
              <div style={{ display: "flex", gap: 9, marginBottom: 14 }}>
                <input
                  type="url"
                  placeholder="https://api.yourapp.com/hooks/sotto"
                  value={webhookUrl}
                  onChange={e => { setWebhookUrl(e.target.value); setWebhookSaved(false); }}
                  className="s-input"
                  aria-label="Webhook URL"
                  style={{ flex: 1 }}
                />
                <button
                  onClick={saveWebhook}
                  disabled={webhookLoading}
                  aria-label="Save webhook endpoint"
                  style={{ background: webhookSaved ? "var(--green)" : "var(--accent)", color: "#F6F1E6", padding: "10px 18px", borderRadius: 3, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", whiteSpace: "nowrap", opacity: webhookLoading ? 0.6 : 1 }}
                >
                  {webhookLoading ? "Saving…" : webhookSaved ? "✓  Saved" : "Save endpoint"}
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

      {revokeCampaign && (
        <RevokeModal
          campaign={revokeCampaign}
          onCancel={() => setRevokeCampaign(null)}
          onDone={(hash) => {
            setRevokedSet(prev => new Set(prev).add(revokeCampaign.airdrop.toLowerCase()));
            setRevokeCampaign(null);
            toast("Distribution revoked — unclaimed tokens returned to your wallet", { kind: "success", href: `https://sepolia.etherscan.io/tx/${hash}`, hrefLabel: "View tx ↗" });
          }}
        />
      )}
      {detailCampaign && <DistributionDetail campaign={detailCampaign} onClose={() => setDetailCampaign(null)} />}

      {/* QR share modal */}
      {qrModal && (
        <div onClick={() => setQrModal(null)} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(6,5,4,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fd .2s ease both" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 360, background: "var(--surface)", border: "1.5px solid var(--line)", borderRadius: 8, padding: 32, animation: "up .3s cubic-bezier(.22,.85,.2,1) both", boxShadow: "0 40px 80px rgba(0,0,0,.4)", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 20 }}>Share claim link · scan or send</div>
            <div style={{ display: "inline-block", padding: 12, background: "var(--ink)", borderRadius: 6, marginBottom: 20 }}>
              <QRCode value={qrModal} size={160} />
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--mid)", background: "var(--input-bg)", border: "1px solid var(--line)", borderRadius: 3, padding: "9px 12px", marginBottom: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{qrModal}</div>
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
              <button onClick={() => { navigator.clipboard?.writeText(qrModal); setQrCopied(true); setTimeout(() => setQrCopied(false), 2000); }} style={{ flex: 1, minWidth: 110, background: "var(--ink)", color: "var(--page-bg)", padding: "11px", borderRadius: 3, fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none" }}>
                {qrCopied ? "✓ Copied" : "Copy link"}
              </button>
              {typeof navigator !== "undefined" && "share" in navigator && (
                <button onClick={() => { navigator.share?.({ title: "Sotto · claim your allocation", url: qrModal }).catch(() => {}); }} style={{ flex: 1, minWidth: 110, background: "var(--accent)", color: "#F6F1E6", padding: "11px", borderRadius: 3, fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none" }}>
                  Share…
                </button>
              )}
              <button onClick={() => setQrModal(null)} style={{ padding: "11px 16px", border: "1.5px solid var(--line)", color: "var(--mid)", borderRadius: 3, fontFamily: "var(--font-mono)", fontSize: 12, cursor: "pointer", background: "none" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
