import { Client, PrivateKey } from "@hashgraph/sdk";

let _client: Client | null = null;

export function getHederaClient(): Client {
  if (_client) return _client;

  const operatorId = process.env.HEDERA_OPERATOR_ID;
  const operatorKey = process.env.HEDERA_OPERATOR_KEY;

  if (!operatorId || !operatorKey) {
    throw new Error("HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set");
  }

  _client =
    process.env.HEDERA_NETWORK === "mainnet"
      ? Client.forMainnet()
      : Client.forTestnet();

  _client.setOperator(operatorId, PrivateKey.fromString(operatorKey));

  return _client;
}
