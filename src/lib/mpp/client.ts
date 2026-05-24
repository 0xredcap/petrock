// Server-side MPP client — patches the global fetch so the agent's
// internal HTTP calls to pet-action routes can handle 402 challenges
// and settle payments automatically.

let initialized = false;

export function initMppClient() {
  if (initialized) return;
  initialized = true;

  const agentKey = process.env.MPP_AGENT_PRIVATE_KEY as `0x${string}` | undefined;

  if (!agentKey) {
    console.warn("[pet-rock] MPP_AGENT_PRIVATE_KEY not set — MPP auto-payment disabled on agent");
    return;
  }

  // Dynamic requires work in Next.js API routes (server-side)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Mppx, tempo } = require("mppx/client") as typeof import("mppx/client");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { privateKeyToAccount } = require("viem/accounts") as typeof import("viem/accounts");

    Mppx.create({
      methods: [
        tempo({
          account: privateKeyToAccount(agentKey),
        }),
      ],
    });

    console.info("[pet-rock] MPP client initialized for agent payments");
  } catch (err) {
    console.warn("[pet-rock] Failed to initialize MPP client:", err);
  }
}
