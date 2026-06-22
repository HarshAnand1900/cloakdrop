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
  return `${fmtNum(n)} ${CUSDT.symbol}`;
}

/** Format a number with thousands separators and 2 decimal places. */
export function fmtNum(n: number, decimals = 2): string {
  if (isNaN(n)) return "0.00";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Compact format: 1,200 → "1.2k", 1,500,000 → "1.5M" */
export function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Relative time: "3 min ago", "2 days ago" */
export function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}
