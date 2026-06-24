# Sotto — Confidential Token Distribution

> Seal payouts as FHE ciphertext. Every recipient decrypts only their own amount.

**Live demo**: https://cloakdrop.vercel.app  
**Network**: Ethereum Sepolia  
**Built for**: Zama Developer Program Mainnet Season 3 · Special Bounty × TokenOps

---

## What it does

Sotto lets you distribute tokens to any number of recipients in a single confidential transaction. Amounts are sealed as `euint64` FHE ciphertext on-chain — no block explorer, no node, no validator can read them. Only the recipient holding the matching private key can decrypt their own allocation.

### Two distribution modes

| Mode | SDK module | How it works |
|------|-----------|--------------|
| **Airdrop** | `@tokenops/sdk/fhe-airdrop` | Deploys a per-campaign clone contract. Recipients claim at their own pace using a ZK membership proof. Admin can revoke unclaimed tokens. |
| **Disperse** | `@tokenops/sdk/fhe-disperse` | Pushes sealed amounts directly to recipient wallets in one tx via the singleton contract. No claim step required. |

---

## TokenOps SDK usage

```ts
// Airdrop
import { createConfidentialAirdropClient } from "@tokenops/sdk/fhe-airdrop";

const client = createConfidentialAirdropClient({ publicClient, walletClient, address: airdropAddress });

await client.createAndFundConfidentialAirdrop({ token, recipients, amounts, startTime, endTime });
await client.claim({ encryptedInput, signature });
await client.isSignatureClaimed(recipient, handle);
await client.getClaimAmount({ encryptedInput, signature }); // generates ACL grant for decrypt
await client.withdraw(adminAddress);                         // revoke unclaimed tokens
```

```ts
// Disperse
import { createConfidentialDisperseClient } from "@tokenops/sdk/fhe-disperse";

const client = createConfidentialDisperseClient({ publicClient, walletClient });
await client.disperse({ token: wrapperAddress, recipients, amounts });
```

---

## Technical stack

| Layer | Technology |
|-------|-----------|
| FHE runtime | Zama Protocol — `tfhe-rs` via `@zama-fhe/sdk` + `@zama-fhe/react-sdk` |
| Encryption type | `euint64` — 64-bit unsigned integer sealed as ciphertext |
| Token standard | ERC-7984 — confidential ERC-20 extension |
| Token | `cUSDT` — official Zama mock USDT on Sepolia |
| ZK proofs | ZKPoK — input proofs that each sealed amount is well-formed without revealing it |
| Client-side decrypt | `useUserDecrypt` + `useConfidentialBalance` from `@zama-fhe/react-sdk` |
| Storage | Upstash Redis — campaign records, disperse index, webhook config |
| Frontend | Next.js 15, wagmi v2, RainbowKit, viem |

---

## How amounts stay private

1. Amounts are encrypted locally with `encryptUint64` before any network call — the plaintext never leaves the browser
2. A ZK input proof (ZKPoK) is generated alongside each ciphertext, proving the value is well-formed without revealing it
3. The sealed `euint64` is submitted in the distribution transaction — on Etherscan it appears as raw ciphertext bytes
4. Only the recipient can decrypt: `useUserDecrypt` requests a wallet signature proving key ownership, then the Zama gateway returns the plaintext entirely client-side

---

## User flows

### Create an airdrop (admin)
1. Connect wallet → **New distribution**
2. Enter a name and paste CSV: `0xAddress, amount` (one per line)
3. Choose **Airdrop**, set claim window open/close dates
4. Review step: pre-distribution balance guard prevents silent zero-transfers (ERC-7984 confidential transfers silently send 0 on insufficient balance — Sotto blocks this before broadcast)
5. Seal step: `setOperator` (once per token, skipped if already set via `isOperator` check) → `createAndFundConfidentialAirdrop`
6. Share the claim link: `cloakdrop.vercel.app/claim?id=<airdropAddress>`

### Create a disperse (admin)
1. Same flow but choose **Disperse**
2. Single tx via disperse singleton — sealed balances land in recipient wallets immediately

### Claim an allocation (recipient)
1. Go to `/claim` → connect wallet → see eligible sealed allocations
2. Select a distribution → **Declassify with my key**
3. `getClaimAmount` issues an ACL grant; `useUserDecrypt` decrypts the ciphertext in-browser — amount revealed with a scramble animation
4. **Claim to wallet** → `claim` tx moves the sealed amount into the recipient's confidential cUSDT balance

