import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { Redis } from "@upstash/redis";
import type { VestingRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/** GET /api/vestings?recipient=0x...  → vesting schedules for a recipient
 *  GET /api/vestings?admin=0x...      → all vestings created by this admin */
export async function GET(req: NextRequest) {
  const recipient = req.nextUrl.searchParams.get("recipient");
  const admin = req.nextUrl.searchParams.get("admin");
  const who = recipient || admin;
  if (!who || !isAddress(who)) {
    return NextResponse.json({ error: "valid ?recipient or ?admin required" }, { status: 400 });
  }
  const redis = getRedis();
  if (!redis) return NextResponse.json({ vestings: [] });

  const key = admin
    ? `vesting-admin:${admin.toLowerCase()}`
    : `vesting-recip:${who.toLowerCase()}`;
  const ids = (await redis.smembers(key)) as string[];
  const vestings: VestingRecord[] = [];
  for (const id of ids) {
    const v = await redis.get<VestingRecord>(`vesting:${id}`);
    if (v) vestings.push(v);
  }
  vestings.sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json({ vestings });
}

/** POST /api/vestings → save vesting records after batchCreateVesting */
export async function POST(req: NextRequest) {
  let body: { vestings: VestingRecord[] };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body?.vestings) || body.vestings.length === 0) {
    return NextResponse.json({ error: "vestings array required" }, { status: 400 });
  }
  const redis = getRedis();
  if (!redis) return NextResponse.json({ ok: false, error: "no storage backend" }, { status: 503 });

  for (const v of body.vestings) {
    if (!v.vestingId || !isAddress(v.recipient) || !isAddress(v.admin)) continue;
    const key = `vesting:${v.vestingId.toLowerCase()}`;
    await redis.set(key, v);
    await redis.sadd(`vesting-recip:${v.recipient.toLowerCase()}`, v.vestingId.toLowerCase());
    await redis.sadd(`vesting-admin:${v.admin.toLowerCase()}`, v.vestingId.toLowerCase());
  }
  return NextResponse.json({ ok: true });
}
