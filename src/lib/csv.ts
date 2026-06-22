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
  /** How many rows were merged because their address appeared more than once. */
  duplicates: number;
}

/**
 * Parse "address,amount" lines (CSV or whitespace separated). Tolerates a
 * header row, blank lines, and either comma/space/tab separators.
 *
 * An address listed more than once is MERGED by summing its amounts — on-chain
 * each recipient can hold only one allocation per airdrop, so the alternative
 * (silently dropping all but the last) would lose funds.
 */
export function parseRecipients(text: string): ParseResult {
  const errors: string[] = [];
  const map = new Map<string, ParsedRow>();
  let duplicates = 0;

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
    const key = checksummed.toLowerCase();
    const existing = map.get(key);
    if (existing) {
      // Sum, rounding to 6 decimals so parseUnits(amount, 6) stays valid.
      const summed = Math.round((Number(existing.amount) + Number(amount)) * 1e6) / 1e6;
      map.set(key, { recipient: checksummed, amount: String(summed) });
      duplicates++;
    } else {
      map.set(key, { recipient: checksummed, amount });
    }
  });

  return { rows: [...map.values()], errors, duplicates };
}
