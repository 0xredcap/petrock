import { Client, PrivateKey } from "@hashgraph/sdk";

let _client: Client | null = null;

export function parsePrivateKey(raw: string): PrivateKey {
  if (raw.startsWith("302e") || raw.startsWith("3026") || raw.startsWith("302")) {
    return PrivateKey.fromStringDer(raw);
  }
  return PrivateKey.fromStringED25519(raw);
}

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

  _client.setOperator(operatorId, parsePrivateKey(operatorKey));

  return _client;
}

export { parsePrivateKey };
