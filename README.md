# Sotto — Confidential token distribution

> **Pay everyone. Publish nothing.**

Sotto distributes tokens to any number of recipients in a single confidential
transaction. Every amount is **FHE-encrypted on-chain** — the recipient list is
public, but the allocations are mathematically sealed ciphertext. Only each
recipient can decrypt what's theirs.

Built on [Fully Homomorphic Encryption](https://docs.zama.ai/protocol) from the
**Zama Protocol**, the [**TokenOps SDK**](https://www.npmjs.com/package/@tokenops/sdk),
and the **ERC-7984** confidential-token standard. Runs on **Ethereum Sepolia**
with the official `cUSDT` token.

Submission for the **Zama Developer Program — Mainnet Season 3, Special Bounty
Track × TokenOps**.

**Live:** [cloakdrop.vercel.app](https://cloakdrop.vercel.app)

---

## The problem

Every public-blockchain payment leaks *who got how much*. Payroll, cap-table
distributions, grant payouts, and airdrops all expose sensitive amounts to anyone
with a block explorer. "Private" tools usually just hide the number in the UI while
storing it in plaintext on-chain — a display trick, not real privacy.

Sotto makes the amount itself unreadable. It's encrypted in the sender's browser
before it ever leaves the device, lands on-chain as an `euint64` ciphertext, and
can only be decrypted by the wallet that owns it.

---

## What it does

Two complementary, fully confidential distribution flows:

### 🪂 Airdrop (claim-based)
For large or unknown audiences. The distributor pastes/uploads `address, amount`
rows. Each amount is **FHE-encrypted to its specific recipient** and **EIP-712
signed**, then a confidential airdrop contract is **deployed and funded in one
transaction** via the TokenOps factory. Recipients later connect a wallet,
privately **decrypt** their own allocation in-browser, and **claim** when ready.

### 📦 Disperse (direct push)
For a known list you want to pay immediately. All amounts are encrypted in one
batch and pushed straight into each recipient's confidential balance in a
**single transaction** via the TokenOps disperse singleton — no claim step.

### 🎯 Recipient portal
Connect a wallet → see any waiting allocations → run a local decryption ceremony
(signature → ACL grant → in-browser decrypt) → claim to your confidential balance.

### 📊 Distributor dashboard
Real on-chain stats: distributions, recipients, **live claim rate** (computed from
`isSignatureClaimed` reads), per-distribution claim breakdown, an Etherscan-style
block-explorer view of the real funding tx, expandable per-recipient claim status,
a CSV audit export, and a real **claim webhook**.

---

## How confidentiality works

| Step | What lands on-chain | Who can read it |
| --- | --- | --- |
| Encrypt allocation | `externalEuint64` ciphertext handle + KMS input proof | nobody (it's ciphertext) |
| Sign authorization | EIP-712 `Claim(address recipient,bytes32 encryptedAmount)` | — |
| Claim / disperse | encrypted ERC-7984 transfer | nobody sees the amount |
| Reveal | `getClaimAmount` grants the caller ACL on the handle | **only that recipient**, via `userDecrypt` |

- **Encryption is bound to the recipient.** `encryptUint64` is called with
  `userAddress = recipient`, so the KMS input proof only validates for that
  address — an amount sealed for Alice can't be redirected to Bob.
- **Decryption is local.** `userDecrypt` runs in the recipient's browser against
  their wallet — no server, no third party ever sees the plaintext.
- **Amounts are never written in plaintext, anywhere.** The dashboard's "total
  value sealed" is deliberately shown redacted, because the app genuinely cannot
  read it either.

---

## Tech stack

- **Next.js 15.3** (App Router) · React 19 · TypeScript
- **wagmi v2** · viem · RainbowKit · TanStack Query
- **[`@tokenops/sdk`](https://www.npmjs.com/package/@tokenops/sdk)** — `fhe-airdrop`
  (factory-deployed clones, EIP-712 claim auth) + `fhe-disperse` (singleton, direct push)
- **`@zama-fhe/sdk@3`** + **`@zama-fhe/react-sdk@3`** — browser FHE encrypt + `useUserDecrypt`
- **Upstash Redis** — stores signed claim payloads + webhook config (JSON-file fallback for local dev)
- Custom design system (Instrument Serif / Hanken Grotesk / IBM Plex Mono), light + dark mode, canvas effects, generated OG image

### On-chain addresses (Sepolia)

| Contract | Address |
| --- | --- |
| TokenOps airdrop factory | `0xbE6A3B78B36684fFee48De77d47Bc3393F5Acd4c` |
| TokenOps disperse singleton | `0x710dD9885Cc9986EfD234E7719483147a6d8DBb4` |
| cUSDT wrapper (ERC-7984) | `0x4E7B06D78965594eB5EF5414c357ca21E1554491` |
| cUSDT underlying (mint faucet) | `0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0` |
| FHEVM ACL | `0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D` |

---

## How the flows are wired

**Airdrop** (`src/app/distribute/page.tsx`)
1. `token.setOperator(factory, deadline)` — authorize the factory to pull funds.
2. `factory.createAndFundConfidentialAirdrop({ params, userSalt, amount })` — deploy + fund the clone in one tx.
3. Per recipient: `encryptUint64({ encryptor, contractAddress: airdrop, userAddress: recipient, value })` then `signClaimAuthorization(...)`.
4. `POST /api/campaigns` persists `{ campaign, claims[] }` so recipients can look themselves up.

**Disperse** (same page, disperse method)
1. `token.setOperator(singleton, deadline)`.
2. `client.disperse({ token, mode: "direct", recipients, amounts })` — SDK encrypts the whole batch and pushes in one tx.

**Claim** (`src/app/claim/page.tsx`)
1. `GET /api/claims?recipient=` returns the caller's sealed claims.
2. `getClaimAmount(...)` — write tx that grants the caller ACL and returns the handle.
3. `useUserDecrypt({ handles })` — decrypts locally in-browser.
4. `claim(...)` — pulls the tokens into the recipient's confidential balance.

**Revoke** (dashboard) — `airdropClient.withdraw(admin)` sweeps all *unclaimed* sealed
tokens back to the admin. Real, admin-only, on-chain.

---

## What's real vs illustrative

Everything in the **app** is real and on-chain:

- ✅ Airdrop create + fund, disperse, claim, decrypt, revoke — real transactions
- ✅ Dashboard stats (distributions, recipients, claim rate, per-distribution
  breakdown, expandable recipient claim status) — computed live from
  `isSignatureClaimed` on-chain reads
- ✅ Block-explorer tab — real tx hash, block number, gas, and recipient list
  (fetched via `getTransactionReceipt`)
- ✅ Distributions-per-month chart — real, from campaign timestamps
- ✅ Webhook — stored in Redis, actually fired on claim
- ✅ Audit CSV, QR codes, claim deep-links, duplicate-address summing

The **landing page** hero card (`Distribution #0427`) is an illustrative product
mockup, as is standard for a marketing page. It is clearly a visual demo, not a
functional claim.

---

## Run locally

> Requires **Node ≥ 22** (a constraint of `@zama-fhe/sdk`).

```bash
npm install
cp .env.example .env.local   # optional — add Upstash for a persistent store
npm run dev                  # http://localhost:3000
```

In the app: open **New distribution → Get test cUSDT** to mint + wrap funds, create
an airdrop or disperse, then open **Claim** from another wallet to decrypt & claim.

> The first load of `/distribute` takes ~60–80s — that's the one-time FHE WASM
> compile. Subsequent loads are instant.

### Environment variables

| Var | Purpose | Required |
| --- | --- | --- |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect / RainbowKit | optional (fallback baked in) |
| `UPSTASH_REDIS_REST_URL` | Persistent claim + webhook store | prod only |
| `UPSTASH_REDIS_REST_TOKEN` | " | prod only |

Without the Upstash vars the app uses a local JSON file (`.data/`) — fine for dev,
but it can't write on a read-only host like Vercel, so set them in production.

## Deploy (Vercel)

```bash
npx vercel --prod \
  -e NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<id> \
  -e UPSTASH_REDIS_REST_URL=<url> \
  -e UPSTASH_REDIS_REST_TOKEN=<token>
```

Node 22.x is selected automatically via the `engines` field. Turbopack is disabled
(the standard webpack build handles the FHE WASM worker).

---

## Project structure

```
src/
  app/
    page.tsx                landing
    distribute/page.tsx     4-step wizard: configure → recipients → review → seal
    claim/page.tsx          3-step recipient portal: verify → decrypt → claimed
    dashboard/page.tsx      records · explorer · analytics · settings (all live data)
    docs/page.tsx           in-app documentation
    opengraph-image.tsx     generated OG image
    api/
      campaigns/route.ts    POST campaign · GET by admin · GET one by airdrop
      claims/route.ts       GET claims by recipient
      webhook/route.ts      GET/POST config · PUT fire-on-claim
  components/
    AppShell, StepRail, DistributionDetail, ZKCanvas, CanvasBackground,
    QRCode, Tooltip, Skeleton, Faucet, toast
  lib/
    constants, abi, csv, format, store, types, wagmi
  context/
    SottoContext.tsx        dark mode + drawers + address book + batch queue
```

---

_Sepolia testnet · cUSDT (ERC-7984) · Confidential distribution powered by FHE._
