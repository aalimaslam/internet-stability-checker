import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

const MAX_SIZE_KB = 2048;
const DEFAULT_SIZE_KB = 1024;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedSize = Number(searchParams.get("sizeKB") ?? DEFAULT_SIZE_KB);
  const sizeKB = Number.isFinite(requestedSize)
    ? Math.min(Math.max(Math.floor(requestedSize), 64), MAX_SIZE_KB)
    : DEFAULT_SIZE_KB;

  const body = randomBytes(sizeKB * 1024);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store",
      "Content-Length": String(body.byteLength),
    },
  });
}
