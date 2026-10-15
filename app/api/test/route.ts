import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const userId = body.userId || "+15551234567";
  const text = body.text || "My flight was cancelled. I need to get to Lagos.";

  try {
    const reply = await runAgent(userId, text);
    return NextResponse.json({ reply });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}