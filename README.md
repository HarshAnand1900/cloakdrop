# Cloakdrop — Confidential token distribution

**Distribute tokens to many recipients with every amount encrypted on-chain.** The
recipient list and all allocations stay private — only each recipient can decrypt
their own amount. Built on [Fully Homomorphic Encryption](https://www.zama.org)
and the [TokenOps SDK](https://www.npmjs.com/package/@tokenops/sdk) over the
ERC-7984 confidential token standard.

Submission for the **Zama Developer Program — Mainnet Season 3, Special Bounty
Track × TokenOps**. Runs on **Sepolia** with the official `cUSDT` (ERC-7984) token.

---

## What it does

Public-blockchain distributions leak who got how much. Cloakdrop fixes that with
two complementary, fully confidential flows:

### 🪂 Airdrop (claim-based)
For large or unknown audiences. The distributor uploads a CSV of
`address, amount` rows. Each amount is **FHE-encrypted to its recipient** and
**EIP-712 signed**, then a confidential airdrop is **deployed and funded in one
transaction** via the TokenOps factory. Recipients connect their wallet, privately
**reveal** their own allocation, and **claim** — pulling tokens when they're ready.
The recipient list never goes public.

### 📦 Disperse (direct push)
For a known list you want to pay immediately. Encrypted amounts are transferred
straight into each recipient's confidential balance in a **single transaction**
via the TokenOps disperse singleton.

### 🎯 Recipient portal
Connect a wallet to instantly see any waiting allocations, **decrypt your own
amount** (visible only to you — never to other recipients or on an explorer), claim,
and reveal your confidential `cUSDT` balance.

---

## How confidentiality works

| Step | What's on-chain | Who can read it |
| --- | --- | --- |
| Encrypt allocation | `externalEuint64` ciphertext handle + KMS proof | nobody (it's a ciphertext) |
| Sign authorization | EIP-712 `Claim(address recipient, bytes32 encryptedAmount)` | — |
| Claim / disperse | encrypted ERC-7984 transfer | nobody sees the amount |
| Reveal | `FHE.allow(handle, msg.sender)` grants ACL | **only the recipient**, via `userDecrypt` |

Amounts are never written in plaintext. Revealing requires a wallet signature and
decrypts **locally** for that recipient alone.

---

## Tech stack

- **Next.js 15.3** (App Router) · TypeScript · Tailwind 4
- **wagmi v2** · viem · RainbowKit · TanStack Query
- **[`@tokenops/sdk`](https://www.npmjs.com/package/@tokenops/sdk)** — `fhe-airdrop` + `fhe-disperse` (audited, factory-deployed contracts)
- **`@zama-fhe/sdk@3`** + **`@zama-fhe/react-sdk@3`** — FHE encrypt / `userDecrypt`
- Claim store: **Upstash Redis** (prod) with a JSON-file fallback (local dev)

### On-chain addresses (Sepolia)

| Contract | Address |
| --- | --- |
| TokenOps airdrop factory | `0xbE6A3B78B36684fFee48De77d47Bc3393F5Acd4c` |
| TokenOps disperse singleton | `0x710dD9885Cc9986EfD234E7719483147a6d8DBb4` |
| cUSDT wrapper (ERC-7984) | `0x4E7B06D78965594eB5EF5414c357ca21E1554491` |
| cUSDT underlying (mint faucet) | `0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0` |

---

## Run locally

> Requires **Node ≥ 22** (a constraint of `@zama-fhe/sdk`).

```bash
npm install
cp .env.example .env.local   # optional — fill in Upstash for a persistent store
npm run dev                  # http://localhost:3000
```

In the app: open **Distribute**, click **Get test cUSDT** to mint + wrap funds, then
create an airdrop or disperse. Open **Claim** from another wallet to reveal & claim.

## Deploy (Vercel)

1. Push the repo to GitHub and import it into Vercel.
2. Set **Node.js 22.x** in Project Settings → General.
3. Add env vars: `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, and
   `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` for a persistent claim
   store (free at [Upstash](https://console.upstash.com/redis)).
4. Deploy. Turbopack is disabled; the standard build is used.

---

## Project structure

```
src/
  app/
    page.tsx              landing
    distribute/page.tsx   distributor console (airdrop + disperse tabs)
    claim/page.tsx        recipient portal
    api/campaigns         POST campaign + GET by admin
    api/claims            GET claims by recipient
    providers.tsx         wagmi + RainbowKit + react-query + Zama FHE provider
  components/
    distribute/           AirdropForm, DisperseForm, RecipientPreview
    claim/                ClaimPortal, ClaimCard, BalanceCard
    Faucet, Nav, ConnectGate, toast, Logo
  lib/
    constants, abi, csv, format, store, types, wagmi
```

---

_Sepolia testnet · cUSDT (ERC-7984) · Confidential distribution powered by FHE._
