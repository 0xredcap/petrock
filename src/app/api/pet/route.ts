import { NextRequest, NextResponse } from "next/server";
import { readPetMessages } from "@/lib/hedera/hcs";
import { computeCurrentStats } from "@/lib/hedera/stats";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const topicId = searchParams.get("topicId");

  if (!topicId) {
    return NextResponse.json({ error: "topicId is required" }, { status: 400 });
  }

  try {
    const messages = await readPetMessages(topicId);
    const stats = computeCurrentStats(messages);

    return NextResponse.json({ stats, messageCount: messages.length });
  } catch (err) {
    console.error("[pet-rock] Stats error:", err);
    return NextResponse.json({ error: "Failed to fetch pet stats" }, { status: 500 });
  }
}
