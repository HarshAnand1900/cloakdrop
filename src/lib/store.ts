import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { Address } from "viem";
import type { Campaign, ClaimRecord, PublicClaim } from "./types";

/* ─────────────────────────────────────────────────────────────────────────
 * Minimal KV abstraction. Two backends:
 *   - Upstash Redis  (set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN) → prod
 *   - JSON file       (.data/cloakdrop-store.json)                            → local dev
 * ──────────────────────────────────────────────────────────────────────── */

interface Kv {
  getJSON<T>(key: string): Promise<T | null>;
  setJSON<T>(key: string, value: T): Promise<void>;
  sadd(key: string, member: string): Promise<void>;
  smembers(key: string): Promise<string[]>;
}

/* ── Upstash Redis backend ── */
function upstashKv(): Kv | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  // Lazy require so local dev without the env vars doesn't construct a client.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
  const redis = new Redis({ url, token });

  return {
    async getJSON<T>(key: string) {
      return (await redis.get<T>(key)) ?? null;
    },
    async setJSON<T>(key: string, value: T) {
      await redis.set(key, value);
    },
    async sadd(key: string, member: string) {
      await redis.sadd(key, member);
    },
    async smembers(key: string) {
      return (await redis.smembers(key)) as string[];
    },
  };
}

/* ── JSON file backend (local dev) ── */
function fileKv(): Kv {
  const file = path.join(process.cwd(), ".data", "cloakdrop-store.json");
  type Doc = { kv: Record<string, unknown>; sets: Record<string, string[]> };

  async function read(): Promise<Doc> {
    try {
      const raw = await fs.readFile(file, "utf8");
      return JSON.parse(raw) as Doc;
    } catch {
      return { kv: {}, sets: {} };
    }
  }
  async function write(doc: Doc) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(doc, null, 2), "utf8");
  }

  return {
    async getJSON<T>(key: string) {
      const doc = await read();
      return (doc.kv[key] as T) ?? null;
    },
    async setJSON<T>(key: string, value: T) {
      const doc = await read();
      doc.kv[key] = value;
      await write(doc);
    },
    async sadd(key: string, member: string) {
      const doc = await read();
      const set = new Set(doc.sets[key] ?? []);
      set.add(member);
      doc.sets[key] = [...set];
      await write(doc);
    },
    async smembers(key: string) {
      const doc = await read();
      return doc.sets[key] ?? [];
    },
  };
}

const kv: Kv = upstashKv() ?? fileKv();

export const STORE_BACKEND = upstashKv() ? "upstash" : "file";

/* ─────────────────────────────────────────────────────────────────────────
 * Domain helpers
 * ──────────────────────────────────────────────────────────────────────── */

const k = {
  campaign: (airdrop: string) => `campaign:${airdrop.toLowerCase()}`,
  claims: (airdrop: string) => `claims:${airdrop.toLowerCase()}`,
  byAdmin: (admin: string) => `admin:${admin.toLowerCase()}`,
  byRecipient: (recipient: string) => `recipient:${recipient.toLowerCase()}`,
};

export async function saveCampaign(
  campaign: Campaign,
  claims: ClaimRecord[],
): Promise<void> {
  const airdrop = campaign.airdrop.toLowerCase();
  await kv.setJSON(k.campaign(airdrop), campaign);
  await kv.setJSON(k.claims(airdrop), claims);
  await kv.sadd(k.byAdmin(campaign.admin), airdrop);
  for (const c of claims) {
    await kv.sadd(k.byRecipient(c.recipient), airdrop);
  }
}

export async function getCampaign(airdrop: string): Promise<Campaign | null> {
  return kv.getJSON<Campaign>(k.campaign(airdrop));
}

export async function getClaimsForCampaign(
  airdrop: string,
): Promise<ClaimRecord[]> {
  return (await kv.getJSON<ClaimRecord[]>(k.claims(airdrop))) ?? [];
}

export async function listCampaignsByAdmin(
  admin: string,
): Promise<Campaign[]> {
  const ids = await kv.smembers(k.byAdmin(admin));
  const out: Campaign[] = [];
  for (const id of ids) {
    const c = await getCampaign(id);
    if (c) out.push(c);
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

/** Every claim a recipient holds across all campaigns — used by the recipient portal. */
export async function getClaimsForRecipient(
  recipient: Address,
): Promise<PublicClaim[]> {
  const ids = await kv.smembers(k.byRecipient(recipient));
  const out: PublicClaim[] = [];
  for (const id of ids) {
    const campaign = await getCampaign(id);
    if (!campaign) continue;
    const claims = await getClaimsForCampaign(id);
    const mine = claims.find(
      (c) => c.recipient.toLowerCase() === recipient.toLowerCase(),
    );
    if (!mine) continue;
    out.push({
      airdrop: campaign.airdrop,
      name: campaign.name,
      symbol: campaign.symbol,
      startTime: campaign.startTime,
      endTime: campaign.endTime,
      recipient: mine.recipient,
      handle: mine.handle,
      inputProof: mine.inputProof,
      signature: mine.signature,
    });
  }
  return out;
}
