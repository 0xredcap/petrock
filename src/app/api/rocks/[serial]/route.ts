import { NextResponse } from "next/server";
import { generateRockSvg } from "@/lib/pixel-art/generate";

export async function GET(_req: Request, { params }: { params: Promise<{ serial: string }> }) {
  const { serial } = await params;
  const svg = generateRockSvg(parseInt(serial, 10) || 1);
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
