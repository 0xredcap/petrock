import { NextRequest, NextResponse } from "next/server";
import { chargeAction } from "@/lib/mpp/server";
import { createPetTopic, submitPetMessage } from "@/lib/hedera/hcs";
import { mintRock } from "@/lib/hedera/nft";
import { generateRockSvg } from "@/lib/pixel-art/generate";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

export const maxDuration = 60;

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(request: NextRequest) {
  const result = await chargeAction(request, "1");
  if (!result.charged) return result.challenge;

  try {
    const body = await request.json().catch(() => ({})) as { owner?: string };
    const owner = body.owner ?? "anonymous";

    const topicId = await createPetTopic();
    const serial = await mintRock(`${appUrl}/metadata/pending.json`);

    const svg = generateRockSvg(serial);
    const rocksDir = join(process.cwd(), "public", "rocks");
    mkdirSync(rocksDir, { recursive: true });
    writeFileSync(join(rocksDir, `${serial}.svg`), svg, "utf-8");

    const metadata = {
      name: `Pet Rock #${serial}`,
      creator: "Pet Rock Agent",
      description: "A delightful on-chain pet rock that needs love and HBAR to survive.",
      image: `${appUrl}/rocks/${serial}.svg`,
      type: "image/svg+xml",
      format: "HIP412@2.0.0",
      properties: {
        born_at: new Date().toISOString(),
        topic_id: topicId,
        owner,
      },
    };

    const metaDir = join(process.cwd(), "public", "metadata");
    mkdirSync(metaDir, { recursive: true });
    writeFileSync(join(metaDir, `${serial}.json`), JSON.stringify(metadata, null, 2), "utf-8");

    const txId = await submitPetMessage(topicId, {
      action: "born",
      hunger: 100,
      mood: 100,
      energy: 100,
      alive: true,
      born_at: new Date().toISOString(),
    });

    console.info(`[pet-rock] Adopted Pet Rock #${serial}, topic ${topicId}`);

    return result.withReceipt(
      NextResponse.json({ ok: true, serial, topicId, txId }) as unknown as Response
    ) as unknown as NextResponse;
  } catch (err) {
    console.error("[pet-rock] Adopt error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Adopt failed" },
      { status: 500 }
    );
  }
}
