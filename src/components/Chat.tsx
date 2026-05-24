"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import type { ReactionType } from "./World";

interface Message {
  role: "human" | "ai";
  content: string;
}

interface ChatProps {
  serial?: number;
  topicId?: string;
  onReaction?: (type: ReactionType) => void;
  onPetAdopted?: (serial: number, topicId: string) => void;
  onActivityLog?: (entry: ActivityEntry) => void;
}

export interface ActivityEntry {
  type: "tx" | "mpp";
  label: string;
  id: string;
  timestamp: number;
}

function detectReaction(reply: string): ReactionType {
  const lower = reply.toLowerCase();
  if (lower.includes("fed") || lower.includes("feed") || lower.includes("hunger restored")) return "fed";
  if (lower.includes("played") || lower.includes("play") || lower.includes("mood")) return "played";
  if (lower.includes("groom") || lower.includes("sparkl")) return "groomed";
  if (lower.includes("sleep") || lower.includes("zzz")) return "sleeping";
  if (lower.includes("passed away") || lower.includes("died") || lower.includes("burned")) return "dead";
  return null;
}

export default function Chat({ serial, topicId, onReaction, onPetAdopted, onActivityLog }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      content: serial
        ? `Welcome back! Your Pet Rock #${serial} is waiting. What would you like to do? (feed, play, groom, sleep, or check status)`
        : "Hello! I'm the Pet Rock Caretaker. Ready to adopt your very own on-chain pet rock? Just say \"adopt a pet rock\" to get started!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "human", content: userMsg }]);
    setLoading(true);

    try {
      const contextPrefix = serial && topicId
        ? `[Context: pet serial=${serial}, topicId=${topicId}] `
        : "";

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: contextPrefix + userMsg,
          history: messages.slice(-10),
        }),
      });

      const data = await res.json() as { reply?: string; error?: string };
      const reply = data.reply ?? data.error ?? "Something went wrong.";

      setMessages((prev) => [...prev, { role: "ai", content: reply }]);

      // Detect reaction animation
      const reaction = detectReaction(reply);
      if (reaction) onReaction?.(reaction);

      // Parse adopt result for serial/topicId
      if (!serial && reply.includes("Pet Rock #")) {
        const serialMatch = reply.match(/Pet Rock #(\d+)/);
        const topicMatch = reply.match(/topic[:\s]+([0-9.]+)/i);
        if (serialMatch && topicMatch) {
          const newSerial = parseInt(serialMatch[1]);
          const newTopicId = topicMatch[1];
          onPetAdopted?.(newSerial, newTopicId);
        }
      }

      // Log any tx IDs
      const txMatch = reply.match(/0\.0\.\d+@\d+\.\d+/g);
      if (txMatch) {
        txMatch.forEach((txId) => {
          onActivityLog?.({ type: "tx", label: "Hedera tx", id: txId, timestamp: Date.now() });
        });
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "Connection error. Try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message history */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 font-mono text-sm">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "human" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded border-2 text-xs leading-relaxed ${
                msg.role === "human"
                  ? "bg-slate-700 border-slate-500 text-white"
                  : "bg-emerald-900 border-emerald-600 text-emerald-100"
              }`}
              style={{ fontFamily: "monospace" }}
            >
              {msg.role === "ai" && (
                <span className="text-emerald-400 text-xs block mb-1">🪨 Caretaker</span>
              )}
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="px-3 py-2 bg-emerald-900 border-2 border-emerald-600 rounded text-emerald-300 text-xs animate-pulse">
              thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 p-2 border-t-2 border-slate-600">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={serial ? "feed, play, groom, sleep..." : "say: adopt a pet rock"}
          disabled={loading}
          className="flex-1 bg-slate-800 border-2 border-slate-600 text-white text-xs px-3 py-2 rounded outline-none focus:border-emerald-500 font-mono placeholder-slate-500"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-2 bg-emerald-700 border-2 border-emerald-500 text-white text-xs font-mono rounded hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          SEND
        </button>
      </form>
    </div>
  );
}
