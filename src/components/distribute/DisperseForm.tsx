"use client";

import { useMemo, useState } from "react";
import { usePublicClient, useWalletClient, useAccount } from "wagmi";
import type { Address, Hex } from "viem";
import {
  createConfidentialDisperseClient,
  erc7984OperatorAbi,
} from "@tokenops/sdk/fhe-disperse";
import { useZamaSDK } from "@zama-fhe/react-sdk";
import { parseRecipients } from "@/lib/csv";
import { toRaw, fmtToken } from "@/lib/format";
import { CUSDT, TOKENOPS, OPERATOR_DEADLINE, explorerTx } from "@/lib/constants";
import { toast } from "../toast";
import { humanizeError } from "../Faucet";
import { RecipientPreview } from "./RecipientPreview";

const SAMPLE = `# address, amount (cUSDT)
0x70997970C51812dc3A010C7d01b50e0d17dc79C8, 50
0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC, 120
0x90F79bf6EB2c4f870365E785982E1f101E93b906, 30`;

type Phase =
  | { step: "idle" }
  | { step: "operator" }
  | { step: "disperse" }
  | { step: "done"; txHash: Hex; count: number };

export function DisperseForm() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const zama = useZamaSDK();

  const [csv, setCsv] = useState("");
  const [phase, setPhase] = useState<Phase>({ step: "idle" });

  const parsed = useMemo(() => parseRecipients(csv), [csv]);
  const rows = parsed.rows;
  const total = useMemo(
    () => rows.reduce((acc, r) => acc + toRaw(r.amount), 0n),
    [rows],
  );

  const busy = phase.step === "operator" || phase.step === "disperse";
  const canSend =
    !!address &&
    !!walletClient &&
    !!publicClient &&
    rows.length > 0 &&
    parsed.errors.length === 0 &&
    !busy;

  async function send() {
    if (!address || !walletClient || !publicClient) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const encryptor = (zama as any).relayer;
    const token = CUSDT.wrapper as Address;

    try {
      // 1. Authorize the disperse singleton to move the sender's tokens.
      setPhase({ step: "operator" });
      const opHash = await walletClient.writeContract({
        address: token,
        abi: erc7984OperatorAbi,
        functionName: "setOperator",
        args: [TOKENOPS.disperseSingleton, OPERATOR_DEADLINE],
      });
      await publicClient.waitForTransactionReceipt({ hash: opHash });

      // 2. Encrypt all amounts and push them in a single transaction.
      setPhase({ step: "disperse" });
      const client = createConfidentialDisperseClient({
        publicClient,
        walletClient,
        encryptor,
      });
      const { hash } = await client.disperse({
        token,
        mode: "direct",
        recipients: rows.map((r) => r.recipient),
        amounts: rows.map((r) => toRaw(r.amount)),
      });
      await publicClient.waitForTransactionReceipt({ hash });

      setPhase({ step: "done", txHash: hash, count: rows.length });
      toast("Confidential disperse complete", {
        kind: "success",
        href: explorerTx(hash),
        hrefLabel: "View transaction ↗",
      });
    } catch (e) {
      setPhase({ step: "idle" });
      toast(humanizeError(e), { kind: "error" });
    }
  }

  if (phase.step === "done") {
    return (
      <div className="cd-card cd-fade" style={{ padding: "2rem", textAlign: "center", maxWidth: 520, margin: "0 auto" }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>📦</div>
        <h2 style={{ margin: "0 0 6px" }}>Sent to {phase.count} recipient{phase.count === 1 ? "" : "s"}</h2>
        <p style={{ color: "var(--fg-muted)", fontSize: 14, margin: "0 0 1.2rem" }}>
          Each encrypted amount landed directly in the recipient&apos;s confidential balance. They can reveal it privately from the Claim page.
        </p>
        <a className="cd-link" href={explorerTx(phase.txHash)} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
          View transaction on Etherscan ↗
        </a>
        <div style={{ marginTop: 18 }}>
          <button className="cd-btn cd-btn-primary" onClick={() => { setPhase({ step: "idle" }); setCsv(""); }}>
            Send another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="airdrop-grid">
      <div className="cd-card" style={{ padding: "1.3rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-muted)" }}>
            Recipients (address, amount)
          </label>
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
          style={{ minHeight: 230, resize: "vertical", fontSize: 12.5, lineHeight: 1.6 }}
          placeholder={"0xabc…, 100\n0xdef…, 250"}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          disabled={busy}
        />
        <label className="cd-btn cd-btn-ghost" style={{ marginTop: 10, width: "fit-content", fontSize: 13 }}>
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
          </div>
        )}
      </div>

      <div className="cd-card" style={{ padding: "1.3rem", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <Stat label="Recipients" value={String(rows.length)} />
          <Stat label="Total" value={fmtToken(total)} />
        </div>
        <RecipientPreview rows={rows} />
        {busy && (
          <div style={{ fontSize: 12.5, color: "var(--fg-muted)", marginBottom: 12 }}>
            {phase.step === "operator" ? "Authorizing transfer…" : "Encrypting & dispersing in one transaction…"}
          </div>
        )}
        <button
          className="cd-btn cd-btn-primary"
          style={{ marginTop: "auto", width: "100%" }}
          disabled={!canSend}
          onClick={send}
        >
          {busy ? "Working…" : `Encrypt & disperse${rows.length ? ` (${rows.length})` : ""}`}
        </button>
        <p style={{ color: "var(--fg-faint)", fontSize: 11.5, marginTop: 8, textAlign: "center" }}>
          One authorization + one transaction. Amounts are sealed on-chain.
        </p>
      </div>
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
