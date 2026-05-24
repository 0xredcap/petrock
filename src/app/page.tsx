"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import Chat, { ActivityEntry } from "@/components/Chat";
import ActivityPanel from "@/components/ActivityPanel";
import type { ReactionType } from "@/components/World";
import type { PetStats } from "@/lib/hedera/stats";

// Load PixiJS world client-only (no SSR)
const World = dynamic(() => import("@/components/World"), { ssr: false });

export default function Home() {
  const [serial, setSerial] = useState<number | undefined>();
  const [topicId, setTopicId] = useState<string | undefined>();
  const [stats, setStats] = useState<PetStats | undefined>();
  const [reaction, setReaction] = useState<ReactionType>(null);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);

  // Load pet from localStorage on mount
  useEffect(() => {
    const storedSerial = localStorage.getItem("petSerial");
    const storedTopicId = localStorage.getItem("petTopicId");
    if (storedSerial && storedTopicId) {
      setSerial(parseInt(storedSerial));
      setTopicId(storedTopicId);
    }
  }, []);

  // Poll stats every 10s when we have a pet
  useEffect(() => {
    if (!topicId) return;

    async function fetchStats() {
      try {
        const res = await fetch(`/api/pet?topicId=${topicId}`);
        if (!res.ok) return;
        const data = await res.json() as { stats: PetStats };
        setStats(data.stats);
      } catch {
        // Silently skip on network error
      }
    }

    fetchStats();
    const interval = setInterval(fetchStats, 10_000);
    return () => clearInterval(interval);
  }, [topicId]);

  const handlePetAdopted = useCallback((newSerial: number, newTopicId: string) => {
    setSerial(newSerial);
    setTopicId(newTopicId);
    localStorage.setItem("petSerial", String(newSerial));
    localStorage.setItem("petTopicId", newTopicId);
  }, []);

  const handleActivityLog = useCallback((entry: ActivityEntry) => {
    setActivityLog((prev) => [...prev.slice(-9), entry]);
  }, []);

  const handleReaction = useCallback((type: ReactionType) => {
    setReaction(type);
  }, []);

  const handleReactionDone = useCallback(() => {
    setReaction(null);
  }, []);

  return (
    <main className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden">
      {/* Header */}
      <header className="px-4 py-2 border-b-2 border-slate-700 flex items-center gap-3 shrink-0">
        <span className="text-lg">🪨</span>
        <span className="font-mono font-bold text-emerald-400 tracking-wider">PET ROCK</span>
        <span className="text-slate-500 text-xs font-mono">on-chain Tamagotchi · Hedera testnet</span>
        {serial && (
          <span className="ml-auto text-xs font-mono text-slate-400">
            Rock #{serial}
          </span>
        )}
      </header>

      {/* Main layout: garden (top) + panel (bottom) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Garden world — top 60% */}
        <div
          className="shrink-0 flex items-center justify-center bg-slate-950 border-b-2 border-slate-700"
          style={{ height: "60%" }}
        >
          <World
            serial={serial}
            stats={stats}
            reaction={reaction}
            onReactionDone={handleReactionDone}
          />
        </div>

        {/* Bottom panel — chat + activity */}
        <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>
          {/* Chat — main area */}
          <div className="flex-1 flex flex-col border-r-2 border-slate-700 overflow-hidden bg-slate-900">
            <Chat
              serial={serial}
              topicId={topicId}
              onReaction={handleReaction}
              onPetAdopted={handlePetAdopted}
              onActivityLog={handleActivityLog}
            />
          </div>

          {/* Activity panel — fixed width sidebar */}
          <div className="w-64 shrink-0 overflow-hidden bg-slate-950">
            <ActivityPanel
              entries={activityLog}
              stats={stats}
              serial={serial}
              topicId={topicId}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
