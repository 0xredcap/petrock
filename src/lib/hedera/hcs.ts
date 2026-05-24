import {
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TopicId,
  PrivateKey,
} from "@hashgraph/sdk";
import { getHederaClient } from "./client";

export interface PetMessage {
  action: string;
  hunger?: number;
  mood?: number;
  energy?: number;
  alive?: boolean;
  born_at?: string;
  died_at?: string;
  timestamp?: number;
  sequence?: number;
}

export interface HcsMessage {
  sequence_number: number;
  consensus_timestamp: string;
  message: string;
}

export async function createPetTopic(): Promise<string> {
  const client = getHederaClient();
  const operatorKey = PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY!);

  const tx = await new TopicCreateTransaction()
    .setAdminKey(operatorKey.publicKey)
    .setSubmitKey(operatorKey.publicKey)
    .setTopicMemo("Pet Rock topic")
    .freezeWith(client)
    .sign(operatorKey);

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);

  if (!receipt.topicId) throw new Error("Failed to create HCS topic");
  const topicId = receipt.topicId.toString();

  console.info(`[pet-rock] Created HCS topic ${topicId}`);
  return topicId;
}

export async function submitPetMessage(
  topicId: string,
  message: PetMessage
): Promise<string> {
  const client = getHederaClient();
  const operatorKey = PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY!);

  const payload = JSON.stringify({ ...message, timestamp: Date.now() });

  const tx = await new TopicMessageSubmitTransaction()
    .setTopicId(TopicId.fromString(topicId))
    .setMessage(payload)
    .freezeWith(client)
    .sign(operatorKey);

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  const txId = response.transactionId.toString();

  console.info(`[pet-rock] HCS message submitted to ${topicId}: ${message.action}, tx ${txId}`);
  return txId;
}

export async function readPetMessages(topicId: string): Promise<PetMessage[]> {
  const url = `https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages?limit=100&order=asc`;

  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`Mirror node error: ${res.status}`);
  }

  const data = await res.json() as { messages: HcsMessage[] };

  return data.messages.map((m, idx) => {
    try {
      const decoded = Buffer.from(m.message, "base64").toString("utf-8");
      const parsed = JSON.parse(decoded) as PetMessage;
      return { ...parsed, sequence: m.sequence_number };
    } catch {
      return { action: "unknown", sequence: m.sequence_number };
    }
  });
}
