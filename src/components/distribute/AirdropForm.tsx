"use client";

import { useMemo, useState } from "react";
import { usePublicClient, useWalletClient, useAccount } from "wagmi";
import { toHex } from "viem";
import type { Address, Hex } from "viem";
import {
  createConfidentialAirdropFactoryClient,
  encryptUint64,
  signClaimAuthorization,
  erc7984OperatorAbi,
} from "@tokenops/sdk/fhe-airdrop";
import { useZamaSDK } from "@zama-fhe/react-sdk";
import { parseRecipients, type ParsedRow } from "@/lib/csv";
import { toRaw, fmtToken, shortAddr } from "@/lib/format";
import {
  CUSDT,
  TOKENOPS,
  OPERATOR_DEADLINE,
  explorerTx,
  explorerAddr,
} from "@/lib/constants";
import type { Campaign, ClaimRecord } from "@/lib/types";
import { toast } from "../toast";
import { humanizeError } from "../Faucet";
import { RecipientPreview } from "./RecipientPreview";

const SAMPLE = `# address, amount (cUSDT)
0x70997970C51812dc3A010C7d01b50e0d17dc79C8, 250
0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC, 100.5
0x90F79bf6EB2c4f870365E785982E1f101E93b906, 75`;

type Phase =
  | { step: "idle" }
  | { step: "operator" }
  | { step: "deploy" }
  | { step: "encrypt"; done: number; total: number; who: string }
  | { step: "save" }
  | {
      step: "done";
      airdrop: Address;
      txHash: Hex;
      count: number;
      name: string;
    };

function randomSalt(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export function AirdropForm() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const zama = useZamaSDK();

  const [name, setName] = useState("");
  const [csv, setCsv] = useState("");
  const [phase, setPhase] = useState<Phase>({ step: "idle" });

  const parsed = useMemo(() => parseRecipients(csv), [csv]);
  const rows = parsed.rows;
  const total = useMemo(
    () => rows.reduce((acc, r) => acc + toRaw(r.amount), 0n),
    [rows],
  );

  const busy = phase.step !== "idle" && phase.step !== "done";
  const canCreate =
    !!address &&
    !!walletClient &&
    !!publicClient &&
    rows.length > 0 &&
    parsed.errors.length === 0 &&
    name.trim().length > 0 &&
    !busy;

  async function create() {
    if (!address || !walletClient || !publicClient) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const encryptor = (zama as any).relayer;
    const token = CUSDT.wrapper as Address;

    try {
      // 1. Authorize the factory to pull confidential tokens for funding.
      setPhase({ step: "operator" });
      const opHash = await walletClient.writeContract({
        address: token,
        abi: erc7984OperatorAbi,
        functionName: "setOperator",
        args: [TOKENOPS.airdropFactory, OPERATOR_DEADLINE],
      });
      await publicClient.waitForTransactionReceipt({ hash: opHash });

      // 2. Deploy + fund the confidential airdrop in one transaction.
      setPhase({ step: "deploy" });
      const factory = createConfidentialAirdropFactoryClient({
        publicClient,
        walletClient,
        encryptor,
      });
      const now = Math.floor(Date.now() / 1000);
      const { hash, airdrop } =
        await factory.createAndFundConfidentialAirdrop({
          params: {
            token,
            startTimestamp: now - 60,
            endTimestamp: now + 60 * 60 * 24 * 30, // 30 days
            canExtendClaimWindow: true,
            admin: address,
          },
          userSalt: randomSalt(),
          amount: total,
        });

      // 3. Encrypt + sign each allocation, bound to its recipient.
      const claims: ClaimRecord[] = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        setPhase({
          step: "encrypt",
          done: i,
          total: rows.length,
          who: shortAddr(r.recipient),
        });
        const enc = await encryptUint64({
          encryptor,
          contractAddress: airdrop,
          userAddress: r.recipient,
          value: toRaw(r.amount),
        });
        const signature = await signClaimAuthorization({
          walletClient,
          airdropAddress: airdrop,
          recipient: r.recipient,
          encryptedAmountHandle: enc.handle,
        });
        claims.push({
          recipient: r.recipient,
          handle: enc.handle,
          inputProof: enc.inputProof,
          signature,
          amount: toRaw(r.amount).toString(),
        });
      }

      // 4. Persist campaign + claims so recipients can look them up.
      setPhase({ step: "save" });
      const campaign: Campaign = {
        airdrop,
        name: name.trim(),
        admin: address,
        token,
        symbol: CUSDT.symbol,
        startTime: now - 60,
        endTime: now + 60 * 60 * 24 * 30,
        txHash: hash,
        recipientCount: rows.length,
        createdAt: Date.now(),
      };
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaign, claims }),
      });
      if (!res.ok) throw new Error("Failed to save campaign to the server.");

      setPhase({
        step: "done",
        airdrop,
        txHash: hash,
        count: rows.length,
        name: name.trim(),
      });
      toast("Airdrop deployed and funded", {
        kind: "success",
        href: explorerTx(hash),
        hrefLabel: "View deploy tx ↗",
      });
    } catch (e) {
      setPhase({ step: "idle" });
      toast(humanizeError(e), { kind: "error" });
    }
  }

  if (phase.step === "done") {
    return <SuccessCard phase={phase} onReset={() => {
      setPhase({ step: "idle" });
      setName("");
      setCsv("");
    }} />;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="airdrop-grid">
      {/* Left: inputs */}
      <div className="cd-card" style={{ padding: "1.3rem" }}>
        <label style={labelStyle}>Campaign name</label>
        <input
          className="cd-input"
          placeholder="e.g. Q3 contributor rewards"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "1.1rem 0 0.4rem" }}>
          <label style={{ ...labelStyle, margin: 0 }}>Recipients (address, amount)</label>
          <button
            className="cd-link"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.5 }}
            onClick={() => setCsv(SAMPLE)}
            disabled={busy}
          >
            Load sample
          </button>
        </div>
        <textarea
          className="cd-input cd-mono"
          style={{ minHeight: 200, resize: "vertical", fontSize: 12.5, lineHeight: 1.6 }}
          placeholder={"0xabc…, 100\n0xdef…, 250"}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          disabled={busy}
        />

        <label
          className="cd-btn cd-btn-ghost"
          style={{ marginTop: 10, width: "fit-content", fontSize: 13 }}
        >
          📄 Upload CSV
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            style={{ display: "none" }}
            disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setCsv(await f.text());
            }}
          />
        </label>

        {parsed.errors.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--danger)" }}>
            {parsed.errors.slice(0, 4).map((er, i) => (
              <div key={i}>• {er}</div>
            ))}
            {parsed.errors.length > 4 && <div>…and {parsed.errors.length - 4} more</div>}
          </div>
        )}
      </div>

      {/* Right: preview + action */}
      <div className="cd-card" style={{ padding: "1.3rem", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <Stat label="Recipients" value={String(rows.length)} />
          <Stat label="Total pool" value={fmtToken(total)} />
        </div>

        <RecipientPreview rows={rows} />

        {busy && <ProgressBlock phase={phase} />}

        <button
          className="cd-btn cd-btn-primary"
          style={{ marginTop: "auto", width: "100%" }}
          disabled={!canCreate}
          onClick={create}
        >
          {busy ? "Working…" : `Encrypt, deploy & fund${rows.length ? ` (${rows.length})` : ""}`}
        </button>
        <p style={{ color: "var(--fg-faint)", fontSize: 11.5, marginTop: 8, textAlign: "center" }}>
          You&apos;ll approve one funding transaction, then sign one authorization per recipient.
        </p>
      </div>
    </div>
  );
}

