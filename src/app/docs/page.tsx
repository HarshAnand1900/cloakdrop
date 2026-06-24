"use client";

import { useRouter } from "next/navigation";
import { useSotto } from "@/context/SottoContext";
import { CUSDT, TOKENOPS, ACL_ADDRESS, WRAPPERS_REGISTRY, explorerAddr } from "@/lib/constants";

function H({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 32, color: "var(--ink)", margin: "0 0 14px", letterSpacing: "-.015em" }}>{children}</h2>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="s-label" style={{ marginBottom: 12 }}>{children}</div>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 15, color: "var(--mid)", lineHeight: 1.7, margin: "0 0 14px" }}>{children}</p>;
}
function Mono({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--ink)", background: "var(--card)", padding: "1px 6px", borderRadius: 3 }}>{children}</span>;
}

export default function DocsPage() {
  const router = useRouter();
  const sotto = useSotto();

  const sections = [
    { id: "overview", label: "Overview" },
    { id: "flows", label: "The two flows" },
    { id: "privacy", label: "How privacy works" },
    { id: "claiming", label: "Claiming" },
    { id: "webhooks", label: "Webhooks" },
    { id: "stack", label: "Stack & addresses" },
    { id: "faq", label: "FAQ" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--page-bg)", transition: "background .4s, color .35s" }}>
      {/* Minimal header */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 52px", maxWidth: 1100, margin: "0 auto", borderBottom: "1px solid var(--line)" }}>
        <div onClick={() => router.push("/")} style={{ display: "flex", alignItems: "center", gap: 11, cursor: "pointer" }}>
          <div style={{ width: 20, height: 20, background: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 8, height: 2, background: "var(--page-bg)" }} />
          </div>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 24, color: "var(--ink)" }}>Sotto</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--soft)", marginLeft: 6, letterSpacing: ".1em" }}>DOCS</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <span onClick={sotto.toggleMode} style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--soft)", cursor: "pointer", letterSpacing: ".08em" }}>{sotto.modeLabel}</span>
          <div onClick={() => router.push("/distribute")} style={{ background: "var(--ink)", color: "var(--page-bg)", padding: "9px 18px", borderRadius: 2, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Open app →</div>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 52px", display: "grid", gridTemplateColumns: "200px 1fr", gap: 56 }} className="airdrop-grid">
        {/* Sidebar */}
        <aside style={{ paddingTop: 48 }}>
          <div style={{ position: "sticky", top: 48 }}>
            {sections.map(s => (
              <a key={s.id} href={`#${s.id}`} style={{ display: "block", fontSize: 13.5, color: "var(--mid)", textDecoration: "none", padding: "7px 0", borderLeft: "2px solid transparent", paddingLeft: 12, transition: "color .2s" }}>
                {s.label}
              </a>
            ))}
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
              <a href="https://docs.zama.ai/protocol" target="_blank" rel="noreferrer" style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", textDecoration: "none", padding: "5px 0 5px 12px" }}>Zama Protocol ↗</a>
              <a href="https://www.npmjs.com/package/@tokenops/sdk" target="_blank" rel="noreferrer" style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", textDecoration: "none", padding: "5px 0 5px 12px" }}>TokenOps SDK ↗</a>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main style={{ paddingTop: 48, paddingBottom: 100, maxWidth: 680 }}>
          <section id="overview" style={{ marginBottom: 56, scrollMarginTop: 24 }}>
            <Label>Overview</Label>
            <H>Pay everyone. Publish nothing.</H>
            <P>Sotto distributes tokens to any number of recipients in a single confidential transaction. The recipient list is public on-chain — but every amount is <strong style={{ color: "var(--ink)" }}>Fully Homomorphic Encryption (FHE)</strong> ciphertext. Only each recipient can decrypt what&apos;s theirs.</P>
            <P>It runs on Ethereum Sepolia using the official <Mono>cUSDT</Mono> ERC-7984 confidential token, the Zama Protocol&apos;s FHE library, and the TokenOps SDK. No custom contracts — Sotto orchestrates audited, factory-deployed TokenOps contracts.</P>
            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 4, padding: "16px 18px", marginTop: 8 }}>
              <div style={{ fontSize: 13.5, color: "var(--mid)", lineHeight: 1.6 }}>
                <strong style={{ color: "var(--ink)" }}>Why it matters:</strong> public-chain payments leak who got how much. Payroll, cap tables, grants, and airdrops all expose sensitive amounts. Most &quot;private&quot; tools just hide the number in the UI. Sotto makes the amount itself mathematically unreadable.
              </div>
            </div>
          </section>

          <section id="flows" style={{ marginBottom: 56, scrollMarginTop: 24 }}>
            <Label>The two flows</Label>
            <H>Airdrop vs Disperse</H>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 4, padding: "18px 20px" }}>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 21, color: "var(--ink)", marginBottom: 4 }}>🪂 Airdrop — claim-based</div>
                <P>For large or unknown audiences. Each amount is FHE-encrypted to its recipient and EIP-712 signed, then a confidential airdrop contract is deployed and funded in one transaction. Recipients pull their allocation whenever they&apos;re ready, within the claim window.</P>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--soft)" }}>Best for: community airdrops, large lists, optional claims.</div>
              </div>
              <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 4, padding: "18px 20px" }}>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 21, color: "var(--ink)", marginBottom: 4 }}>📦 Disperse — direct push</div>
                <P>For a known list you want to pay immediately. All amounts are encrypted in one batch and pushed straight into each recipient&apos;s confidential balance in a single transaction — no claim step needed.</P>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--soft)" }}>Best for: payroll, investor distributions, instant payouts.</div>
              </div>
            </div>
          </section>

          <section id="privacy" style={{ marginBottom: 56, scrollMarginTop: 24 }}>
            <Label>How privacy works</Label>
            <H>Not a display trick — mathematical privacy</H>
            <P>Every allocation goes through four stages. At no point is the amount ever written in plaintext, anywhere.</P>
            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 4, overflow: "hidden" }}>
              {[
                ["1 · Encrypt", "Amount becomes an euint64 ciphertext + KMS input proof, bound to the recipient's address. Done in your browser."],
                ["2 · Sign", "An EIP-712 Claim authorization is signed by the distributor."],
                ["3 · Seal on-chain", "The encrypted ERC-7984 transfer lands on-chain. Observers see a ciphertext handle, never a number."],
                ["4 · Reveal", "The recipient's getClaimAmount grants them ACL on the handle, then userDecrypt decrypts locally — only they can read it."],
              ].map(([step, desc], i, arr) => (
                <div key={step} style={{ padding: "14px 18px", borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)", marginBottom: 4, letterSpacing: ".05em" }}>{step}</div>
                  <div style={{ fontSize: 13.5, color: "var(--mid)", lineHeight: 1.55 }}>{desc}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, fontSize: 13.5, color: "var(--mid)", lineHeight: 1.6 }}>
              Encryption is bound to the recipient: <Mono>encryptUint64</Mono> uses <Mono>userAddress = recipient</Mono>, so the proof only validates for that address. An amount sealed for one recipient can never be redirected to another.
            </div>
          </section>

          <section id="claiming" style={{ marginBottom: 56, scrollMarginTop: 24 }}>
            <Label>Claiming</Label>
            <H>How a recipient claims</H>
            <P>Recipients open the Claim page (or a shared deep-link / QR), connect their wallet, and Sotto checks eligibility. The decryption ceremony runs in three local steps:</P>
            <ol style={{ fontSize: 14.5, color: "var(--mid)", lineHeight: 1.8, paddingLeft: 20, margin: "0 0 14px" }}>
              <li><strong style={{ color: "var(--ink)" }}>Prove your key</strong> — your wallet signs to prove you&apos;re the rightful recipient.</li>
              <li><strong style={{ color: "var(--ink)" }}>Grant + decrypt</strong> — an ACL-grant tx unlocks the handle, then it&apos;s decrypted in your browser. No server sees the number.</li>
              <li><strong style={{ color: "var(--ink)" }}>Claim to wallet</strong> — a single tx moves the sealed amount into your confidential balance.</li>
            </ol>
            <P>Distributors can share a per-distribution link (<Mono>/claim?id=0x…</Mono>) or QR code that lands the recipient directly on their allocation.</P>
          </section>

          <section id="webhooks" style={{ marginBottom: 56, scrollMarginTop: 24 }}>
            <Label>Webhooks</Label>
            <H>Get notified when someone claims</H>
            <P>Sotto can POST a JSON payload to any HTTPS endpoint you control whenever a recipient claims an allocation. This lets you update your own records, trigger downstream workflows, or fire off a notification — without polling the chain.</P>

            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 4, padding: "16px 18px", marginBottom: 18 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 10 }}>How to enable</div>
              <ol style={{ fontSize: 14, color: "var(--mid)", lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
                <li>Go to <strong style={{ color: "var(--ink)" }}>Dashboard → Settings tab</strong></li>
                <li>Paste your endpoint URL (must start with <Mono>https://</Mono>)</li>
                <li>Click <strong style={{ color: "var(--ink)" }}>Save endpoint</strong> — toggle enabled</li>
              </ol>
            </div>

            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 4, overflow: "hidden", marginBottom: 18 }}>
              <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)" }}>Webhook payload — POST application/json</div>
              </div>
              <pre style={{ margin: 0, padding: "16px 18px", fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--ink)", lineHeight: 1.7, overflowX: "auto", background: "var(--overlay)" }}>
{`{
  "event": "claim",
  "admin": "0x…",          // distributor address
  "distribution": "0x…",   // airdrop contract address
  "recipient": "0x…",       // who claimed
  "token": "cUSDT",
  "ts": 1719100800          // Unix timestamp of the claim
}`}
              </pre>
            </div>

            <P>The endpoint receives only the on-chain identifiers — never the decrypted amount, since that number only ever exists inside the recipient&apos;s browser. Sotto fires the webhook on a best-effort basis; implement idempotency (deduplicate on <Mono>distribution + recipient</Mono>) in your handler.</P>

            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 4, overflow: "hidden", marginBottom: 18 }}>
              <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)" }}>Example handler — Node.js / Express</div>
              </div>
              <pre style={{ margin: 0, padding: "16px 18px", fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--ink)", lineHeight: 1.7, overflowX: "auto", background: "var(--overlay)" }}>
{`app.post('/sotto-webhook', express.json(), (req, res) => {
  const { event, distribution, recipient, ts } = req.body;
  if (event !== 'claim') return res.sendStatus(200);

  console.log(\`\${recipient} claimed from \${distribution}\`);
  // update your database, send a notification, etc.

  res.sendStatus(200); // must respond with 2xx
});`}
              </pre>
            </div>

            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 4, padding: "14px 18px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 8 }}>API endpoint reference</div>
              {[
                ["GET /api/campaigns", "Returns all distributions created by the connected address."],
                ["GET /api/campaigns?airdrop=0x…", "Returns a single distribution by contract address."],
                ["GET /api/claims?recipient=0x…", "Returns all claim records for an address (used by recipients)."],
                ["GET /api/disperse?recipient=0x…", "Returns all direct-disperse records for a recipient address."],
                ["PUT /api/webhook", "Fires the stored webhook for the given admin. Called internally on claim."],
                ["GET /api/webhook?admin=0x…", "Returns the stored webhook config for an admin address."],
              ].map(([route, desc], i, arr) => (
                <div key={route} style={{ display: "flex", gap: 14, padding: "9px 0", borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none", flexWrap: "wrap" }}>
                  <Mono>{route}</Mono>
                  <span style={{ fontSize: 13, color: "var(--mid)", lineHeight: 1.5 }}>{desc}</span>
                </div>
              ))}
            </div>
          </section>

          <section id="stack" style={{ marginBottom: 56, scrollMarginTop: 24 }}>
            <Label>Stack & addresses</Label>
            <H>Built on</H>
            <P>Next.js · wagmi · viem · RainbowKit · <Mono>@tokenops/sdk</Mono> (fhe-airdrop + fhe-disperse) · <Mono>@zama-fhe/sdk</Mono> + <Mono>@zama-fhe/react-sdk</Mono> · Upstash Redis.</P>
            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 4, padding: "6px 18px", marginTop: 8 }}>
              {[
                ["cUSDT wrapper (official Zama Sepolia)", CUSDT.wrapper],
                ["cUSDT underlying ERC-20", CUSDT.underlying],
                ["Wrappers Registry (Zama)", WRAPPERS_REGISTRY],
                ["Airdrop factory", TOKENOPS.airdropFactory],
                ["Disperse singleton", TOKENOPS.disperseSingleton],
                ["FHEVM ACL", ACL_ADDRESS],
              ].map(([label, addr], i, arr) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none", gap: 12 }}>
                  <span style={{ fontSize: 13, color: "var(--mid)" }}>{label}</span>
                  <a href={explorerAddr(addr)} target="_blank" rel="noreferrer" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)", textDecoration: "none" }}>{addr.slice(0, 8)}…{addr.slice(-6)} ↗</a>
                </div>
              ))}
            </div>
          </section>

          <section id="faq" style={{ scrollMarginTop: 24 }}>
            <Label>FAQ</Label>
            <H>Common questions</H>
            {[
              ["Can the distributor see the amounts after sealing?", "No. Once sealed, the amount is ciphertext on-chain. Not even the distributor — or Sotto — can read it. Only the recipient's key decrypts it."],
              ["What if I list the same address twice?", "The amounts are summed into one allocation (on-chain, each recipient holds a single sealed amount per airdrop). Sotto shows a merge notice."],
              ["Is the claim window enforced?", "Yes — set a time lock and claims are blocked on-chain until that date. The window is a real contract parameter."],
              ["What happens to unclaimed funds?", "The distributor can Revoke a distribution, which calls withdraw() on-chain to sweep all unclaimed sealed tokens back to their wallet. Already-claimed recipients are unaffected."],
              ["Is this mainnet?", "It runs on Ethereum Sepolia with the official cUSDT (ERC-7984) test token, per the bounty spec."],
            ].map(([q, a]) => (
              <div key={q} style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 5 }}>{q}</div>
                <div style={{ fontSize: 14, color: "var(--mid)", lineHeight: 1.6 }}>{a}</div>
              </div>
            ))}
          </section>

          <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid var(--line)", display: "flex", gap: 12 }}>
            <div onClick={() => router.push("/distribute")} style={{ background: "var(--accent)", color: "#F6F1E6", padding: "13px 24px", borderRadius: 3, fontSize: 14.5, fontWeight: 700, cursor: "pointer" }}>Create a distribution →</div>
            <div onClick={() => router.push("/claim")} style={{ border: "1.5px solid var(--line)", color: "var(--ink)", padding: "13px 22px", borderRadius: 3, fontSize: 14.5, fontWeight: 500, cursor: "pointer" }}>Claim an allocation</div>
          </div>
        </main>
      </div>
    </div>
  );
}
