import { parseAbi } from "viem";

/** Underlying ERC-20 mock — public mint() faucet. */
export const underlyingAbi = parseAbi([
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

/** ERC-7984 confidential wrapper — wrap underlying into confidential balance. */
export const wrapperAbi = parseAbi([
  "function wrap(address to, uint256 amount) returns (bytes32)",
  "function confidentialBalanceOf(address account) view returns (bytes32)",
  "event ConfidentialTransfer(address indexed from, address indexed to, bytes32 amount)",
]);
