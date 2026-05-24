#!/usr/bin/env tsx
/**
 * One-time setup: creates the Pet Rock NFT collection on Hedera testnet
 * and prints the token ID to add to .env.local.
 *
 * Run with: npm run setup:collection
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { createNftCollection } = await import("../src/lib/hedera/nft");

  console.log("Creating Pet Rock NFT collection on Hedera testnet...");

  try {
    const tokenId = await createNftCollection();
    console.log("\n✅ NFT collection created!");
    console.log(`Token ID: ${tokenId}`);
    console.log("\nAdd this to your .env.local:");
    console.log(`PET_ROCK_NFT_COLLECTION_ID=${tokenId}`);
    console.log("\nView on HashScan:");
    console.log(`https://hashscan.io/testnet/token/${tokenId}`);
  } catch (err) {
    console.error("Failed to create collection:", err);
    process.exit(1);
  }
}

main();
