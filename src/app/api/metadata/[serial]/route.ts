import { NextRequest, NextResponse } from "next/server";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ serial: string }> }
) {
  const { serial } = await params;
  const seed = parseInt(serial, 10);

  if (isNaN(seed)) {
    return new NextResponse("Invalid serial", { status: 400 });
  }

  const metadata = {
    name: `Pet Rock #${serial}`,
    creator: "Pet Rock Agent",
    description: "A delightful on-chain pet rock that needs love and HBAR to survive.",
    image: `${appUrl}/api/rocks/${serial}`,
    type: "image/svg+xml",
    format: "HIP412@2.0.0",
  };

  return NextResponse.json(metadata, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
