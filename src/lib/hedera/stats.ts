import { PetMessage } from "./hcs";

export interface PetStats {
  hunger: number;
  mood: number;
  energy: number;
  alive: boolean;
  born_at?: string;
  died_at?: string;
  lastActionAt: number;
}

// Decay rates per millisecond
const DECAY_HUNGER_PER_MS = 2 / (60 * 60 * 1000);    // -2 per hour
const DECAY_MOOD_PER_MS = 1 / (60 * 60 * 1000);       // -1 per hour
const DECAY_ENERGY_PER_MS = 1.5 / (60 * 60 * 1000);   // -1.5 per hour

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function computeCurrentStats(messages: PetMessage[]): PetStats {
  let hunger = 0;
  let mood = 0;
  let energy = 0;
  let alive = false;
  let born_at: string | undefined;
  let died_at: string | undefined;
  let lastActionAt = Date.now();

  for (const msg of messages) {
    const msgTime = msg.timestamp ?? Date.now();

    switch (msg.action) {
      case "born":
        hunger = 100;
        mood = 100;
        energy = 100;
        alive = true;
        born_at = msg.born_at;
        lastActionAt = msgTime;
        break;

      case "feed":
        hunger = clamp(hunger + (msg.hunger ?? 30));
        mood = clamp(mood + (msg.mood ?? 5));
        lastActionAt = msgTime;
        break;

      case "play":
        mood = clamp(mood + (msg.mood ?? 30));
        energy = clamp(energy + (msg.energy ?? -10));
        lastActionAt = msgTime;
        break;

      case "groom":
        mood = clamp(mood + (msg.mood ?? 20));
        energy = clamp(energy + (msg.energy ?? 10));
        lastActionAt = msgTime;
        break;

      case "sleep":
        energy = clamp(energy + (msg.energy ?? 40));
        mood = clamp(mood + (msg.mood ?? -5));
        hunger = clamp(hunger + (msg.hunger ?? -10));
        lastActionAt = msgTime;
        break;

      case "died":
        alive = false;
        died_at = msg.died_at;
        lastActionAt = msgTime;
        break;
    }
  }

  if (!alive && messages.length === 0) {
    return { hunger: 0, mood: 0, energy: 0, alive: false, lastActionAt };
  }

  // Apply time-based decay from last action to now
  if (alive) {
    const elapsedMs = Date.now() - lastActionAt;
    hunger = clamp(hunger - DECAY_HUNGER_PER_MS * elapsedMs);
    mood = clamp(mood - DECAY_MOOD_PER_MS * elapsedMs);
    energy = clamp(energy - DECAY_ENERGY_PER_MS * elapsedMs);
  }

  return { hunger, mood, energy, alive, born_at, died_at, lastActionAt };
}

export function isDead(stats: PetStats): boolean {
  return stats.hunger <= 0 && stats.mood <= 0;
}