### Reveal confidential balance
The balance card on `/claim` uses `useConfidentialBalance` — reads the latest ciphertext handle and decrypts on demand, always reflecting the current on-chain balance after claims and disperses.

---

## Webhook integration

Configure a webhook URL in **Distributions → Settings**. Sotto fires a `POST` after every successful claim:

```json
{
  "event": "claim",
  "distribution": "0xAirdropAddress",
  "recipient": "0xRecipientAddress",
  "token": "cUSDT",
  "amount": "[FHE-sealed]",
  "ts": "2026-06-25T10:00:00.000Z"
}
```

Headers sent: `Content-Type: application/json`, `x-sotto-event: claim`

> `amount` is always `[FHE-sealed]` — Sotto never decodes ciphertext server-side.

---

## Contract addresses (Sepolia)

| Contract | Address |
|----------|---------|
| cUSDT wrapper (ERC-7984) | `0x4E7B06D78965594eB5EF5414c357ca21E1554491` |
| cUSDT underlying (mock ERC-20) | `0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0` |
| Airdrop factory | `0xbE6A3B78B36684fFee48De77d47Bc3393F5Acd4c` |
| Disperse singleton | `0x710dD9885Cc9986EfD234E7719483147a6d8DBb4` |
| Zama Wrappers Registry | `0x2f0750Bbb0A246059d80e94c454586a7F27a128e` |
| FHEVM ACL | `0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D` |

---

## Running locally

```bash
git clone https://github.com/HarshAnand1900/cloakdrop
cd cloakdrop
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
```

```bash
npm run dev   # http://localhost:3000
```

Requires Node ≥ 22.

---

## Testing end-to-end

1. **Get Sepolia ETH** from [sepoliafaucet.com](https://sepoliafaucet.com)
2. **Get test cUSDT**: click **Get 100,000 test cUSDT** on any distribution page — mints underlying ERC-20 and wraps to confidential cUSDT in one flow
3. **Test a disperse**: New distribution → paste 2–3 addresses → Disperse → Seal → check each recipient's `/claim` page
4. **Test an airdrop**: New distribution → Airdrop → Seal → open the claim link in a second wallet → Declassify → Claim
5. **Verify privacy**: open the deployment tx on [Sepolia Etherscan](https://sepolia.etherscan.io) — all `amount` fields appear as hex ciphertext, never plaintext

---

## API routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/campaigns` | `GET` | List campaigns by `?admin=0x…` or single by `?airdrop=0x…` |
| `/api/campaigns` | `POST` | Save a new campaign record |
| `/api/claims` | `GET` | Eligible claims for `?recipient=0x…` |
| `/api/claims` | `POST` | Register a claim signature for a recipient |
| `/api/disperse` | `GET` | Disperse records by `?admin=0x…` or `?recipient=0x…` |
| `/api/disperse` | `POST` | Save a disperse record |
| `/api/webhook` | `GET` / `POST` | Get or set webhook config for an admin address |
| `/api/webhook` | `PUT` | Fire the webhook for a claim event |

---

## Project structure

```
src/
  app/
    distribute/       # 5-step distribution wizard
    claim/            # Recipient claim page with FHE decrypt and on-chain claim
    dashboard/        # Admin records, analytics, block explorer, webhook settings
    docs/             # In-app documentation
    api/              # Next.js route handlers
  components/
    ZKCanvas.tsx      # Animated FHE seal visualization (HTML canvas)
    claim/
      BalanceCard.tsx # Live confidential cUSDT balance with one-click reveal
    Faucet.tsx        # Test cUSDT mint + wrap helper
    AppShell.tsx      # Top nav: wallet connect, network guard, dark mode toggle
  lib/
    constants.ts      # Sepolia contract addresses and chain config
    abi.ts            # Minimal ABIs for on-chain reads
    format.ts         # Token formatting, time helpers
    types.ts          # Shared TypeScript interfaces
  context/
    SottoContext.tsx  # Dark mode + batch distribution state
```

---

## Gas notes

- `setOperator` is sent once per (token, spender) pair — subsequent distributions skip it via an on-chain `isOperator` read, saving ~100k gas per run
- Airdrop creation deploys a factory clone (~300–500k gas) — one-time cost per campaign
- Disperse gas scales linearly with recipient count — each confidential transfer runs through the FHEVM coprocessor
- A pre-distribution balance guard checks confidential balance before sealing, preventing the ERC-7984 silent zero-transfer failure mode

---

Built for **Zama Developer Program Mainnet Season 3** · Special Bounty × TokenOps · Prize: 2,500 cUSDT
