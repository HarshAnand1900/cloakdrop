import { NextRequest, NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { getClaimsForRecipient } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/claims?recipient=0x... → every claim that address can make. */
export async function GET(req: NextRequest) {
  const recipient = req.nextUrl.searchParams.get("recipient");
  if (!recipient || !isAddress(recipient)) {
    return NextResponse.json(
      { error: "valid ?recipient required" },
      { status: 400 },
    );
  }
  const claims = await getClaimsForRecipient(recipient as Address);
  return NextResponse.json({ claims });
}
