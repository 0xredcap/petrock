import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { submitPetMessage, readPetMessages, createPetTopic } from "@/lib/hedera/hcs";
import { mintRock, burnRock } from "@/lib/hedera/nft";
import { computeCurrentStats, isDead } from "@/lib/hedera/stats";
import { generateRockSvg } from "@/lib/pixel-art/generate";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const adoptPetTool = new DynamicStructuredTool({
  name: "adopt_pet",
  description:
    "Adopt (mint) a new Pet Rock NFT on Hedera. Creates an HCS topic for the pet's state and mints an NFT. Costs 1 HBAR.",
  schema: z.object({
    owner: z.string().describe("A display name or identifier for the owner"),
  }),
  func: async ({ owner }) => {
    try {
      // Create HCS topic for this pet
      const topicId = await createPetTopic();

      // Determine serial by minting (we'll use a placeholder metadata first)
      const placeholderMeta = JSON.stringify({ name: "Pet Rock (pending)" });
      const serial = await mintRock(
        `${appUrl}/metadata/${Date.now()}.json`
      );

      // Generate deterministic SVG
      const svg = generateRockSvg(serial);
      const svgPath = join(process.cwd(), "public", "rocks", `${serial}.svg`);
      mkdirSync(join(process.cwd(), "public", "rocks"), { recursive: true });
      writeFileSync(svgPath, svg, "utf-8");

      // Write metadata JSON
      const metadata = {
        name: `Pet Rock #${serial}`,
        creator: "Pet Rock Agent",
        description: "A delightful on-chain pet rock that needs love and HBAR to survive.",
        image: `${appUrl}/rocks/${serial}.svg`,
        type: "image/svg+xml",
        format: "HIP412@2.0.0",
        properties: {
          born_at: new Date().toISOString(),
          topic_id: topicId,
          owner,
        },
      };

      const metaPath = join(process.cwd(), "public", "metadata", `${serial}.json`);
      mkdirSync(join(process.cwd(), "public", "metadata"), { recursive: true });
      writeFileSync(metaPath, JSON.stringify(metadata, null, 2), "utf-8");

      // Write initial HCS message
      await submitPetMessage(topicId, {
        action: "born",
        hunger: 100,
        mood: 100,
        energy: 100,
        alive: true,
        born_at: new Date().toISOString(),
      });

      return JSON.stringify({
        success: true,
        serial,
        topicId,
        message: `Pet Rock #${serial} adopted! NFT minted on Hedera testnet. HCS topic: ${topicId}. Topic and serial saved — your rock is alive and waiting.`,
      });
    } catch (err) {
      return `Error adopting pet: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});

export const feedPetTool = new DynamicStructuredTool({
  name: "feed_pet",
  description: "Feed the user's pet rock. Restores hunger (+30) and mood (+5). Costs 0.5 HBAR.",
  schema: z.object({
    serial: z.number().describe("The NFT serial number of the pet"),
    topicId: z.string().describe("The HCS topic ID for this pet"),
  }),
  func: async ({ serial, topicId }) => {
    try {
      const txId = await submitPetMessage(topicId, {
        action: "feed",
        hunger: 30,
        mood: 5,
      });

      return JSON.stringify({
        success: true,
        txId,
        message: `Fed Pet Rock #${serial}! Hunger restored +30, mood +5. Transaction: ${txId}`,
      });
    } catch (err) {
      return `Error feeding pet: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});

export const playPetTool = new DynamicStructuredTool({
  name: "play_with_pet",
  description: "Play with the pet rock. Boosts mood (+30) but costs energy (-10). Costs 0.5 HBAR.",
  schema: z.object({
    serial: z.number().describe("The NFT serial number of the pet"),
    topicId: z.string().describe("The HCS topic ID for this pet"),
  }),
  func: async ({ serial, topicId }) => {
    try {
      const txId = await submitPetMessage(topicId, {
        action: "play",
        mood: 30,
        energy: -10,
      });

      return JSON.stringify({
        success: true,
        txId,
        message: `Played with Pet Rock #${serial}! Mood +30, energy -10. Transaction: ${txId}`,
      });
    } catch (err) {
      return `Error playing with pet: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});

export const groomPetTool = new DynamicStructuredTool({
  name: "groom_pet",
  description: "Groom the pet rock. Boosts mood (+20) and energy (+10). Costs 0.5 HBAR.",
  schema: z.object({
    serial: z.number().describe("The NFT serial number of the pet"),
    topicId: z.string().describe("The HCS topic ID for this pet"),
  }),
  func: async ({ serial, topicId }) => {
    try {
      const txId = await submitPetMessage(topicId, {
        action: "groom",
        mood: 20,
        energy: 10,
      });

      return JSON.stringify({
        success: true,
        txId,
        message: `Groomed Pet Rock #${serial}! Mood +20, energy +10. Transaction: ${txId}`,
      });
    } catch (err) {
      return `Error grooming pet: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});

export const sleepPetTool = new DynamicStructuredTool({
  name: "sleep_pet",
  description: "Put the pet rock to sleep. Restores energy (+40) but costs mood (-5) and hunger (-10). Free action.",
  schema: z.object({
    serial: z.number().describe("The NFT serial number of the pet"),
    topicId: z.string().describe("The HCS topic ID for this pet"),
  }),
  func: async ({ serial, topicId }) => {
    try {
      const txId = await submitPetMessage(topicId, {
        action: "sleep",
        energy: 40,
        mood: -5,
        hunger: -10,
      });

      return JSON.stringify({
        success: true,
        txId,
        message: `Pet Rock #${serial} is sleeping. Energy +40, mood -5, hunger -10. Transaction: ${txId}`,
      });
    } catch (err) {
      return `Error putting pet to sleep: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});

export const checkPetTool = new DynamicStructuredTool({
  name: "check_pet_status",
  description: "Check the current status and stats of the pet rock by reading and replaying HCS messages with time-decay. Free read-only action.",
  schema: z.object({
    serial: z.number().describe("The NFT serial number of the pet"),
    topicId: z.string().describe("The HCS topic ID for this pet"),
  }),
  func: async ({ serial, topicId }) => {
    try {
      const messages = await readPetMessages(topicId);
      const stats = computeCurrentStats(messages);

      // Check if rock should die
      if (stats.alive && isDead(stats)) {
        // Write death message
        const diedAt = new Date().toISOString();
        await submitPetMessage(topicId, {
          action: "died",
          alive: false,
          died_at: diedAt,
        });

        // Burn the NFT
        const collectionId = process.env.PET_ROCK_NFT_COLLECTION_ID;
        if (collectionId) {
          await burnRock(serial);
        }

        return JSON.stringify({
          success: true,
          alive: false,
          died: true,
          message: `💀 Pet Rock #${serial} has passed away. Hunger and mood both hit zero. The NFT has been burned. RIP little rock.`,
        });
      }

      const moodLabel =
        stats.mood > 70 ? "happy" : stats.mood > 30 ? "neutral" : "sad";
      const hungerLabel =
        stats.hunger > 70 ? "full" : stats.hunger > 30 ? "peckish" : "starving";
      const energyLabel =
        stats.energy > 70 ? "energetic" : stats.energy > 30 ? "tired" : "exhausted";

      return JSON.stringify({
        success: true,
        serial,
        topicId,
        stats,
        message: `Pet Rock #${serial} status — Hunger: ${Math.round(stats.hunger)}/100 (${hungerLabel}), Mood: ${Math.round(stats.mood)}/100 (${moodLabel}), Energy: ${Math.round(stats.energy)}/100 (${energyLabel}). Alive: ${stats.alive}.`,
      });
    } catch (err) {
      return `Error checking pet status: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});

export const petTools = [
  adoptPetTool,
  feedPetTool,
  playPetTool,
  groomPetTool,
  sleepPetTool,
  checkPetTool,
];
