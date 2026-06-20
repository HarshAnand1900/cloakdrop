import type { Address, Hex } from "viem";

/** A single admin-signed claim authorization, stored server-side and fetched by recipients. */
export interface ClaimRecord {
  /** Recipient wallet address (lowercased for lookups). */
  recipient: Address;
  /** externalEuint64 ciphertext handle the admin signed. */
  handle: Hex;
  /** KMS input proof bound to (airdrop, recipient). */
  inputProof: Hex;
  /** EIP-712 admin signature over Claim(recipient, handle). */
  signature: Hex;
  /** Plaintext amount in raw 6-dec units — kept server-side only for the admin dashboard, never exposed to other recipients. */
  amount: string;
}

/** A deployed airdrop campaign + its claim list. */
export interface Campaign {
  /** Deployed airdrop clone address — the campaign id. */
  airdrop: Address;
  /** Human label, e.g. "Q3 contributor rewards". */
  name: string;
  /** Admin (distributor) address. */
  admin: Address;
  /** ERC-7984 token address. */
  token: Address;
  /** Token symbol for display. */
  symbol: string;
  /** Unix seconds. */
  startTime: number;
  endTime: number;
  /** Deploy tx hash. */
  txHash: Hex;
  /** Number of recipients. */
  recipientCount: number;
  /** Creation timestamp (ms). */
  createdAt: number;
}

/** Public-facing claim payload returned to a recipient (no other recipients' data). */
export interface PublicClaim {
  airdrop: Address;
  name: string;
  symbol: string;
  startTime: number;
  endTime: number;
  recipient: Address;
  handle: Hex;
  inputProof: Hex;
  signature: Hex;
}
