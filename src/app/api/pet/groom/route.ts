import { NextRequest, NextResponse } from "next/server";
import { chargeAction } from "@/lib/mpp/server";
import { submitPetMessage } from "@/lib/hedera/hcs";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const body = await request.clone().json().catch(() => ({})) as {
    topicId?: string;
    serial?: number;
  };

  const result = await chargeAction(request, "0.5");
  if (!result.charged) return result.challenge;

  try {
    const { topicId, serial } = body;
    if (!topicId || serial === undefined) {
      return NextResponse.json({ error: "topicId and serial required" }, { status: 400 });
    }

    const txId = await submitPetMessage(topicId, {
      action: "groom",
      mood: 20,
      energy: 10,
    });

    return result.withReceipt(
      NextResponse.json({ ok: true, txId, serial }) as unknown as Response
    ) as unknown as NextResponse;
  } catch (err) {
    console.error("[pet-rock] Groom error:", err);
    return NextResponse.json({ error: "Groom action failed" }, { status: 500 });
  }
}
