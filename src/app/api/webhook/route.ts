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

/** Blocks SSRF: only public http(s) hosts may be used as a webhook target. */
function isSafeWebhookUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host === "0.0.0.0" || host === "::1" || host.endsWith(".local")) return false;
  // Block loopback, link-local, and RFC1918 private ranges.
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map(Number);
    if (a === 127 || a === 10 || a === 0) return false;
    if (a === 169 && b === 254) return false; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
  }
  return true;
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
  if (body.url && !isSafeWebhookUrl(body.url)) {
    return NextResponse.json({ error: "webhook url must be a public http(s) endpoint" }, { status: 400 });
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
  if (!isSafeWebhookUrl(wh.url)) return NextResponse.json({ fired: false, reason: "blocked: unsafe webhook url" });

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
