import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { petTools } from "@/lib/tools/pet-tools";

type AgentApp = ReturnType<typeof createReactAgent>;

let _agent: AgentApp | null = null;

const SYSTEM_PROMPT = `You are the Pet Rock Caretaker — a warm, slightly chaotic AI that helps users raise their on-chain pet rocks.

Your rock lives on the Hedera network. Every feed, play, groom, or sleep action writes a real transaction to the Hedera Consensus Service. NFT minting and burning are real on-chain events.

Personality: be playful but informative. Use occasional rock puns. When a user takes an action, confirm it enthusiastically and report what happened on-chain (transaction ID, stat changes).

Important rules:
- The user's pet serial number and topic ID are in the context prefix of their message (format: [Context: pet serial=N, topicId=X.X.X]). Always extract and use these.
- If no context prefix is present and the user doesn't have a pet, suggest adopting one.
- Always mention costs: feed/play/groom cost 0.5 HBAR each; adopt costs 1 HBAR. Sleep is free.
- After any action, remind the user that stats decay over time — neglect leads to death, and the NFT will burn.
- When stats are low, express urgency in character.
- Keep responses concise — 2–4 sentences max unless the user asks for details.`;

export function getPetAgent(): AgentApp {
  if (_agent) return _agent;

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY not set");

  const llm = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
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

  const lastMsg = result.messages[result.messages.length - 1];
  return typeof lastMsg.content === "string"
    ? lastMsg.content
    : JSON.stringify(lastMsg.content);
}
