import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import type { Address, Hex } from "viem";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DisperseRecord {
  txHash: Hex;
  name: string;
  admin: Address;
  token: Address;
  symbol: string;
  recipients: Address[];
  createdAt: number;
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/** GET /api/disperse?recipient=0x... → all disperses that include this recipient */
export async function GET(req: NextRequest) {
  const recipient = req.nextUrl.searchParams.get("recipient");
  if (!recipient || !isAddress(recipient)) {
    return NextResponse.json({ error: "valid ?recipient required" }, { status: 400 });
  }
  const redis = getRedis();
  if (!redis) return NextResponse.json({ disperses: [] });

  const key = `disperse-recip:${recipient.toLowerCase()}`;
  const txHashes = await redis.smembers(key) as string[];
  const disperses: DisperseRecord[] = [];
  for (const h of txHashes) {
    const d = await redis.get<DisperseRecord>(`disperse-tx:${h.toLowerCase()}`);
    if (d) disperses.push(d);
  }
  disperses.sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json({ disperses });
}

/** POST /api/disperse → save a completed disperse record */
export async function POST(req: NextRequest) {
  let body: DisperseRecord;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body?.txHash || !isAddress(body?.admin) || !Array.isArray(body?.recipients)) {
    return NextResponse.json({ error: "txHash, admin, recipients required" }, { status: 400 });
  }
  const redis = getRedis();
  if (!redis) return NextResponse.json({ ok: false, error: "no storage backend" }, { status: 503 });

  const txKey = `disperse-tx:${body.txHash.toLowerCase()}`;
  await redis.set(txKey, body);
  for (const r of body.recipients) {
    await redis.sadd(`disperse-recip:${r.toLowerCase()}`, body.txHash.toLowerCase());
  }
  return NextResponse.json({ ok: true });
}