function ProgressBlock({ phase }: { phase: Phase }) {
  const labelMap: Record<string, string> = {
    operator: "Authorizing funding…",
    deploy: "Deploying & funding airdrop…",
    save: "Saving campaign…",
  };
  let label = labelMap[phase.step] ?? "";
  let pct = 0;
  if (phase.step === "operator") pct = 8;
  else if (phase.step === "deploy") pct = 22;
  else if (phase.step === "encrypt") {
    pct = 30 + Math.round((phase.done / phase.total) * 60);
    label = `Encrypting & signing ${phase.done + 1} / ${phase.total} · ${phase.who}`;
  } else if (phase.step === "save") pct = 95;

  return (
    <div style={{ margin: "14px 0" }}>
      <div style={{ fontSize: 12.5, color: "var(--fg-muted)", marginBottom: 6 }}>{label}</div>
      <div style={{ height: 7, background: "var(--bg-elev)", borderRadius: 99, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "linear-gradient(90deg,#7c5cff,#38e8c6)",
            transition: "width 0.3s",
          }}
        />
      </div>
    </div>
  );
}

function SuccessCard({
  phase,
  onReset,
}: {
  phase: Extract<Phase, { step: "done" }>;
  onReset: () => void;
}) {
  const claimUrl =
    typeof window !== "undefined" ? `${window.location.origin}/claim` : "/claim";
  return (
    <div className="cd-card cd-fade" style={{ padding: "2rem", textAlign: "center", maxWidth: 560, margin: "0 auto" }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
      <h2 style={{ margin: "0 0 6px" }}>“{phase.name}” is live</h2>
      <p style={{ color: "var(--fg-muted)", fontSize: 14, margin: "0 0 1.2rem" }}>
        {phase.count} encrypted allocation{phase.count === 1 ? "" : "s"} deployed. Amounts are sealed on-chain — only each recipient can decrypt their own.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "left", marginBottom: 16 }}>
        <Row label="Airdrop contract" value={shortAddr(phase.airdrop, 6)} href={explorerAddr(phase.airdrop)} />
        <Row label="Deploy transaction" value="View on Etherscan ↗" href={explorerTx(phase.txHash)} />
      </div>

      <div className="cd-card" style={{ padding: "0.9rem", background: "var(--bg-elev)", marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: "var(--fg-muted)", marginBottom: 6 }}>Share this link with recipients</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="cd-input cd-mono" readOnly value={claimUrl} style={{ fontSize: 12.5 }} />
          <button
            className="cd-btn cd-btn-ghost"
            onClick={() => {
              navigator.clipboard?.writeText(claimUrl);
              toast("Link copied", { kind: "success" });
            }}
          >
            Copy
          </button>
        </div>
      </div>

      <button className="cd-btn cd-btn-primary" onClick={onReset}>
        Create another
      </button>
    </div>
  );
}

function Row({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
      <span style={{ color: "var(--fg-muted)" }}>{label}</span>
      <a className="cd-link cd-mono" href={href} target="_blank" rel="noreferrer">
        {value}
      </a>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="cd-card" style={{ flex: 1, padding: "0.7rem 0.85rem", background: "var(--bg-elev)" }}>
      <div style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--fg-muted)",
  marginBottom: 6,
};

export type { ParsedRow };
