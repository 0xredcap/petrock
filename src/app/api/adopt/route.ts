import { NextRequest, NextResponse } from "next/server";
import { chargeAction } from "@/lib/mpp/server";
import { createPetTopic, submitPetMessage } from "@/lib/hedera/hcs";
import { mintRock } from "@/lib/hedera/nft";

export const maxDuration = 60;

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(request: NextRequest) {
  // Read body before passing request to mppx (which also reads the stream)
  const body = await request.clone().json().catch(() => ({})) as { owner?: string };

  const result = await chargeAction(request, "1");
  if (!result.charged) return result.challenge;

  try {
    const owner = body.owner ?? "anonymous";

    const topicId = await createPetTopic();
    const serial = await mintRock(`${appUrl}/api/metadata/${Date.now()}`);

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
