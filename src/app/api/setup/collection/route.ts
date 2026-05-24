import { NextRequest, NextResponse } from "next/server";
import { createNftCollection } from "@/lib/hedera/nft";

// One-time setup route: creates the Pet Rock NFT collection on Hedera testnet.
// Protected by SETUP_SECRET env var. Call once, then add the returned token ID
// to NEXT_PUBLIC_APP_URL and redeploy.
//
// Usage:
//   curl https://your-site.netlify.app/api/setup/collection?secret=YOUR_SECRET

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.SETUP_SECRET;

  if (!expectedSecret) {
    return NextResponse.json(
      { error: "SETUP_SECRET env var not set — set it in Netlify to enable this route" },
      { status: 403 }
    );
  }

  if (secret !== expectedSecret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
  }

  if (process.env.PET_ROCK_NFT_COLLECTION_ID) {
    return NextResponse.json({
      ok: true,
      alreadyExists: true,
      collectionId: process.env.PET_ROCK_NFT_COLLECTION_ID,
      message: "Collection already configured. Nothing to do.",
    });
  }

  try {
    const collectionId = await createNftCollection();

    return NextResponse.json({
      ok: true,
      collectionId,
      message: `Collection created! Add PET_ROCK_NFT_COLLECTION_ID=${collectionId} to your Netlify environment variables and redeploy.`,
      hashscan: `https://hashscan.io/testnet/token/${collectionId}`,
    });
  } catch (err) {
    console.error("[pet-rock] Collection setup error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create collection" },
      { status: 500 }
    );
  }
}
