import { formatUnits, parseUnits } from "viem";
import { CUSDT } from "./constants";

export function shortAddr(addr?: string, size = 4) {
  if (!addr) return "";
  return `${addr.slice(0, 2 + size)}…${addr.slice(-size)}`;
}

/** Human string ("12.5") → raw 6-dec bigint. */
export function toRaw(amount: string): bigint {
  return parseUnits(amount.trim(), CUSDT.decimals);
}

/** Raw 6-dec bigint → human string. */
export function fromRaw(raw: bigint): string {
  return formatUnits(raw, CUSDT.decimals);
}

/** Pretty-print a raw amount with the token symbol. */
export function fmtToken(raw: bigint): string {
  const n = Number(fromRaw(raw));
  const s = n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${s} ${CUSDT.symbol}`;
}
