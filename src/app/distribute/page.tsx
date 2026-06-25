"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { usePublicClient, useWalletClient, useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { toHex, keccak256, toBytes } from "viem";
import type { Address, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  createConfidentialAirdropFactoryClient,
  encryptUint64,
  erc7984OperatorAbi,
} from "@tokenops/sdk/fhe-airdrop";
import {
  createConfidentialDisperseClient,
  erc7984OperatorAbi as disperseOperatorAbi,
} from "@tokenops/sdk/fhe-disperse";
import { useZamaSDK, useConfidentialBalance } from "@zama-fhe/react-sdk";
import { parseRecipients } from "@/lib/csv";
import { toRaw, shortAddr, fmtToken } from "@/lib/format";
import { CUSDT, TOKENOPS, OPERATOR_DEADLINE, explorerTx } from "@/lib/constants";
import type { Campaign, ClaimRecord } from "@/lib/types";
import { AppShell } from "@/components/AppShell";
import { ZKCanvas } from "@/components/ZKCanvas";
import { CanvasBackground } from "@/components/CanvasBackground";
import { InfoTip } from "@/components/Tooltip";
import { QRCode } from "@/components/QRCode";
import { StepRail } from "@/components/StepRail";
import { useSotto } from "@/context/SottoContext";
import { toast } from "@/components/toast";
import { humanizeError } from "@/components/Faucet";
import { Faucet } from "@/components/Faucet";

type Method = "airdrop" | "disperse";
type UseCase = "investor" | "team" | "community";

const SAMPLE_LIST =
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8, 12500\n0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC, 8200\n0x90F79bf6EB2c4f870365E785982E1f101E93b906, 21000\n0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65, 9750";

function randomSalt(): Hex {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return toHex(b);
}

