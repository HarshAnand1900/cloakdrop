"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import type { Hex } from "viem";
import { createConfidentialAirdropClient } from "@tokenops/sdk/fhe-airdrop";
import type { Campaign } from "@/lib/types";
import { shortAddr } from "@/lib/format";
import { explorerAddr, explorerTx } from "@/lib/constants";
import { QRCode } from "./QRCode";
import { toast } from "./toast";

interface RecipientRow {
  recipient: string;
  handle: Hex;
  claimed?: boolean | null;
}

export function DistributionDetail({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const publicClient = usePublicClient();
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Per-distribution deep-link — lands recipient directly on their allocation
  const claimUrl = typeof window !== "undefined"
    ? `${window.location.origin}/claim?id=${campaign.airdrop}`
    : `/claim?id=${campaign.airdrop}`;

  // Fetch recipient list
  useEffect(() => {
    let alive = true;
    fetch(`/api/campaigns?airdrop=${campaign.airdrop}`)
      .then(r => r.json())
      .then(data => {
        if (!alive) return;
        const recs: RecipientRow[] = Array.isArray(data?.recipients) ? data.recipients : [];
        setRecipients(recs.map(r => ({ ...r, claimed: null })));
      })
      .catch(() => setRecipients([]))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [campaign.airdrop]);

  // Check claimed status per recipient (public read, no signer)
  useEffect(() => {
    if (!publicClient || recipients.length === 0) return;
    let alive = true;
    (async () => {
      try {
        const client = createConfidentialAirdropClient({ publicClient, address: campaign.airdrop });
        const updated = await Promise.all(
          recipients.map(async (r) => {
            try {
              const done = await client.isSignatureClaimed(r.recipient as Hex, r.handle);
              return { ...r, claimed: done };
            } catch {
              return { ...r, claimed: null };
            }
          }),
        );
        if (alive) setRecipients(updated);
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicClient, loading]);

  const claimedCount = recipients.filter(r => r.claimed === true).length;
  const checked = recipients.some(r => r.claimed !== null && r.claimed !== undefined);
  const now = Math.floor(Date.now() / 1000);
  const windowOpen = now >= campaign.startTime && now <= campaign.endTime;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(6,5,4,.5)", backdropFilter: "blur(4px)", animation: "fd .2s ease both" }} />
      <div onClick={e => e.stopPropagation()} style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 480, maxWidth: "100vw", zIndex: 81, background: "var(--surface)", borderLeft: "1px solid var(--line)", display: "flex", flexDirection: "column", animation: "slideInR .3s cubic-bezier(.22,.85,.2,1) both", boxShadow: "-20px 0 60px rgba(0,0,0,.35)" }}>

        {/* Header */}
        <div style={{ padding: "24px 28px 20px", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 7 }}>Distribution detail</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 30, color: "var(--ink)", lineHeight: 1.05 }}>{campaign.name}</div>
            </div>
            <div onClick={onClose} style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--soft)", cursor: "pointer", flexShrink: 0 }}>✕</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--green)", border: "1px solid var(--green)", padding: "4px 9px", borderRadius: 2 }}>SEALED</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: windowOpen ? "var(--accent)" : "var(--soft)", border: `1px solid ${windowOpen ? "rgba(200,71,43,.4)" : "var(--line)"}`, padding: "4px 9px", borderRadius: 2 }}>
              {windowOpen ? "CLAIM WINDOW OPEN" : "WINDOW CLOSED"}
            </span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px" }}>

          {/* Claim progress */}
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 4, padding: "18px 20px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)" }}>Claimed</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--mid)" }}>
                {checked ? `${claimedCount} / ${campaign.recipientCount}` : `— / ${campaign.recipientCount}`}
              </span>
            </div>
            <div style={{ height: 6, background: "var(--line)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${campaign.recipientCount ? (claimedCount / campaign.recipientCount) * 100 : 0}%`, background: "var(--green)", borderRadius: 3, transition: "width .6s cubic-bezier(.22,.85,.2,1)" }} />
            </div>
          </div>

          {/* Facts */}
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 4, padding: "6px 20px", marginBottom: 16 }}>
            <Fact label="Airdrop" value={shortAddr(campaign.airdrop, 8)} href={explorerAddr(campaign.airdrop)} />
            <Fact label="Deploy tx" value={shortAddr(campaign.txHash, 8)} href={explorerTx(campaign.txHash)} />
            <Fact label="Token" value={`${campaign.symbol} · ERC-7984`} />
            <Fact label="Recipients" value={String(campaign.recipientCount)} />
            <Fact label="Created" value={new Date(campaign.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} />
            <Fact label="Window opens" value={new Date(campaign.startTime * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} />
            <Fact label="Window closes" value={new Date(campaign.endTime * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} last />
          </div>

          {/* Claim link + QR */}
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 4, padding: "16px 20px", marginBottom: 16 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 10 }}>
              Claim link · share with recipients
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <div style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--mid)", background: "var(--input-bg)", padding: "9px 12px", borderRadius: 3, border: "1px solid var(--line)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{claimUrl}</div>
              <button
                onClick={() => { navigator.clipboard?.writeText(claimUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                aria-label="Copy claim link"
                style={{ background: "var(--ink)", color: "var(--page-bg)", padding: "9px 14px", borderRadius: 3, fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", border: "none" }}
              >
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>
            {/* QR code */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ flexShrink: 0 }}>
                <QRCode value={claimUrl} size={88} />
              </div>
              <div style={{ fontSize: 12.5, color: "var(--mid)", lineHeight: 1.55 }}>
                Each recipient scans or clicks to reach their sealed allocation. Only their wallet can decrypt their amount — no one else sees it.
                <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--soft)" }}>Link pre-selects this distribution</div>
              </div>
            </div>
          </div>

          {/* Recipients */}
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 10 }}>
            Recipients · amounts sealed
          </div>
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 4, overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: "center", display: "flex", justifyContent: "center" }}><div className="s-spinner" /></div>
            ) : recipients.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", fontSize: 12.5, color: "var(--soft)" }}>No recipient records found.</div>
            ) : (
              recipients.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderBottom: i < recipients.length - 1 ? "1px solid var(--line)" : "none" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--mid)", flex: 1 }}>{shortAddr(r.recipient, 6)}</span>
                  <span style={{ height: 10, width: (40 + (i * 37) % 70) + "px", background: "var(--bar)", borderRadius: 1, opacity: .8 }} />
                  {r.claimed === true ? (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--green)", border: "1px solid var(--green)", padding: "2px 6px", borderRadius: 2, flexShrink: 0 }}>✓ CLAIMED</span>
                  ) : r.claimed === false ? (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--soft)", border: "1px solid var(--line)", padding: "2px 6px", borderRadius: 2, flexShrink: 0 }}>PENDING</span>
                  ) : (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--soft)", flexShrink: 0 }}>…</span>
                  )}
                </div>
              ))
            )}
          </div>

          <div style={{ marginTop: 14, fontSize: 12, color: "var(--soft)", fontStyle: "italic", fontFamily: "var(--font-serif)", lineHeight: 1.5 }}>
            Each bar is the recipient&apos;s FHE-sealed allocation as stored on-chain — unreadable to you, the admin, or any observer. Only the recipient&apos;s key decrypts it.
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <a href={explorerAddr(campaign.airdrop)} target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: "center", background: "var(--ink)", color: "var(--page-bg)", padding: "12px", borderRadius: 3, fontSize: 13.5, fontWeight: 700, textDecoration: "none" }}>View on Etherscan ↗</a>
            <div onClick={() => { navigator.clipboard?.writeText(campaign.airdrop); toast("Airdrop address copied", { kind: "success" }); }} style={{ flex: 1, textAlign: "center", border: "1.5px solid var(--line)", color: "var(--mid)", padding: "12px", borderRadius: 3, fontSize: 13.5, fontWeight: 500, cursor: "pointer" }}>Copy address</div>
          </div>
        </div>
      </div>
    </>
  );
}

function Fact({ label, value, href, last }: { label: string; value: string; href?: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: last ? "none" : "1px solid var(--line)" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--soft)" }}>{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)", textDecoration: "none" }}>{value} ↗</a>
      ) : (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)" }}>{value}</span>
      )}
    </div>
  );
}
