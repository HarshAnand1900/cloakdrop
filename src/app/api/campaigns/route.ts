import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import {
  saveCampaign,
  listCampaignsByAdmin,
  getCampaign,
  getClaimsForCampaign,
  STORE_BACKEND,
} from "@/lib/store";
import type { Campaign, ClaimRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/campaigns?admin=0x...      → campaigns created by that admin.
 * GET /api/campaigns?airdrop=0x...    → one campaign + its recipients (address + handle).
 */
export async function GET(req: NextRequest) {
  const airdrop = req.nextUrl.searchParams.get("airdrop");
  if (airdrop) {
    if (!isAddress(airdrop)) {
      return NextResponse.json({ error: "valid ?airdrop required" }, { status: 400 });
    }
    const campaign = await getCampaign(airdrop);
    if (!campaign) {
      return NextResponse.json({ error: "campaign not found" }, { status: 404 });
    }
    const claims = await getClaimsForCampaign(airdrop);
    // Expose only what the admin already knows — addresses + ciphertext handles.
    const recipients = claims.map((c) => ({ recipient: c.recipient, handle: c.handle }));
    return NextResponse.json({ campaign, recipients, backend: STORE_BACKEND });
  }

  const admin = req.nextUrl.searchParams.get("admin");
  if (!admin || !isAddress(admin)) {
    return NextResponse.json({ error: "valid ?admin or ?airdrop required" }, { status: 400 });
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
