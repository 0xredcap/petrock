import { Mppx, tempo } from "mppx/server";

const currency = process.env.MPP_CURRENCY ?? "0x20c0000000000000000000000000000000000000";
const recipient = process.env.MPP_RECIPIENT_ADDRESS as `0x${string}` | undefined;

function buildServer() {
  if (!recipient || recipient === "0x...") return null;
  try {
    return Mppx.create({
      methods: [
        // Use charge-only (no session) so no signing account is needed server-side
        tempo.charge({
          currency,
          recipient,
        }),
      ],
    });
  } catch (err) {
    console.warn("[pet-rock] MPP server init failed:", err);
    return null;
  }
}

export const mppServer = buildServer();

type ChargeResult =
  | { charged: false; challenge: Response }
  | { charged: true; withReceipt: (r: Response) => Response };

export async function chargeAction(
  request: Request,
  amount: string
): Promise<ChargeResult> {
  if (!mppServer) {
    // No MPP configured — allow through (set MPP_RECIPIENT_ADDRESS to enable)
    return { charged: true, withReceipt: (r) => r };
  }

  const result = await mppServer.charge({ amount })(request);

  if (result.status === 402) {
    return { charged: false, challenge: result.challenge as unknown as Response };
  }

  return {
    charged: true,
    withReceipt: (r: Response) => result.withReceipt(r) as unknown as Response,
  };
}