function fmt(n: number) {
  return isNaN(n) ? "0.00" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DistributePage() {
  const { isConnected, address } = useAccount();
  const { openConnectModal } = useConnectModal();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const zama = useZamaSDK();
  const sotto = useSotto();

  // ── Wizard state ──
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [prevStep, setPrevStep] = useState<number>(1);

  // Sender's confidential cUSDT balance — decrypted at review so we can warn
  // before a confidential transfer silently clamps to 0 on insufficient funds.
  const senderBalance = useConfidentialBalance(
    { tokenAddress: CUSDT.wrapper },
    { enabled: isConnected && step === 3 },
  );

  // Step 1 config
  const [method, setMethod] = useState<Method>("airdrop");
  const [useCase, setUseCase] = useState<UseCase>("investor");
  const [timeLock, setTimeLock] = useState(false);
  const [lockDate, setLockDate] = useState("");
  const [templatePicked, setTemplatePicked] = useState<number | null>(null);

  // Step 2 recipients
  const [rawList, setRawList] = useState("");
  const [csvDragging, setCsvDragging] = useState(false);
  const [vestingEnabled, setVestingEnabled] = useState(false);
  const [cliffMonths, setCliffMonths] = useState(6);
  const [vestingDuration, setVestingDuration] = useState(24);
  const [ensResolving, setEnsResolving] = useState(false);

  // Step 3 review
  const [previewRedacted, setPreviewRedacted] = useState(false);

  // Step 4 execution
  const [execProgress, setExecProgress] = useState(0);
  const [execPhaseIdx, setExecPhaseIdx] = useState(0);
  const [execPhaseLabel, setExecPhaseLabel] = useState("");
  const [sealLog, setSealLog] = useState<Array<{ idx: number; addr: string; op: string; done: boolean }>>([]);

  // Step 3 rejection state
  const [walletRejected, setWalletRejected] = useState(false);

  // Step 5 result
  const [result, setResult] = useState<{ airdrop?: Address; txHash: Hex; count: number } | null>(null);
  const [claimLinkCopied, setClaimLinkCopied] = useState(false);

  // Batch
  const [showBatchPanel, setShowBatchPanel] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [hintDismissed, setHintDismissed] = useState(false);

  // Load list from address book
  useEffect(() => {
    if (sotto.loadedList) {
      setRawList(sotto.loadedList);
      sotto.clearLoadedList();
    }
  }, [sotto.loadedList, sotto]);

  // Parse list
  const parsed = useMemo(() => parseRecipients(rawList), [rawList]);
  const rows = parsed.rows;
  const total = useMemo(() => rows.reduce((acc, r) => acc + toRaw(r.amount), 0n), [rows]);
  const totalNum = rows.reduce((acc, r) => acc + parseFloat(r.amount), 0);
  const validCount = rows.length;
  const invalidCount = parsed.errors.length;
  const canProceed = validCount > 0 && invalidCount === 0;

  function nav(to: 1 | 2 | 3 | 4 | 5) {
    setPrevStep(step);
    setStep(to);
  }

  const templates = [
    { label: "Q2 Investor", method: "disperse" as Method, uc: "investor" as UseCase, list: SAMPLE_LIST },
    { label: "Monthly Payroll", method: "disperse" as Method, uc: "team" as UseCase, list: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65, 8500\n0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc, 8500" },
    { label: "Community Drop", method: "airdrop" as Method, uc: "community" as UseCase, list: "0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec, 1000\n0xdF3e18d64BC6A983f673Ab319CCaE4f1a57C7097, 1000\n0xcd3B766CCDd6AE721141F452C550Ca635964ce71, 1000" },
  ];

  function applyTemplate(i: number) {
    const t = templates[i];
    setTemplatePicked(i);
    setMethod(t.method);
    setUseCase(t.uc);
    setRawList(t.list);
  }

  // ENS resolver (mock UI — real ENS requires mainnet)
  async function resolveENS() {
    setEnsResolving(true);
    try {
      // Real ENS resolution: ENS lives on mainnet, so query a mainnet client.
      const { createPublicClient, http } = await import("viem");
      const { mainnet } = await import("viem/chains");
      const { normalize } = await import("viem/ens");
      const ensClient = createPublicClient({
        chain: mainnet,
        transport: http("https://ethereum-rpc.publicnode.com"),
      });
      let unresolved = 0;
      const lines = rawList.split("\n");
      const resolved = await Promise.all(
        lines.map(async (line) => {
          const t = line.trim();
          if (!/\.eth\b/i.test(t)) return line;
          const parts = t.split(",").map((s) => s.trim());
          const name = parts[0], amt = parts.slice(1).join(", ");
          try {
            const addr = await ensClient.getEnsAddress({ name: normalize(name) });
            if (addr) return addr + (amt ? ", " + amt : "");
            unresolved++;
            return line; // leave name in place if it doesn't resolve
          } catch {
            unresolved++;
            return line;
          }
        }),
      );
      setRawList(resolved.join("\n"));
      if (unresolved > 0) toast(`${unresolved} ENS name${unresolved === 1 ? "" : "s"} could not be resolved`, { kind: "error" });
    } catch {
      toast("ENS resolution failed — check your connection", { kind: "error" });
    } finally {
      setEnsResolving(false);
    }
  }

  // CSV drop
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setCsvDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    file.text().then(text => {
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean)
        .map(l => { const cols = l.split(",").map(c => c.trim()); return /^0x[0-9a-fA-F]/i.test(cols[0]) && cols[1] ? cols[0] + ", " + cols[1] : null; })
        .filter(Boolean);
      if (lines.length) setRawList(lines.join("\n"));
    });
  }

  // ── Execute ──
  const executeRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const [execStuck, setExecStuck] = useState(false);
  const stuckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startStuckTimer() {
    if (stuckTimerRef.current) clearTimeout(stuckTimerRef.current);
    setExecStuck(false);
    stuckTimerRef.current = setTimeout(() => setExecStuck(true), 18000); // 18s
  }
  function clearStuckTimer() {
    if (stuckTimerRef.current) clearTimeout(stuckTimerRef.current);
    setExecStuck(false);
  }

  const execute = useCallback(async () => {
    if (!address || !walletClient || !publicClient) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const encryptor = (zama as any).relayer;

    // Guard: FHE WASM must be initialized before we can encrypt anything.
    if (!encryptor) {
      toast("FHE module is still initializing — wait a moment then try again", { kind: "error" });
      nav(3);
      return;
    }

    setWalletRejected(false);
    setSealLog([]);
    const token = CUSDT.wrapper as Address;

    // Gas saver: only authorize the operator if it isn't already set.
    // Our deadline is year 2106, so one approval covers all future distributions.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function ensureOperator(abi: any, spender: Address): Promise<boolean> {
      try {
        const already = await publicClient!.readContract({ address: token, abi, functionName: "isOperator", args: [address!, spender] }) as boolean;
        if (already) return false; // skip the tx — already authorized
      } catch { /* fall through to setOperator if the read fails */ }
      const opHash = await walletClient!.writeContract({ address: token, abi, functionName: "setOperator", args: [spender, OPERATOR_DEADLINE] });
      await publicClient!.waitForTransactionReceipt({ hash: opHash });
      return true;
    }

    try {
      if (method === "airdrop") {
        // Phase 0 — authorize operator (skipped if already set)
        setExecPhaseIdx(0); setExecPhaseLabel("Checking operator authorization…"); setExecProgress(5);
        startStuckTimer();
        const didAuth = await ensureOperator(erc7984OperatorAbi, TOKENOPS.airdropFactory as Address);
        clearStuckTimer();
        if (didAuth) { setExecPhaseLabel("Authorized ✓"); }
        else { setExecPhaseLabel("Operator already authorized — skipping (saves gas)"); }
        setExecProgress(12);

        // Phase 0.5 — derive a browser session signing key from ONE MetaMask signature.
        // This lets us authorize all N recipients without N more MetaMask popups.
        // The private key is ephemeral — lives only in memory for this session.
        const signerSalt = toHex(crypto.getRandomValues(new Uint8Array(16)));
        setExecPhaseLabel(`Sign once to authorize all ${rows.length} sealed allocations — no more MetaMask after this`);
        setExecProgress(15);
        startStuckTimer();
        const sessionSig = await walletClient!.signMessage({
          account: walletClient!.account!,
          message: `Sotto batch signing\nWallet: ${address}\nSalt: ${signerSalt}\n\nThis derives a temporary in-browser key to sign claim authorizations.\nNo funds move. No gas spent. Key is discarded after sealing.`,
        });
        clearStuckTimer();
        const sessionPrivKey = keccak256(toBytes(sessionSig)) as `0x${string}`;
        const sessionAccount = privateKeyToAccount(sessionPrivKey);
        setExecPhaseLabel("Session key ready · deploying airdrop contract…"); setExecProgress(18);

        // Deploy + fund — admin is the session key address so it can verify claim sigs
        setExecPhaseLabel("Check MetaMask — approve deploy & fund"); setExecProgress(20);
        startStuckTimer();
        const factory = createConfidentialAirdropFactoryClient({ publicClient, walletClient, encryptor });
        const now = Math.floor(Date.now() / 1000);
        const endTimestamp = timeLock && lockDate
          ? Math.floor(new Date(lockDate).getTime() / 1000)
          : now + 60 * 60 * 24 * 30;
        const { hash, airdrop } = await factory.createAndFundConfidentialAirdrop({
          params: { token, startTimestamp: now - 60, endTimestamp, canExtendClaimWindow: true, admin: sessionAccount.address },
          userSalt: randomSalt(),
          amount: total,
        });
        clearStuckTimer();
        setExecPhaseLabel("Deployed · encrypting & signing all allocations in browser…"); setExecProgress(30);

        // Phase 1 — FHE encrypt + sign with session account (zero MetaMask popups)
        setExecPhaseIdx(1);
        const claims: ClaimRecord[] = [];
        const chainId = walletClient!.chain!.id;
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          setSealLog(prev => [...prev, { idx: i + 1, addr: shortAddr(r.recipient, 5), op: "encrypting…", done: false }]);
          setExecPhaseLabel(`FHE encrypting + signing ${i + 1} / ${rows.length} · ${shortAddr(r.recipient)}`);
          setExecProgress(30 + Math.round((i + 1) / rows.length * 55));
          const enc = await encryptUint64({ encryptor, contractAddress: airdrop, userAddress: r.recipient, value: toRaw(r.amount) });
          // Sign with local session key — same EIP-712 structure as signClaimAuthorization, no MetaMask
          const signature = await sessionAccount.signTypedData({
            domain: { name: "ConfidentialAirdrop", version: "1", chainId, verifyingContract: airdrop },
            types: { Claim: [{ name: "recipient", type: "address" }, { name: "encryptedAmount", type: "bytes32" }] },
            primaryType: "Claim",
            message: { recipient: r.recipient as Address, encryptedAmount: enc.handle as `0x${string}` },
          });
          setSealLog(prev => prev.map((row, j) => j === i ? { ...row, op: "sealed ✓", done: true } : row));
          claims.push({ recipient: r.recipient, handle: enc.handle, inputProof: enc.inputProof, signature: signature as Hex, amount: toRaw(r.amount).toString() });
        }

        // Phase 2 — persist
        // admin = user's MetaMask address for dashboard lookup
        // signerAddress = session key (on-chain admin for claim verification)
        // signerSalt = stored so the user can re-derive the key for revocation
        setExecPhaseIdx(2); setExecPhaseLabel("Saving sealed campaign…"); setExecProgress(88);
        const campaign: Campaign = {
          airdrop, name: `${ucName} #${Date.now().toString().slice(-4)}`,
          admin: address!, token, symbol: CUSDT.symbol,
          startTime: now - 60, endTime: endTimestamp,
          txHash: hash, recipientCount: rows.length, createdAt: Date.now(),
          signerAddress: sessionAccount.address, signerSalt,
        };
        const res = await fetch("/api/campaigns", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ campaign, claims }) });
        if (!res.ok) throw new Error("Failed to save campaign.");

        setExecPhaseIdx(3); setExecPhaseLabel("Sealed onchain ✓"); setExecProgress(100);
        setResult({ airdrop, txHash: hash, count: rows.length });
        toast("Airdrop deployed and funded", { kind: "success", href: explorerTx(hash), hrefLabel: "View tx ↗" });
        await new Promise(r => setTimeout(r, 700));
        nav(5);

      } else {
        // ── Disperse ──
        // Phase 0 — authorize operator (skipped if already set)
        setExecPhaseIdx(0); setExecPhaseLabel("Checking operator authorization…"); setExecProgress(8);
        startStuckTimer();
        const didAuth = await ensureOperator(disperseOperatorAbi, TOKENOPS.disperseSingleton as Address);
        clearStuckTimer();
        setExecPhaseLabel(didAuth ? "Authorized ✓" : "Operator already authorized — skipping (saves gas)");
        setExecProgress(22);

        // Phase 1 — FHE encrypt batch (browser) then wallet tx
        // Note: client.disperse() does BOTH encrypt AND tx in one call.
        // FHE encryption happens first (can take 10–30s per amount), then MetaMask pops up.
        setExecPhaseIdx(1);
        setExecPhaseLabel(`FHE encrypting ${rows.length} amounts in browser (no MetaMask yet)…`);
        setExecProgress(40);
        const client = createConfidentialDisperseClient({ publicClient, walletClient, encryptor });

        // Start a timer: after ~20s of FHE, MetaMask will appear
        let fheComplete = false;
        const fheHintTimer = setTimeout(() => {
          if (!fheComplete) {
            setExecPhaseLabel("Encryption done — check MetaMask to approve disperse tx");
            startStuckTimer();
          }
        }, Math.max(8000, rows.length * 5000)); // ~5s per recipient heuristic

        const { hash } = await client.disperse({ token, mode: "direct", recipients: rows.map(r => r.recipient), amounts: rows.map(r => toRaw(r.amount)) });
        fheComplete = true;
        clearTimeout(fheHintTimer);
        clearStuckTimer();

        setExecPhaseIdx(2); setExecPhaseLabel("Confirming disperse on Sepolia…"); setExecProgress(80);
        await publicClient.waitForTransactionReceipt({ hash });

        // Save disperse record so recipients can discover it.
        setExecPhaseLabel("Saving activity record for recipients…"); setExecProgress(92);
        fetch("/api/disperse", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            txHash: hash,
            name: `${ucName} #${Date.now().toString().slice(-4)}`,
            admin: address,
            token,
            symbol: CUSDT.symbol,
            recipients: rows.map(r => r.recipient),
            createdAt: Date.now(),
          }),
        }).catch(() => {}); // best-effort, don't block on failure

        setExecPhaseIdx(3); setExecPhaseLabel("Sealed onchain ✓"); setExecProgress(100);
        setResult({ txHash: hash, count: rows.length });
        toast("Confidential disperse complete — recipients' balances updated", { kind: "success", href: explorerTx(hash), hrefLabel: "View tx ↗" });
        await new Promise(r => setTimeout(r, 700));
        nav(5);
      }
    } catch (e) {
      clearStuckTimer();
      const msg = String(e instanceof Error ? e.message : e);
      const isRejection = /rejected|aborted|denied/i.test(msg);
      if (isRejection) {
        setWalletRejected(true);
        toast("Wallet request rejected — click 'Encrypt & seal onchain' to try again.", { kind: "error" });
      } else {
        toast(humanizeError(e), { kind: "error" });
      }
      nav(3);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, walletClient, publicClient, zama, method, timeLock, lockDate, rows, total]);

  executeRef.current = execute;

  // Vesting bars
  const vestingBars = useMemo(() => {
    const dur = Math.max(vestingDuration, 1);
    const cliff = Math.min(cliffMonths, dur);
    const linear = dur - cliff;
    return Array.from({ length: Math.min(dur, 36) }, (_, i) => {
      const isCliff = i < cliff;
      const frac = isCliff ? 0 : linear > 0 ? (i - cliff + 1) / linear : 1;
      return { h: (isCliff ? 8 : Math.max(4, Math.round(frac * 72))) + "px", isCliff, op: isCliff ? ".4" : String(Math.round((0.35 + frac * 0.65) * 100) / 100) };
    });
  }, [cliffMonths, vestingDuration]);

  // Collect config
  const ucName = { investor: "Investor allocation", team: "Team payout", community: "Community airdrop" }[useCase];
  const claimUrl = typeof window !== "undefined" ? `${window.location.origin}/claim` : "/claim";

  const zkRecipients = rows.slice(0, 6).map(r => ({ addr: r.recipient }));

  // Progress bar width for header
  const progressW = step >= 2 ? `${Math.min((step - 1) * 25, 100)}%` : "0%";

  if (!isConnected) {
    return (
      <>
        <AppShell />
        <div style={{ minHeight: "calc(100vh - 56px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", maxWidth: 400, padding: 40 }}>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 36, color: "var(--ink)", marginBottom: 12 }}>Connect to distribute</div>
            <p style={{ fontSize: 15, color: "var(--mid)", lineHeight: 1.6, marginBottom: 28 }}>You need a wallet to create a confidential distribution.</p>
            <button className="s-btn" onClick={openConnectModal} style={{ fontSize: 15 }}>Connect wallet →</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AppShell />

      {/* Progress bar */}
      <div style={{ position: "fixed", top: 56, left: 0, right: 0, height: 2.5, zIndex: 60, background: "var(--line)" }}>
        <div style={{ height: "100%", background: "var(--accent)", transition: "width .55s cubic-bezier(.4,0,.2,1)", width: progressW }} />
      </div>

      {/* Ambient background */}
      <div style={{ position: "fixed", inset: "56px 0 0 0", zIndex: 0, pointerEvents: "none", opacity: 0.55 }}>
        <CanvasBackground variant="flow" />
      </div>

      <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "center", minHeight: "calc(100vh - 56px)", marginTop: 2.5 }}>
        <div style={{ display: "flex", width: "100%", maxWidth: step === 4 ? 1060 : step === 5 ? 760 : 1120, transition: "max-width .4s ease" }}>
        {/* Main */}
        <div style={{ flex: 1, padding: step === 4 ? "34px 44px 48px" : "46px 44px", overflowY: "auto", display: "flex", justifyContent: "center" }}>
          <div style={{ maxWidth: step === 4 ? 1060 : step === 5 ? 760 : 600, width: "100%" }}>

            {/* Step rail — visible on steps 1-4 */}
            {step <= 4 && (
              <StepRail
                current={step}
                steps={[
                  { n: "01", label: "Configure" },
                  { n: "02", label: "Recipients" },
                  { n: "03", label: "Review" },
                  { n: "04", label: "Seal" },
                ]}
              />
            )}

            {/* ─── STEP 1: Configure ─── */}
            {step === 1 && (
              <div className="anim-slide-up">
                <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 44, color: "var(--ink)", margin: "0 0 4px", letterSpacing: "-.015em" }}>What kind of distribution?</h2>
                <p style={{ fontSize: 15, color: "var(--mid)", margin: "10px 0 22px" }}>Or start from a template:</p>

                {/* First-run hint */}
                {!hintDismissed && (
                  <div className="hint-card" style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>🔒</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>How confidential distribution works</div>
                      <div style={{ fontSize: 13, color: "var(--mid)", lineHeight: 1.6 }}>
                        Every amount is encrypted on your device using <strong>FHE (Fully Homomorphic Encryption)</strong> before anything is sent. The blockchain stores ciphertext — numbers no one can read. Only each recipient&apos;s wallet can unlock their own allocation.
                      </div>
                      <div style={{ display: "flex", gap: 16, marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--soft)" }}>
                        <span>Step 1: Configure</span>
                        <span>→ Step 2: Upload addresses</span>
                        <span>→ Step 3: Review & seal</span>
                      </div>
                    </div>
                    <button onClick={() => setHintDismissed(true)} aria-label="Dismiss hint" style={{ background: "none", border: "none", color: "var(--soft)", cursor: "pointer", fontSize: 16, flexShrink: 0, padding: 2 }}>✕</button>
                  </div>
                )}

                {/* Faucet */}
                <div style={{ marginBottom: 24 }}>
                  <Faucet />
                </div>

                {/* Templates */}
                <div className="how-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 9, marginBottom: 26 }}>
                  {templates.map((t, i) => (
                    <div key={i} onClick={() => applyTemplate(i)} style={{ padding: "13px 14px", borderRadius: 3, background: "var(--card)", border: `1.5px solid ${templatePicked === i ? "rgba(200,71,43,.65)" : "var(--line)"}`, cursor: "pointer", transition: "all .2s" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: ".1em", marginBottom: 6 }}>TEMPLATE</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{t.label}</div>
                      <div style={{ fontSize: 11, color: "var(--soft)", marginTop: 3, fontFamily: "var(--font-mono)" }}>{t.method === "airdrop" ? "Airdrop" : "Disperse"}</div>
                    </div>
                  ))}
                </div>

                {/* Use case */}
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 13 }}>Use case</div>
                <div className="how-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 11, marginBottom: 26 }}>
                  {([["investor", "↗", "Investor", "Cap-table & fund allocations."], ["team", "⇄", "Team", "Payroll & vesting unlocks."], ["community", "◎", "Community", "Private airdrops at scale."]] as const).map(([key, icon, label, desc]) => (
                    <div key={key} onClick={() => setUseCase(key)} style={{ cursor: "pointer", padding: "20px 16px", borderRadius: 4, background: "var(--card)", border: `1.5px solid ${useCase === key ? "rgba(200,71,43,.65)" : "var(--line)"}`, transition: "all .18s" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: useCase === key ? "rgba(200,71,43,.14)" : "rgba(18,16,13,.04)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 13, fontSize: 16 }}>{icon}</div>
                      <div style={{ fontFamily: "var(--font-serif)", fontSize: 21, color: "var(--ink)" }}>{label}</div>
                      <div style={{ fontSize: 12.5, color: "var(--mid)", marginTop: 5 }}>{desc}</div>
                    </div>
                  ))}
                </div>

                {/* Method + Token */}
                <div className="how-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, marginBottom: 24 }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 11, display: "flex", alignItems: "center", gap: 6 }}>
                      Method <InfoTip text="Airdrop: recipients pull their allocation any time during the claim window. Disperse: you push to all recipients at once in a single transaction — faster, no claim step needed." />
                    </div>
                    <div style={{ display: "flex", border: "1.5px solid var(--line)", borderRadius: 3, overflow: "hidden" }}>
                      {(["airdrop", "disperse"] as const).map(m => (
                        <div key={m} onClick={() => setMethod(m)} style={{ flex: 1, textAlign: "center", padding: 12, fontSize: 13.5, fontWeight: 600, cursor: "pointer", background: method === m ? "rgba(200,71,43,.15)" : "transparent", color: method === m ? "var(--accent)" : "var(--mid)", borderRight: m === "airdrop" ? "1px solid var(--line)" : "none", transition: "all .2s" }}>
                          {m.charAt(0).toUpperCase() + m.slice(1)}
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--soft)", marginTop: 8 }}>
                      {method === "airdrop"
                        ? "Recipients pull their allocation when ready. Requires one MetaMask sign per recipient — best for small lists."
                        : "Sealed amounts pushed directly to wallets in a single tx. One MetaMask confirmation regardless of list size."}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 11 }}>Token</div>
                    <div style={{ padding: "9px 12px", borderRadius: 3, background: "rgba(200,71,43,.1)", border: "1.5px solid rgba(200,71,43,.65)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>cUSDT</span>
                      <span style={{ fontSize: 11, color: "var(--mid)" }}>Tether · ERC-7984</span>
                    </div>
                  </div>
                </div>

                {/* Time lock */}
                <div style={{ padding: "16px 18px", background: "var(--card)", border: "1.5px solid var(--line)", borderRadius: 3, marginBottom: 38 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
                        Time lock <InfoTip text="Prevents recipients from claiming before a date you set. Useful for vesting start dates or scheduled payroll. The allocation is still sealed on-chain immediately." />
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--mid)", marginTop: 3 }}>Prevent claims before a set date</div>
                    </div>
                    <div onClick={() => setTimeLock(!timeLock)} className="s-toggle" style={{ background: timeLock ? "var(--accent)" : "var(--soft)" }}>
                      <div className="s-toggle-knob" style={{ left: timeLock ? 21 : 3 }} />
                    </div>
                  </div>
                  {timeLock && (
                    <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12, animation: "fd .2s ease both" }}>
                      <input type="date" value={lockDate} onChange={e => setLockDate(e.target.value)} className="s-input" style={{ flex: 1 }} />
                      {lockDate && <div style={{ fontSize: 13, color: "var(--accent)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>{new Date(lockDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>}
                    </div>
                  )}
                </div>

                <button className="s-btn" onClick={() => nav(2)} style={{ gap: 10 }}>
                  Add recipients <span style={{ fontFamily: "var(--font-mono)" }}>→</span>
                </button>
              </div>
            )}

            {/* ─── STEP 2: Recipients ─── */}
            {step === 2 && (
              <div style={{ animation: `${prevStep < 2 ? "slideL" : "slideR"} .38s cubic-bezier(.22,.85,.2,1) both` }}>
                <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 44, color: "var(--ink)", margin: 0, letterSpacing: "-.015em" }}>Add addresses</h2>
                <p style={{ fontSize: 15, color: "var(--mid)", margin: "10px 0 22px" }}>One per line: <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>address, amount</span>. Encrypted locally — nothing sent yet.</p>

                {/* CSV drop zone */}
                <div
                  onDragOver={e => { e.preventDefault(); setCsvDragging(true); }}
                  onDragLeave={() => setCsvDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  style={{ border: `2px dashed ${csvDragging ? "var(--accent)" : "var(--line)"}`, borderRadius: 4, padding: "18px", textAlign: "center", marginBottom: 14, transition: "all .3s", background: csvDragging ? "rgba(200,71,43,.06)" : "var(--input-bg)", cursor: "pointer", animation: csvDragging ? "csvPulse .8s ease-in-out infinite" : "none" }}
                >
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: csvDragging ? "var(--accent)" : "var(--soft)", letterSpacing: ".08em" }}>
                    {csvDragging ? "✦ Drop CSV file here" : "⬆ Drag & drop CSV · or paste below"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--soft)", marginTop: 4 }}>address, amount per row · header row optional</div>
                  <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" style={{ display: "none" }} onChange={async e => { const f = e.target.files?.[0]; if (f) setRawList(await f.text()); }} />
                </div>

                <div style={{ position: "relative", marginBottom: 12 }}>
                  <textarea
                    spellCheck={false}
                    placeholder={"0xAbCd…1234, 12500\n0xEfGh…5678, 8200"}
                    value={rawList}
                    onChange={e => setRawList(e.target.value)}
                    className="s-input"
                    style={{ height: 230, resize: "none", fontSize: 13.5, lineHeight: 1.8, display: "block", padding: 15 }}
                  />
                  <div onClick={() => setRawList(SAMPLE_LIST)} style={{ position: "absolute", bottom: 11, right: 13, fontSize: 11.5, color: "var(--accent)", cursor: "pointer", fontFamily: "var(--font-mono)", background: "var(--input-bg)", padding: "2px 6px" }}>
                    sample ↻
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: parsed.duplicates > 0 ? 12 : 32, fontFamily: "var(--font-mono)", fontSize: 12, flexWrap: "wrap" }}>
                  <span style={{ color: "var(--green)" }}>{validCount} valid</span>
                  {invalidCount > 0 && <span style={{ color: "var(--accent)" }}>· {invalidCount} invalid</span>}
                  {parsed.errors.length > 0 && <span style={{ fontSize: 11, color: "var(--accent)" }}>{parsed.errors[0]}</span>}
                  <span style={{ color: "var(--soft)", marginLeft: "auto" }}>Total: {fmt(totalNum)} cUSDT</span>
                </div>

                {/* Duplicate-merge notice */}
                {parsed.duplicates > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 14px", background: "rgba(111,175,142,.08)", border: "1.5px solid rgba(111,175,142,.35)", borderRadius: 3, marginBottom: 24, animation: "fd .2s ease both" }}>
                    <span style={{ fontSize: 14 }}>↺</span>
                    <span style={{ fontSize: 12.5, color: "var(--mid)" }}>
                      <strong style={{ color: "var(--ink)" }}>{parsed.duplicates} duplicate {parsed.duplicates === 1 ? "address" : "addresses"} merged</strong> — amounts summed (one allocation per recipient on-chain).
                    </span>
                  </div>
                )}

                {/* ENS resolve */}
                {/\.eth/.test(rawList) && (
                  <div onClick={resolveENS} style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 14px", background: "rgba(200,71,43,.07)", border: "1.5px solid rgba(200,71,43,.35)", borderRadius: 3, cursor: "pointer", marginBottom: 12, animation: "fd .2s ease both" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)", letterSpacing: ".06em" }}>
                      {ensResolving ? "⟳  Resolving…" : "↗  Resolve ENS names"}
                    </span>
                    {ensResolving && <div className="s-spinner" style={{ width: 12, height: 12 }} />}
                  </div>
                )}

                <div style={{ display: "flex", gap: 9, marginBottom: 20 }}>
                  <div onClick={sotto.openAddrBook} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: 9, background: "var(--card)", border: "1.5px solid var(--line)", borderRadius: 3, cursor: "pointer", fontSize: 12.5, color: "var(--mid)" }}>
                    ◧ Address book
                  </div>
                  <div onClick={() => setVestingEnabled(!vestingEnabled)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: 9, background: vestingEnabled ? "rgba(200,71,43,.12)" : "var(--card)", border: `1.5px solid ${vestingEnabled ? "rgba(200,71,43,.55)" : "var(--line)"}`, borderRadius: 3, cursor: "pointer", fontSize: 12.5, color: vestingEnabled ? "var(--accent)" : "var(--mid)" }}>
                    ◑ Vesting schedule
                  </div>
                </div>

                {/* Vesting schedule */}
                {vestingEnabled && (
                  <div style={{ background: "var(--card)", border: "1.5px solid var(--line)", borderRadius: 4, padding: "20px 20px 14px", marginBottom: 20, animation: "fd .22s ease both" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 14 }}>Vesting schedule</div>
                    <div style={{ display: "flex", gap: 18, marginBottom: 16 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: "var(--mid)", marginBottom: 6 }}>Cliff · {cliffMonths}mo cliff</div>
                        <input type="range" min={0} max={18} step={1} value={cliffMonths} onChange={e => setCliffMonths(parseInt(e.target.value))} style={{ width: "100%", accentColor: "var(--accent)" }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: "var(--mid)", marginBottom: 6 }}>Duration · {vestingDuration}mo total</div>
                        <input type="range" min={6} max={48} step={3} value={vestingDuration} onChange={e => setVestingDuration(parseInt(e.target.value))} style={{ width: "100%", accentColor: "var(--accent)" }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80, overflow: "hidden" }}>
                      {vestingBars.map((b, i) => (
                        <div key={i} style={{ flex: 1, minWidth: 3, background: b.isCliff ? "var(--line)" : "var(--accent)", opacity: parseFloat(b.op), borderRadius: "1px 1px 0 0", height: b.h, transition: "height .4s cubic-bezier(.22,.85,.2,1)" }} />
                      ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--soft)" }}>Month 1</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent)", letterSpacing: ".06em" }}>cliff → linear unlock</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--soft)" }}>{vestingDuration}mo total</span>
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div onClick={() => nav(1)} style={{ fontSize: 14, color: "var(--mid)", cursor: "pointer" }}>← Back</div>
                  <button
                    className="s-btn"
                    onClick={() => canProceed && nav(3)}
                    style={{ opacity: canProceed ? 1 : 0.45, cursor: canProceed ? "pointer" : "not-allowed" }}
                    disabled={!canProceed}
                  >
                    Review <span style={{ fontFamily: "var(--font-mono)" }}>→</span>
                  </button>
                </div>

                {/* Address book drawer */}
                {sotto.showAddrBook && (
                  <>
                    <div onClick={sotto.closeAddrBook} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,.36)", backdropFilter: "blur(2px)", animation: "fd .2s ease both" }} />
                    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 400, zIndex: 71, background: "var(--overlay)", borderLeft: "1px solid var(--line)", padding: 28, overflowY: "auto", animation: "slideInR .28s cubic-bezier(.22,.85,.2,1) both", display: "flex", flexDirection: "column" }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 22 }}>
                        <div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 6 }}>Address book</div>
                          <div style={{ fontFamily: "var(--font-serif)", fontSize: 28, color: "var(--ink)" }}>Saved lists</div>
                        </div>
                        <div onClick={sotto.closeAddrBook} style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--soft)", cursor: "pointer" }}>✕ close</div>
                      </div>
                      <div onClick={() => rawList && sotto.saveToBook(rawList)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 14px", border: "1.5px dashed var(--line)", borderRadius: 3, cursor: "pointer", marginBottom: 14 }}>
                        <span style={{ fontSize: 18, color: "var(--soft)" }}>+</span>
                        <span style={{ fontSize: 13.5, color: "var(--mid)" }}>Save current list</span>
                      </div>
                      {sotto.addressBook.map(entry => (
                        <div key={entry.id} onClick={() => { sotto.loadFromBook(entry.list); }} style={{ padding: "15px 16px", background: "var(--card)", border: "1.5px solid var(--line)", borderRadius: 3, cursor: "pointer", marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{entry.name}</div>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--soft)" }}>{entry.count} addrs</div>
                          </div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: ".08em" }}>LOAD →</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ─── STEP 3: Review ─── */}
            {step === 3 && (
              <div style={{ animation: `${prevStep < 3 ? "slideL" : "slideR"} .38s cubic-bezier(.22,.85,.2,1) both` }}>
                <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 44, color: "var(--ink)", margin: 0, letterSpacing: "-.015em" }}>Confirm & seal</h2>
                <p style={{ fontSize: 15, color: "var(--mid)", margin: "10px 0 24px" }}>After sealing, only recipients can decrypt their amounts.</p>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--soft)" }}>{validCount} recipients</span>
                  <div onClick={() => setPreviewRedacted(!previewRedacted)} style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--accent)", cursor: "pointer" }}>
                    {previewRedacted ? "Show as sender" : "Show as recipient"}
                  </div>
                </div>

                {/* Large-list airdrop warning */}
                {method === "airdrop" && rows.length > 10 && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "13px 16px", background: "rgba(200,71,43,.07)", border: "1.5px solid rgba(200,71,43,.35)", borderRadius: 4, marginBottom: 14 }}>
                    <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.3 }}>⚠️</span>
                    <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.6 }}>
                      <strong>Airdrop requires {rows.length} MetaMask sign requests</strong> — one per recipient, because each encrypted amount is unique and must be individually authorized.{" "}
                      <span
                        onClick={() => { setMethod("disperse"); nav(1); }}
                        style={{ color: "var(--accent)", cursor: "pointer", textDecoration: "underline", fontWeight: 600 }}
                      >
                        Switch to Disperse instead
                      </span>
                      {" "}— same sealed amounts delivered in a single transaction, zero signing loop. Use Airdrop only when you need individual claim windows.
                    </div>
                  </div>
                )}

                <div style={{ background: "var(--card)", border: "1.5px solid var(--line)", borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
                  <div style={{ maxHeight: 260, overflowY: "auto" }}>
                    {rows.slice(0, 12).map((r, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 20px", borderBottom: "1px solid var(--line)" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--mid)", flex: 1 }}>{shortAddr(r.recipient, 6)}</span>
                        {!previewRedacted ? (
                          <>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>{fmt(parseFloat(r.amount))}</span>
                            <span style={{ fontSize: 11, color: "var(--soft)", marginLeft: 5 }}>cUSDT</span>
                          </>
                        ) : (
                          <span style={{ height: 12, width: (46 + (i * 37) % 66) + "px", background: "var(--bar)", borderRadius: 1, animation: "inkbar .3s ease both" }} />
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 20px", borderTop: "1px solid var(--line)", background: "var(--overlay)" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".07em", color: "var(--soft)" }}>TOTAL</span>
                    {!previewRedacted
                      ? <span style={{ fontFamily: "var(--font-mono)", fontSize: 14.5, fontWeight: 600, color: "var(--ink)" }}>{fmt(totalNum)} cUSDT</span>
                      : <span style={{ height: 13, width: 88, background: "var(--bar)", borderRadius: 1, animation: "inkbar .3s ease both" }} />
                    }
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14, fontSize: 13, color: "var(--mid)" }}>
                  <span style={{ width: 17, height: 17, borderRadius: "50%", border: "1.5px solid var(--green)", color: "var(--green)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, flexShrink: 0 }}>✓</span>
                  Encrypted client-side, ZK-verified before broadcast.
                </div>

                {/* Sender confidential balance check — confidential transfers silently send 0 if you're short */}
                {(() => {
                  const bal = senderBalance.data;
                  const insufficient = bal !== undefined && bal < total;
                  return (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 15px", borderRadius: 4, marginBottom: insufficient ? 12 : (walletRejected ? 12 : 30), background: insufficient ? "rgba(200,71,43,.07)" : "var(--card)", border: `1px solid ${insufficient ? "rgba(200,71,43,.4)" : "var(--line)"}` }}>
                      <span style={{ fontSize: 12.5, color: "var(--mid)" }}>Your confidential {CUSDT.symbol} balance</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: insufficient ? "var(--accent)" : "var(--ink)" }}>
                        {senderBalance.isFetching ? "decrypting…" : bal !== undefined ? `${fmtToken(bal)} / ${fmtToken(total)}` : "— (will verify on seal)"}
                      </span>
                    </div>
                  );
                })()}
                {senderBalance.data !== undefined && senderBalance.data < total && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "12px 15px", background: "rgba(200,71,43,.08)", border: "1.5px solid rgba(200,71,43,.4)", borderRadius: 4, marginBottom: 22 }}>
                    <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.3 }}>⚠️</span>
                    <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.55 }}>
                      <strong>Insufficient balance.</strong> You&apos;re sending {fmtToken(total)} {CUSDT.symbol} but only hold {fmtToken(senderBalance.data)}. Confidential transfers <strong>silently send 0</strong> when you&apos;re short — fund more via the faucet on step 1 before sealing.
                    </div>
                  </div>
                )}

                {/* Wallet rejection retry banner */}
                {walletRejected && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", background: "rgba(200,71,43,.08)", border: "1.5px solid rgba(200,71,43,.4)", borderRadius: 4, marginBottom: 20, animation: "fd .25s ease both" }}>
                    <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.4 }}>↺</span>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", marginBottom: 3 }}>Transaction rejected</div>
                      <div style={{ fontSize: 13, color: "var(--mid)", lineHeight: 1.55 }}>You cancelled the wallet request. Everything is still here — click <strong style={{ color: "var(--ink)" }}>Encrypt &amp; seal onchain</strong> to try again. If MetaMask doesn&apos;t appear, click its icon in your browser toolbar.</div>
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div onClick={() => nav(2)} style={{ fontSize: 14, color: "var(--mid)", cursor: "pointer" }}>← Back</div>
                  <div style={{ display: "flex", gap: 9 }}>
                    <div onClick={() => { sotto.addToBatch({ name: `Distribution #${Date.now().toString().slice(-4)}`, count: validCount, token: "cUSDT" }); }} style={{ padding: "14px 18px", borderRadius: 3, border: "1.5px solid var(--line)", color: "var(--mid)", cursor: "pointer", fontSize: 13.5 }}>+ Batch</div>
                    <button
                      className="s-btn"
                      onClick={() => {
                        if (senderBalance.data !== undefined && senderBalance.data < total) {
                          toast(`Insufficient confidential balance — fund at least ${fmtToken(total)} ${CUSDT.symbol} via the faucet first`, { kind: "error" });
                          return;
                        }
                        setWalletRejected(false); nav(4); setTimeout(() => executeRef.current?.(), 50);
                      }}
                    >
                      {walletRejected ? "Try again →" : "Encrypt & seal onchain"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ─── STEP 4: ZK Sealing ─── */}
            {step === 4 && (
              <div style={{ animation: "fd .4s ease both" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 10 }}>Step 04 / 04 — Sealing</div>
                <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 40, color: "var(--ink)", margin: "0 0 6px", letterSpacing: "-.015em" }}>Sealing on-chain</h2>
                <p style={{ fontSize: 14.5, color: "var(--mid)", margin: "8px 0 20px", maxWidth: 560, lineHeight: 1.55 }}>Encrypting {validCount} allocation{validCount === 1 ? "" : "s"} with FHE and committing the proof to Sepolia. Keep this tab open until it confirms.</p>

                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) 320px", gap: 18, alignItems: "start" }} className="airdrop-grid">
                  {/* Left: circuit + phases */}
                  <div>
                    <div style={{ position: "relative", background: "var(--card)", border: "1.5px solid var(--line)", borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
                      <ZKCanvas execProgress={execProgress} execPhaseIdx={execPhaseIdx} recipients={zkRecipients} />
                      <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 10, maxWidth: "90%" }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid var(--line)", borderTopColor: "var(--accent)", animation: "spin .78s linear infinite", flexShrink: 0 }} />
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".08em", color: "var(--accent)" }}>{execPhaseLabel || "INITIALIZING…"}</span>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 10 }}>
                      {["Encrypt", "ZK Proof", "Broadcast", "Confirm"].map((label, i) => {
                        const active = execPhaseIdx === i, done = execPhaseIdx > i;
                        return (
                          <div key={i} style={{ padding: "11px 13px", borderRadius: 4, background: done ? "rgba(111,175,142,.1)" : active ? "rgba(200,71,43,.07)" : "var(--card)", border: `1px solid ${done ? "rgba(111,175,142,.4)" : active ? "rgba(200,71,43,.4)" : "var(--line)"}`, transition: "all .4s" }}>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".1em", color: done ? "var(--green)" : active ? "var(--accent)" : "var(--soft)" }}>0{i + 1}</div>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", marginTop: 4 }}>{label}</div>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: done ? "var(--green)" : active ? "var(--accent)" : "var(--soft)", marginTop: 4 }}>{done ? "done" : active ? "active…" : "waiting"}</div>
                          </div>
                        );
                      })}
                    </div>
                    {/* MetaMask stuck hint */}
                    {execStuck && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 14px", background: "rgba(200,71,43,.08)", border: "1.5px solid rgba(200,71,43,.4)", borderRadius: 3, marginBottom: 10, animation: "fd .3s ease both" }}>
                        <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
                        <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.55 }}>
                          <strong>MetaMask popup may be blocked.</strong> Click the MetaMask icon in your browser toolbar, or check for a pending notification. In Brave, temporarily disable shields for this site.
                        </div>
                      </div>
                    )}
                    {/* Progress bar + % */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
                      <div style={{ flex: 1, height: 4, background: "var(--line)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", background: "linear-gradient(90deg,var(--accent),var(--green))", width: `${execProgress}%`, transition: "width .4s linear" }} />
                      </div>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--soft)", minWidth: 34, textAlign: "right" }}>{Math.round(execProgress)}%</span>
                    </div>

                    {/* Operation log — shows real-time per-recipient encryption status */}
                    <div style={{ marginTop: 14, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 5, padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)" }}>Operation log</div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--soft)" }}>{sealLog.filter(r => r.done).length} / {validCount} · cUSDT euint64</div>
                      </div>
                      <div style={{ minHeight: 210, maxHeight: 210, overflowY: "auto" }}>
                        {sealLog.length > 0 ? sealLog.map((row, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < sealLog.length - 1 ? "1px solid var(--line)" : "none", animation: "rowIn .3s ease both" }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--soft)", width: 22, flexShrink: 0 }}>#{row.idx}</span>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--mid)", flex: 1 }}>{row.addr}</span>
                            <span style={{ height: 10, width: (44 + (i * 37) % 56) + "px", background: "var(--bar)", borderRadius: 1, flexShrink: 0 }} />
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: row.done ? "var(--green)" : "var(--accent)", minWidth: 70, textAlign: "right" }}>{row.op}</span>
                          </div>
                        )) : (
                          // Placeholder rows so the panel isn't blank before encryption starts
                          rows.slice(0, Math.min(rows.length, 6)).map((r, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < Math.min(rows.length, 6) - 1 ? "1px solid var(--line)" : "none", opacity: 0.5 }}>
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--soft)", width: 22, flexShrink: 0 }}>#{i + 1}</span>
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--soft)", flex: 1 }}>{shortAddr(r.recipient, 5)}</span>
                              <span style={{ height: 10, width: (44 + (i * 37) % 56) + "px", background: "var(--line)", borderRadius: 1, flexShrink: 0 }} />
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--soft)", minWidth: 70, textAlign: "right" }}>queued</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: crypto detail + live status */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 4, padding: "16px 18px" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 12 }}>Cryptography</div>
                      {[["Scheme", "TFHE (tfhe-rs)"], ["Type", "euint64"], ["Input proof", "ZKPoK"], ["Token", "cUSDT"], ["Recipients", String(validCount)], ["Network", "Sepolia"]].map(([k, v]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
                          <span style={{ color: "var(--soft)" }}>{k}</span>
                          <span style={{ color: "var(--ink)" }}>{v}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 4, padding: "16px 18px" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 12 }}>Live status</div>
                      {["Encrypt", "ZK Proof", "Broadcast", "Confirm"].map((label, i) => {
                        const active = execPhaseIdx === i, done = execPhaseIdx > i;
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 0", opacity: active || done ? 1 : 0.45 }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: done ? "var(--green)" : active ? "var(--accent)" : "var(--soft)", animation: active ? "glow 1.4s ease-in-out infinite" : "none", flexShrink: 0 }} />
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: done ? "var(--green)" : active ? "var(--ink)" : "var(--soft)" }}>{label}</span>
                            <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: done ? "var(--green)" : active ? "var(--accent)" : "var(--soft)" }}>{done ? "✓ done" : active ? "active" : "waiting"}</span>
                          </div>
                        );
                      })}
                      <div style={{ borderTop: "1px solid var(--line)", marginTop: 8, paddingTop: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: 12, color: "var(--soft)" }}>Contract</span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--mid)" }}>{shortAddr(method === "disperse" ? TOKENOPS.disperseSingleton : TOKENOPS.airdropFactory, 5)}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, color: "var(--soft)" }}>Est. gas</span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--mid)" }}>~{(validCount * 23800 + 42000).toLocaleString()} gas</span>
                        </div>
                      </div>
                    </div>

                    {/* Delivery method note */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", background: method === "disperse" ? "rgba(111,175,142,.08)" : "rgba(200,71,43,.06)", border: `1px solid ${method === "disperse" ? "rgba(111,175,142,.35)" : "rgba(200,71,43,.25)"}`, borderRadius: 4 }}>
                      <span style={{ width: 16, height: 16, borderRadius: "50%", border: `1.4px solid ${method === "disperse" ? "var(--green)" : "var(--accent)"}`, color: method === "disperse" ? "var(--green)" : "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 10, flexShrink: 0, marginTop: 1 }}>i</span>
                      <div style={{ fontSize: 12, color: "var(--mid)", lineHeight: 1.55 }}>
                        {method === "disperse"
                          ? <><strong style={{ color: "var(--ink)" }}>Sent directly to wallets.</strong> Recipients receive their sealed balance immediately — no claim step needed. They can decrypt it anytime.</>
                          : <><strong style={{ color: "var(--ink)" }}>Claim-based airdrop.</strong> Recipients pull their allocation from the claim page whenever they&apos;re ready, within the claim window.</>}
                      </div>
                    </div>

                    {/* Privacy statement */}
                    <div style={{ background: "var(--ink)", borderRadius: 4, padding: "14px 16px", position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(45deg,transparent,transparent 7px,rgba(255,255,255,.04) 7px,rgba(255,255,255,.04) 8px)" }} />
                      <div style={{ position: "relative", fontSize: 12, lineHeight: 1.55, color: "var(--page-bg)", opacity: .82 }}>
                        Amounts are encrypted in your browser. The chain only ever stores ciphertext — not even Sotto can read them.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── STEP 5: Receipt ─── */}
            {step === 5 && result && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "52vh", textAlign: "center", animation: "up .5s cubic-bezier(.22,.85,.2,1) both" }}>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, letterSpacing: ".24em", color: "var(--green)", border: "2px solid var(--green)", padding: "8px 16px", borderRadius: 2, transform: "rotate(-3deg)", display: "inline-block", animation: "stampThud .7s .1s both", boxShadow: "0 3px 14px rgba(111,175,142,.28)" }}>SEALED</div>
                </div>
                <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 46, color: "var(--ink)", margin: 0, letterSpacing: "-.015em" }}>Distribution is live</h2>
                <p style={{ fontSize: 15.5, color: "var(--mid)", margin: "12px auto 0", maxWidth: 440, lineHeight: 1.6 }}>
                  {result.count} recipients · amounts sealed onchain.
                </p>

                {/* Claim link — per-distribution deep link */}
                {(() => {
                  const deepLink = result.airdrop
                    ? `${typeof window !== "undefined" ? window.location.origin : ""}/claim?id=${result.airdrop}`
                    : claimUrl;
                  return (
                    <div style={{ maxWidth: 480, width: "100%", margin: "26px auto 0", background: "var(--card)", border: "1.5px solid var(--line)", borderRadius: 4, padding: "18px 20px", textAlign: "left" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 10 }}>Claim link · share with recipients</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
                        <div style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--mid)", background: "var(--input-bg)", padding: "9px 12px", borderRadius: 3, border: "1px solid var(--line)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{deepLink}</div>
                        <button
                          aria-label="Copy claim link"
                          onClick={() => { navigator.clipboard?.writeText(deepLink); setClaimLinkCopied(true); setTimeout(() => setClaimLinkCopied(false), 2000); }}
                          style={{ background: "var(--ink)", color: "var(--page-bg)", padding: "9px 14px", borderRadius: 3, fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, border: "none" }}
                        >
                          {claimLinkCopied ? "✓ Copied" : "Copy"}
                        </button>
                      </div>
                      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                        <QRCode value={deepLink} size={80} />
                        <div style={{ fontSize: 12.5, color: "var(--mid)", lineHeight: 1.55 }}>
                          Recipients scan or click — the link opens directly on this distribution. Only their wallet decrypts their amount.
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Tx details */}
                <div style={{ maxWidth: 480, width: "100%", margin: "14px auto 0", background: "var(--card)", border: "1.5px solid var(--line)", borderRadius: 4, padding: "18px 20px", textAlign: "left" }}>
                  {[
                    ["TX", shortAddr(result.txHash, 8)],
                    ...(result.airdrop ? [["AIRDROP", shortAddr(result.airdrop, 8)]] : []),
                    ["NETWORK", "Sepolia · ERC-7984"],
                  ].map(([k, v], i, arr) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--soft)" }}>{k}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--ink)" }}>{v}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
                  <a href={explorerTx(result.txHash)} target="_blank" rel="noreferrer" style={{ background: "var(--ink)", color: "var(--page-bg)", padding: "13px 26px", borderRadius: 3, fontSize: 14.5, fontWeight: 700, cursor: "pointer", textDecoration: "none" }}>View on Etherscan ↗</a>
                  <div onClick={() => { setStep(1); setRawList(""); setResult(null); setPreviewRedacted(false); setTemplatePicked(null); setClaimLinkCopied(false); }} style={{ border: "1.5px solid var(--line)", color: "var(--mid)", padding: "13px 22px", borderRadius: 3, fontSize: 14.5, fontWeight: 500, cursor: "pointer" }}>New distribution</div>
                </div>
                {result.airdrop && (
                  <div style={{ display: "flex", gap: 9, marginTop: 10 }}>
                    <div onClick={() => sotto.addToBatch({ name: ucName, count: result.count, token: "cUSDT" })} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: 11, border: "1.5px solid var(--line)", color: "var(--mid)", borderRadius: 3, fontSize: 13, fontWeight: 500, cursor: "pointer", maxWidth: 200 }}>+ Add to batch</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Side panel: "what Etherscan sees" ── */}
        {step >= 1 && step <= 3 && (
          <div style={{ width: 390, flexShrink: 0, borderLeft: "1px solid var(--line)", background: "var(--surface)", padding: "44px 30px", overflowY: "auto", transition: "all .4s" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 20 }}>Onchain · what Etherscan sees</div>
            <div style={{ position: "relative", background: "repeating-linear-gradient(0deg,rgba(18,16,13,.012) 0,rgba(18,16,13,.012) 1px,transparent 1px,transparent 26px),#F7F3E9", border: "1px solid rgba(18,16,13,.1)", borderRadius: 4, boxShadow: "0 2px 0 rgba(255,255,255,.7) inset,0 26px 52px -22px rgba(18,16,13,.44)", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 12, right: 14, zIndex: 2, fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: ".2em", color: "#C8472B", border: "1.5px solid #C8472B", padding: "4px 9px", borderRadius: 2, transform: "rotate(-4deg)" }}>
                {step === 3 ? "PREVIEW" : "DRAFT"}
              </div>
              <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid rgba(18,16,13,.09)" }}>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "#12100D" }}>
                  {ucName || "Distribution"}
                </div>
                <div style={{ fontSize: 12, color: "#6A6354", marginTop: 4 }}>
                  {method} · {validCount} recipients
                </div>
              </div>
              <div>
                {(validCount > 0 ? rows : []).slice(0, 6).map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", borderBottom: "1px solid rgba(18,16,13,.055)" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "#4A4438", flex: 1 }}>{shortAddr(r.recipient, 5)}</span>
                    <span style={{ height: 11, width: (44 + (i * 37) % 68) + "px", background: "#12100D", borderRadius: 1, opacity: .82, animation: "inkSweep .45s ease both" }} />
                  </div>
                ))}
                {validCount === 0 && (
                  <div style={{ padding: "20px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "#8A8273" }}>Add recipients to preview</div>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 20px", borderTop: "1px solid rgba(18,16,13,.09)", background: "rgba(18,16,13,.025)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "#8A8273", letterSpacing: ".06em" }}>TOTAL · SEALED</span>
                <span style={{ height: 10, width: 58, background: "#12100D", borderRadius: 1, opacity: .82 }} />
              </div>
            </div>
            <div style={{ marginTop: 18, padding: "14px 16px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 3 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 7 }}>What observers see</div>
              <div style={{ fontSize: 13, color: "var(--mid)", lineHeight: 1.55 }}>Every address is public. Every amount is FHE ciphertext — literally unreadable without the key.</div>
            </div>

            {/* Batch panel trigger */}
            {sotto.batchQueue.length > 0 && (
              <div onClick={() => setShowBatchPanel(!showBatchPanel)} style={{ marginTop: 14, padding: "12px 16px", background: "rgba(200,71,43,.08)", border: "1.5px solid rgba(200,71,43,.35)", borderRadius: 3, cursor: "pointer" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)" }}>BATCH QUEUE · {sotto.batchQueue.length} queued →</div>
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Batch bottom panel */}
      {showBatchPanel && sotto.batchQueue.length > 0 && (
        <>
          <div onClick={() => setShowBatchPanel(false)} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,.36)", backdropFilter: "blur(2px)" }} />
          <div style={{ position: "fixed", left: "50%", bottom: 0, transform: "translateX(-50%)", width: 580, maxWidth: "calc(100vw - 48px)", zIndex: 71, background: "var(--overlay)", border: "1px solid var(--line)", borderTop: "3px solid var(--accent)", borderRadius: "6px 6px 0 0", padding: "24px 28px 32px", animation: "slideUp .32s cubic-bezier(.22,.85,.2,1) both" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 5 }}>Batch queue · {sotto.batchQueue.length} queued</div>
                <div style={{ fontSize: 13, color: "var(--mid)" }}>All distributions encrypted and broadcast in a single atomic transaction.</div>
              </div>
              <div onClick={() => setShowBatchPanel(false)} style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--soft)", cursor: "pointer", flexShrink: 0, marginLeft: 20 }}>✕</div>
            </div>
            <div style={{ marginBottom: 14 }}>
              {sotto.batchQueue.map(q => (
                <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 3, marginBottom: 7 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{q.name}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--soft)", marginTop: 2 }}>{q.count} recipients · {q.token}</div>
                  </div>
                  <div onClick={() => sotto.removeFromBatch(q.id)} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--soft)", cursor: "pointer", padding: 4 }}>✕</div>
                </div>
              ))}
            </div>
            <button className="s-btn" style={{ width: "100%", justifyContent: "center" }} onClick={() => { sotto.clearBatch(); setShowBatchPanel(false); toast("Batch queued for execution", { kind: "success" }); }}>
              Encrypt & execute batch →
            </button>
          </div>
        </>
      )}
    </>
  );
}
