"use client";

import { useState, useRef, useEffect } from "react";
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

const PET_ACTIONS = [
  { label: "Feed", command: "feed my pet rock", color: "emerald" },
  { label: "Play", command: "play with my pet rock", color: "yellow" },
  { label: "Groom", command: "groom my pet rock", color: "blue" },
  { label: "Sleep", command: "put my pet rock to sleep", color: "purple" },
  { label: "Status", command: "check my pet rock status", color: "slate" },
] as const;

type ActionColor = "emerald" | "yellow" | "blue" | "purple" | "slate";

const colorMap: Record<ActionColor, string> = {
  emerald: "bg-emerald-800 border-emerald-500 text-emerald-100 hover:bg-emerald-700",
  yellow: "bg-yellow-800 border-yellow-500 text-yellow-100 hover:bg-yellow-700",
  blue: "bg-blue-800 border-blue-500 text-blue-100 hover:bg-blue-700",
  purple: "bg-purple-800 border-purple-500 text-purple-100 hover:bg-purple-700",
  slate: "bg-slate-700 border-slate-500 text-slate-100 hover:bg-slate-600",
};

const btnBase = "px-2 py-2 border-2 text-xs font-mono rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export default function Chat({ serial, topicId, onReaction, onPetAdopted, onActivityLog }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      content: serial
        ? `Pet Rock #${serial} is ready! Tap an action to care for your rock.`
        : "Hello! Ready to adopt your very own on-chain pet rock?",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function adoptDirectly() {
    if (loading) return;
    setMessages((prev) => [...prev, { role: "human", content: "Adopt a pet rock" }]);
    setLoading(true);

    try {
      const res = await fetch("/api/adopt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: "player" }),
      });

      const data = await res.json() as { ok?: boolean; serial?: number; topicId?: string; txId?: string; error?: string };

      if (data.ok && data.serial !== undefined && data.topicId) {
        const reply = `Pet Rock #${data.serial} adopted! Your on-chain rock is alive and waiting. HCS Topic: ${data.topicId}.`;
        setMessages((prev) => [...prev, { role: "ai", content: reply }]);
        onPetAdopted?.(data.serial, data.topicId);
        if (data.txId) {
          onActivityLog?.({ type: "tx", label: "Adopt NFT", id: data.txId, timestamp: Date.now() });
        }
      } else {
        const errMsg = data.error ?? (res.ok ? "Adopt failed." : `Server error ${res.status}`);
        setMessages((prev) => [...prev, { role: "ai", content: `Adopt failed: ${errMsg}` }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "ai", content: "Connection error during adopt. Try again." }]);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(userMsg: string) {
    if (loading) return;
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

      const data = await res.json() as { reply?: string; error?: string; message?: string; errorMessage?: string };
      const reply = data.reply ?? data.error ?? data.message ?? data.errorMessage
        ?? (res.ok ? "No response." : `Server error ${res.status} — try again.`);

      setMessages((prev) => [...prev, { role: "ai", content: reply }]);

      const reaction = detectReaction(reply);
      if (reaction) onReaction?.(reaction);

      if (!serial && reply.includes("Pet Rock #")) {
        const serialMatch = reply.match(/Pet Rock #(\d+)/);
        const topicMatch = reply.match(/topic[:\s]+([0-9.]+)/i);
        if (serialMatch && topicMatch) {
          onPetAdopted?.(parseInt(serialMatch[1]), topicMatch[1]);
        }
      }

      const txMatch = reply.match(/0\.0\.\d+@\d+\.\d+/g);
      if (txMatch) {
        txMatch.forEach((txId) => {
          onActivityLog?.({ type: "tx", label: "Hedera tx", id: txId, timestamp: Date.now() });
        });
      }
    } catch {
      setMessages((prev) => [...prev, { role: "ai", content: "Connection error. Try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleCustomSubmit() {
    if (!customInput.trim() || loading) return;
    sendMessage(customInput.trim());
    setCustomInput("");
    setShowCustom(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message history */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 font-mono min-h-0">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "human" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded border-2 text-xs leading-relaxed ${
              msg.role === "human"
                ? "bg-slate-700 border-slate-500 text-white"
                : "bg-emerald-900 border-emerald-600 text-emerald-100"
            }`}>
              {msg.role === "ai" && (
                <span className="text-emerald-400 text-xs block mb-1">Caretaker</span>
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

      {/* Action buttons */}
      <div className="border-t-2 border-slate-600 p-2 space-y-1.5">
        {serial ? (
          <div className="grid grid-cols-2 gap-1.5">
            {PET_ACTIONS.filter((a) => a.label !== "Status").map((action) => (
              <button
                key={action.label}
                disabled={loading}
                onClick={() => sendMessage(action.command)}
                className={`${btnBase} ${colorMap[action.color as ActionColor]}`}
              >
                {action.label}
              </button>
            ))}
            <button
              disabled={loading}
              onClick={() => sendMessage("check my pet rock status")}
              className={`${btnBase} col-span-2 ${colorMap.slate}`}
            >
              {loading ? "..." : "Check Status"}
            </button>
          </div>
        ) : (
          <button
            disabled={loading}
            onClick={adoptDirectly}
            className={`${btnBase} w-full bg-emerald-700 border-emerald-500 text-white hover:bg-emerald-600`}
          >
            {loading ? "Adopting..." : "ADOPT A PET ROCK"}
          </button>
        )}

        {/* Optional custom message */}
        {showCustom ? (
          <div className="flex gap-1.5">
            <input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCustomSubmit()}
              placeholder="say something..."
              disabled={loading}
              autoFocus
              className="flex-1 bg-slate-800 border-2 border-slate-600 text-white text-xs px-2 py-1.5 rounded outline-none focus:border-emerald-500 font-mono placeholder-slate-500"
            />
            <button
              onClick={handleCustomSubmit}
              disabled={loading || !customInput.trim()}
              className={`${btnBase} ${colorMap.slate}`}
            >
              OK
            </button>
            <button
              onClick={() => { setShowCustom(false); setCustomInput(""); }}
              className={`${btnBase} ${colorMap.slate}`}
            >
              X
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCustom(true)}
            className="w-full text-xs text-slate-500 hover:text-slate-300 font-mono py-0.5 transition-colors"
          >
            + custom message
          </button>
        )}
      </div>
    </div>
  );
}
