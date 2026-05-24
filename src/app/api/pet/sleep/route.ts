import { NextRequest, NextResponse } from "next/server";
import { submitPetMessage } from "@/lib/hedera/hcs";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const { topicId, serial } = await request.json() as {
      topicId: string;
      serial: number;
    };

    const txId = await submitPetMessage(topicId, {
      action: "sleep",
      energy: 40,
      mood: -5,
      hunger: -10,
    });

    return NextResponse.json({ ok: true, txId, serial });
  } catch (err) {
    console.error("[pet-rock] Sleep error:", err);
    return NextResponse.json({ error: "Sleep action failed" }, { status: 500 });
  }
}
