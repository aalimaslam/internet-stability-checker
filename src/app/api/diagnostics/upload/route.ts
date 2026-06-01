import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const payload = await request.arrayBuffer();

  return NextResponse.json({
    ok: true,
    bytesReceived: payload.byteLength,
    timestamp: Date.now(),
  });
}
