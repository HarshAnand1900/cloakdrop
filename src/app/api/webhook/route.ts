import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/** GET /api/webhook?admin=0x... → { url, enabled } */
export async function GET(req: NextRequest) {
  const admin = req.nextUrl.searchParams.get("admin");
  if (!admin || !isAddress(admin)) {
    return NextResponse.json({ error: "valid ?admin required" }, { status: 400 });
  }
  const redis = getRedis();
  if (!redis) return NextResponse.json({ url: "", enabled: false });
  const stored = await redis.get<{ url: string; enabled: boolean }>(`webhook:${admin.toLowerCase()}`);
  return NextResponse.json(stored ?? { url: "", enabled: false });
}

/** POST /api/webhook → save { admin, url, enabled } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.admin || !isAddress(body.admin)) {
    return NextResponse.json({ error: "admin required" }, { status: 400 });
  }
  const redis = getRedis();
  if (!redis) return NextResponse.json({ ok: false, error: "no storage backend" }, { status: 503 });
  await redis.set(`webhook:${body.admin.toLowerCase()}`, { url: body.url ?? "", enabled: !!body.enabled });
  return NextResponse.json({ ok: true });
}

/** POST /api/webhook/fire → fire webhook for a claim event */
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.admin || !body?.recipient) {
    return NextResponse.json({ error: "admin + recipient required" }, { status: 400 });
  }
  const redis = getRedis();
  if (!redis) return NextResponse.json({ fired: false });

  const wh = await redis.get<{ url: string; enabled: boolean }>(`webhook:${body.admin.toLowerCase()}`);
  if (!wh?.url || !wh.enabled) return NextResponse.json({ fired: false, reason: "not configured" });

  const payload = {
    event: "claim",
    distribution: body.distribution ?? null,
    recipient: body.recipient,
    token: body.token ?? "cUSDT",
    amount: "[FHE-sealed]",
    ts: new Date().toISOString(),
  };

  try {
    const res = await fetch(wh.url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-sotto-event": "claim" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    return NextResponse.json({ fired: true, status: res.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ fired: false, error: msg });
  }
}
