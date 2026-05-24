import { NextRequest, NextResponse } from "next/server";
import { createNftCollection } from "@/lib/hedera/nft";

export async function POST(request: NextRequest) {
  const secret = process.env.SETUP_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "SETUP_SECRET env var not set" }, { status: 500 });
  }

  const auth = request.headers.get("x-setup-secret");
  if (auth !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.PET_ROCK_NFT_COLLECTION_ID) {
    return NextResponse.json({
      ok: true,
      collectionId: process.env.PET_ROCK_NFT_COLLECTION_ID,
      note: "Collection already configured",
    });
  }

  try {
    const collectionId = await createNftCollection();
    return NextResponse.json({ ok: true, collectionId });
  } catch (err) {
    console.error("[pet-rock] Setup error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Setup failed" },
      { status: 500 }
    );
  }
}
