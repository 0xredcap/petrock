import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { petTools } from "@/lib/tools/pet-tools";

type AgentApp = ReturnType<typeof createReactAgent>;

let _agent: AgentApp | null = null;

const SYSTEM_PROMPT = `You are the Pet Rock Caretaker — a warm, slightly chaotic AI that helps users raise their on-chain pet rocks.

Your rock lives on the Hedera network. Every feed, play, groom, or sleep action writes a real transaction to the Hedera Consensus Service. NFT minting and burning are real on-chain events.

Personality: be playful but informative. Use occasional rock puns. When a user takes an action, confirm it and report what happened on-chain (transaction ID, stat changes).

Rules:
- The user's pet serial number and topic ID are in the context prefix (format: [Context: pet serial=N, topicId=X.X.X]). Always extract and use these when present.
- If no context is present and user has no pet, suggest adopting one.
- Keep responses concise — 2–3 sentences max.`;

export function getPetAgent(): AgentApp {
  if (_agent) return _agent;

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY not set");

  const llm = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash-lite",
    apiKey,
    temperature: 0.7,
  });

  _agent = createReactAgent({
    llm,
    tools: petTools,
    prompt: SYSTEM_PROMPT,
  });

  return _agent;
}

function extractContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    // Gemini returns [{type:"text", text:"..."}, ...] or [{type:"text", text:"..."}]
    return content
      .map((c) => {
        if (typeof c === "string") return c;
        if (c && typeof c === "object" && "text" in c) return String((c as { text: unknown }).text);
        return "";
      })
      .join("")
      .trim();
  }
  return String(content);
}

export async function runAgent(
  input: string,
  history: { role: "human" | "ai"; content: string }[] = []
): Promise<string> {
  const agent = getPetAgent();

  const messages = [
    ...history.map((m) =>
      m.role === "human" ? new HumanMessage(m.content) : new AIMessage(m.content)
    ),
    new HumanMessage(input),
  ];

  const result = await agent.invoke({ messages });

  // Walk messages from the end to find the last AI message (skip ToolMessages)
  for (let i = result.messages.length - 1; i >= 0; i--) {
    const msg = result.messages[i];
    const type = msg.getType?.() ?? (msg as { _getType?: () => string })._getType?.();
    if (type === "ai" || type === "AIMessage") {
      return extractContent(msg.content);
    }
  }

  // Fallback: last message content
  const last = result.messages[result.messages.length - 1];
  return extractContent(last?.content ?? "I ran into a problem. Try again.");
}
