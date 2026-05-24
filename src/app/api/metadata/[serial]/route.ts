import { NextResponse } from "next/server";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(_req: Request, { params }: { params: Promise<{ serial: string }> }) {
  const { serial } = await params;
  const num = parseInt(serial, 10) || 1;

  return NextResponse.json({
    name: `Pet Rock #${num}`,
    creator: "Pet Rock Agent",
    description: "A delightful on-chain pet rock that needs love and HBAR to survive.",
    image: `${appUrl}/api/rocks/${num}`,
    type: "image/svg+xml",
    format: "HIP412@2.0.0",
  }, {
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
