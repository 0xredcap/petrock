import { NextRequest, NextResponse } from "next/server";
import { generateRockSvg } from "@/lib/pixel-art/generate";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ serial: string }> }
) {
  const { serial } = await params;
  const seed = parseInt(serial, 10);

  if (isNaN(seed)) {
    return new NextResponse("Invalid serial", { status: 400 });
  }

  const svg = generateRockSvg(seed);

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
