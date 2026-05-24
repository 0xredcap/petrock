import {
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenMintTransaction,
  TokenBurnTransaction,
  TokenId,
  AccountId,
} from "@hashgraph/sdk";
import { getHederaClient, parsePrivateKey } from "./client";

export async function createNftCollection(): Promise<string> {
  const client = getHederaClient();
  const operatorKey = parsePrivateKey(process.env.HEDERA_OPERATOR_KEY!);

  const tx = await new TokenCreateTransaction()
    .setTokenName("Pet Rock")
    .setTokenSymbol("ROCK")
    .setTokenType(TokenType.NonFungibleUnique)
    .setSupplyType(TokenSupplyType.Finite)
    .setMaxSupply(10_000)
    .setTreasuryAccountId(AccountId.fromString(process.env.HEDERA_OPERATOR_ID!))
    .setAdminKey(operatorKey.publicKey)
    .setSupplyKey(operatorKey.publicKey)
    .setMetadataKey(operatorKey.publicKey)
    .freezeWith(client)
    .sign(operatorKey);

  const receipt = await (await tx.execute(client)).getReceipt(client);

  if (!receipt.tokenId) throw new Error("Failed to create NFT collection");
  return receipt.tokenId.toString();
}

export async function mintRock(metadataUri: string): Promise<number> {
  const client = getHederaClient();
  const operatorKey = parsePrivateKey(process.env.HEDERA_OPERATOR_KEY!);
  const collectionId = process.env.PET_ROCK_NFT_COLLECTION_ID;

  if (!collectionId) throw new Error("PET_ROCK_NFT_COLLECTION_ID not set");

  const metadata = Buffer.from(metadataUri, "utf-8");

  const tx = await new TokenMintTransaction()
    .setTokenId(TokenId.fromString(collectionId))
    .addMetadata(metadata)
    .freezeWith(client)
    .sign(operatorKey);

  const receipt = await (await tx.execute(client)).getReceipt(client);

  const serial = receipt.serials?.[0]?.toNumber();
  if (serial === undefined) throw new Error("Mint returned no serial number");

  console.info(`[pet-rock] Minted NFT serial #${serial}, collection ${collectionId}`);
  return serial;
}

export async function burnRock(serial: number): Promise<string> {
  const client = getHederaClient();
  const operatorKey = parsePrivateKey(process.env.HEDERA_OPERATOR_KEY!);
  const collectionId = process.env.PET_ROCK_NFT_COLLECTION_ID;

  if (!collectionId) throw new Error("PET_ROCK_NFT_COLLECTION_ID not set");

  const tx = await new TokenBurnTransaction()
    .setTokenId(TokenId.fromString(collectionId))
    .setSerials([serial])
    .freezeWith(client)
    .sign(operatorKey);

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  const txId = response.transactionId.toString();

  console.info(`[pet-rock] Burned NFT serial #${serial}, tx ${txId}`);
  return txId;
}
