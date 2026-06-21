import { sepolia } from "wagmi/chains";

/** Cloakdrop runs on Sepolia, where the TokenOps factories + singletons are live. */
export const CHAIN = sepolia;
export const CHAIN_ID = sepolia.id; // 11155111

/** Official cUSDTMock ERC-7984 confidential token (6 decimals) for the bounty. */
export const CUSDT = {
  /** Confidential wrapper (ERC-7984) — what the airdrop/disperse moves. */
  wrapper: "0x4E7B06D78965594eB5EF5414c357ca21E1554491" as const,
  /** Underlying ERC-20 mock — has a public mint(address,uint256) faucet (max 1M). */
  underlying: "0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0" as const,
  decimals: 6,
  symbol: "cUSDT",
};

/** TokenOps deployed addresses (also auto-resolved by the SDK from chainId). */
export const TOKENOPS = {
  airdropFactory: "0xbE6A3B78B36684fFee48De77d47Bc3393F5Acd4c" as const,
  disperseSingleton: "0x710dD9885Cc9986EfD234E7719483147a6d8DBb4" as const,
};

/** FHEVM ACL contract on Sepolia (from @zama-fhe/sdk SepoliaConfig). */
export const ACL_ADDRESS =
  "0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D" as const;

export const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
  "cd8e887bc7ebcf255f29c060ba555b15";

export const EXPLORER = "https://sepolia.etherscan.io";

/** Far-future uint48 operator deadline (~year 2106). */
export const OPERATOR_DEADLINE = 4_000_000_000;

export function explorerTx(hash: string) {
  return `${EXPLORER}/tx/${hash}`;
}
export function explorerAddr(addr: string) {
  return `${EXPLORER}/address/${addr}`;
}
