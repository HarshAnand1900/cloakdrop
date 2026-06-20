import { getAddress, isAddress } from "viem";
import type { Address } from "viem";

export interface ParsedRow {
  recipient: Address;
  /** Human-readable amount, e.g. "12.5". */
  amount: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: string[];
}

/**
 * Parse "address,amount" lines (CSV or whitespace separated). Tolerates a
 * header row, blank lines, and either comma/space/tab separators.
 * Deduplicates by address (last wins) — the contract keys claims per recipient.
 */
export function parseRecipients(text: string): ParseResult {
  const errors: string[] = [];
  const map = new Map<string, ParsedRow>();

  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    const raw = line.trim();
    if (!raw) return;
    const parts = raw.split(/[,\s\t]+/).filter(Boolean);
    if (parts.length < 2) {
      // Skip an obvious header line silently; flag others.
      if (i === 0 && /address|recipient|wallet/i.test(raw)) return;
      errors.push(`Line ${i + 1}: expected "address, amount"`);
      return;
    }
    const [addrPart, amountPart] = parts;
    if (!isAddress(addrPart)) {
      if (i === 0) return; // header
      errors.push(`Line ${i + 1}: invalid address "${addrPart}"`);
      return;
    }
    const amount = amountPart.replace(/[, ]/g, "");
    if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) {
      errors.push(`Line ${i + 1}: invalid amount "${amountPart}"`);
      return;
    }
    const checksummed = getAddress(addrPart);
    map.set(checksummed.toLowerCase(), { recipient: checksummed, amount });
  });

  return { rows: [...map.values()], errors };
}
