import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "relay",
    mode: process.env.FLIGHT_MODE || "demo",
    time: new Date().toISOString(),
  });
}
