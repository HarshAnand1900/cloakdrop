import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import {
  saveCampaign,
  listCampaignsByAdmin,
  STORE_BACKEND,
} from "@/lib/store";
import type { Campaign, ClaimRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/campaigns?admin=0x... → campaigns created by that admin. */
export async function GET(req: NextRequest) {
  const admin = req.nextUrl.searchParams.get("admin");
  if (!admin || !isAddress(admin)) {
    return NextResponse.json({ error: "valid ?admin required" }, { status: 400 });
  }
  const campaigns = await listCampaignsByAdmin(admin);
  return NextResponse.json({ campaigns, backend: STORE_BACKEND });
}

/** POST /api/campaigns → persist a deployed campaign + its signed claims. */
export async function POST(req: NextRequest) {
  let body: { campaign?: Campaign; claims?: ClaimRecord[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { campaign, claims } = body;
  if (!campaign || !Array.isArray(claims)) {
    return NextResponse.json(
      { error: "campaign and claims[] required" },
      { status: 400 },
    );
  }
  if (!isAddress(campaign.airdrop) || !isAddress(campaign.admin)) {
    return NextResponse.json(
      { error: "campaign.airdrop and campaign.admin must be addresses" },
      { status: 400 },
    );
  }
  for (const c of claims) {
    if (!isAddress(c.recipient) || !c.handle || !c.signature || !c.inputProof) {
      return NextResponse.json(
        { error: "each claim needs recipient, handle, inputProof, signature" },
        { status: 400 },
      );
    }
  }

  try {
    await saveCampaign(campaign, claims);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Most common cause: no persistent store configured on a read-only host.
    const hint =
      STORE_BACKEND === "file"
        ? " — no UPSTASH_REDIS_REST_URL/TOKEN set, and the file store can't write on a read-only host (e.g. Vercel). Add Upstash env vars and redeploy."
        : "";
    return NextResponse.json(
      { error: `Failed to persist campaign${hint}`, detail: msg, backend: STORE_BACKEND },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, airdrop: campaign.airdrop, backend: STORE_BACKEND });
}
