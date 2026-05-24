import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/hedera/agent";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { message, history = [] } = await request.json() as {
      message: string;
      history?: { role: "human" | "ai"; content: string }[];
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const reply = await runAgent(message, history);

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[pet-rock] Chat error:", err);
    return NextResponse.json(
      { error: "Agent error. Check server logs." },
      { status: 500 }
    );
  }
}
