import { NextRequest, NextResponse } from "next/server";
import { verifyPhotonSignature } from "@/lib/photon";
import { runAgent } from "@/lib/agent";
import { Spectrum, text } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";

export const runtime = "nodejs";
export const maxDuration = 60;

async function sendReply(senderId: string, body: string) {
  try {
    const projectId = process.env.IMESSAGE_PROJECT_ID;
    const projectSecret = process.env.IMESSAGE_PROJECT_SECRET;
    if (!projectId || !projectSecret) {
      console.error("Missing Photon project credentials");
      return;
    }

    const app = await Spectrum({
      projectId,
      projectSecret,
      providers: [imessage.config()],
    });
    const im = imessage(app);
    const user = await im.user(senderId);
    const space = await im.space.create(user);
    await space.send(text(body));
  } catch (err) {
    console.error("Failed to send reply:", err);
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-spectrum-signature");
  const timestamp = req.headers.get("x-spectrum-timestamp");
  const secret = process.env.IMESSAGE_WEBHOOK_SECRET || "";

  if (!verifyPhotonSignature(rawBody, signature, timestamp, secret)) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  let payload: { event?: string; message?: { content?: { type?: string; text?: string }; sender?: { id?: string } } };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  if (payload.event !== "messages" || payload.message?.content?.type !== "text") {
    return new NextResponse("ok", { status: 200 });
  }

  const senderId = payload.message?.sender?.id;
  const userText = payload.message?.content?.text;
  if (!senderId || !userText) {
    return new NextResponse("ok", { status: 200 });
  }

  const allowed = process.env.IMESSAGE_ALLOWED_USER_IDS;
  if (allowed) {
    const list = allowed.split(",").map((s) => s.trim());
    if (!list.includes(senderId)) {
      return new NextResponse("ok", { status: 200 });
    }
  }

  // Fire-and-forget so we can ack quickly
  void (async () => {
    try {
      const reply = await runAgent(senderId, userText);
      await sendReply(senderId, reply);
    } catch (err) {
      console.error("Agent error:", err);
      await sendReply(senderId, "Something went wrong on my side. Please try again.");
    }
  })();

  return new NextResponse("ok", { status: 200 });
}
